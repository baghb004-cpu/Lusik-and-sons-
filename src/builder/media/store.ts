// ============================================================
// Media library — storage adapters (server-only)
// ============================================================
// Binary cousin of storage/fs.ts + storage/github.ts, with the
// same shape and the same walls:
//   fs     — thumb drive / home server / `next dev`: files land
//            in <repo>/public/img/uploads (Next serves them
//            immediately), written atomically (tmp + rename),
//            best-effort git-committed so History covers media.
//   github — hosted mode: each upload is a commit via the
//            contents API; the file serves after the normal
//            gated deploy.
//
// Every name passes assertMediaFileName before any I/O, and the
// fs adapter re-checks resolved-path containment as defense in
// depth — the same belt-and-suspenders as document storage.
// ============================================================

import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, resolve, sep } from "node:path";

import { MEDIA_DIR, MediaPathError, assertMediaFileName, mediaWebPath } from "./paths.ts";

const exec = promisify(execFile);

export interface MediaEntry {
  name: string;
  /** The web path documents reference: /img/uploads/<name>. */
  path: string;
  size?: number;
}

export interface MediaStore {
  readonly backend: "fs" | "github";
  list(): Promise<MediaEntry[]>;
  save(name: string, bytes: Uint8Array): Promise<MediaEntry>;
  remove(name: string): Promise<void>;
}

// ── filesystem ──────────────────────────────────────────────
export function createFsMediaStore(rootDir: string = process.cwd()): MediaStore {
  const root = resolve(rootDir);
  const dir = join(root, MEDIA_DIR);

  const toAbs = (name: string): string => {
    assertMediaFileName(name);
    const abs = resolve(dir, name);
    if (!abs.startsWith(dir + sep)) {
      throw new MediaPathError(`Path escapes the media directory: ${name}`);
    }
    return abs;
  };

  // Same best-effort history as document saves: a repo gets commits,
  // a bare folder just works without them. Never blocks an upload.
  const tryCommit = async (name: string, message: string, deleted: boolean) => {
    const rel = `${MEDIA_DIR}/${name}`;
    try {
      await exec("git", ["-C", root, deleted ? "rm" : "add", "--", rel]);
      await exec("git", ["-C", root, "commit", "-q", "--no-verify", "-m", message, "--", rel]);
    } catch {
      /* not a repo / git absent → no history, no error */
    }
  };

  return {
    backend: "fs",

    async list() {
      let names: string[];
      try {
        names = await readdir(dir);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw err;
      }
      const out: MediaEntry[] = [];
      for (const name of names.sort()) {
        try {
          assertMediaFileName(name);
        } catch {
          continue; // a stray non-media file in the folder is not ours to list
        }
        const s = await stat(join(dir, name));
        out.push({ name, path: mediaWebPath(name), size: s.size });
      }
      return out;
    },

    async save(name, bytes) {
      const abs = toAbs(name);
      await mkdir(dir, { recursive: true });
      const tmp = `${abs}.tmp-${process.pid}-${Date.now()}`;
      await writeFile(tmp, bytes);
      await rename(tmp, abs);
      await tryCommit(name, `builder: upload media ${name}`, false);
      return { name, path: mediaWebPath(name), size: bytes.byteLength };
    },

    async remove(name) {
      const abs = toAbs(name);
      await rm(abs, { force: true });
      await tryCommit(name, `builder: delete media ${name}`, true);
    },
  };
}

// ── GitHub contents API ─────────────────────────────────────
export interface GithubMediaConfig {
  repo: string; // "owner/repo"
  token: string;
  branch?: string;
}

const API = "https://api.github.com";

export function createGithubMediaStore(
  config: GithubMediaConfig,
  fetchImpl: typeof fetch = fetch
): MediaStore {
  if (!/^[\w.-]+\/[\w.-]+$/.test(config.repo)) {
    throw new Error(`BUILDER_GITHUB_REPO must be "owner/repo", got "${config.repo}"`);
  }
  const branch = config.branch || "main";
  const base = `${API}/repos/${config.repo}/contents/${MEDIA_DIR}`;
  const headers = {
    Authorization: `Bearer ${config.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "lusik-builder",
  };

  async function getSha(name: string): Promise<string | null> {
    const res = await fetchImpl(`${base}/${name}?ref=${encodeURIComponent(branch)}`, { headers });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub read failed (${res.status})`);
    return ((await res.json()) as { sha: string }).sha;
  }

  return {
    backend: "github",

    async list() {
      const res = await fetchImpl(`${base}?ref=${encodeURIComponent(branch)}`, { headers });
      if (res.status === 404) return []; // directory doesn't exist yet
      if (!res.ok) throw new Error(`GitHub list failed (${res.status})`);
      const entries = (await res.json()) as Array<{ type: string; name: string; size: number }>;
      return entries
        .filter((e) => {
          if (e.type !== "file") return false;
          try {
            assertMediaFileName(e.name);
            return true;
          } catch {
            return false;
          }
        })
        .map((e) => ({ name: e.name, path: mediaWebPath(e.name), size: e.size }));
    },

    async save(name, bytes) {
      assertMediaFileName(name);
      const sha = await getSha(name); // overwrite needs the previous sha
      const res = await fetchImpl(`${base}/${name}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `builder: upload media ${name}`,
          content: Buffer.from(bytes).toString("base64"),
          branch,
          ...(sha ? { sha } : {}),
        }),
      });
      if (!res.ok) throw new Error(`GitHub upload failed (${res.status})`);
      return { name, path: mediaWebPath(name), size: bytes.byteLength };
    },

    async remove(name) {
      assertMediaFileName(name);
      const sha = await getSha(name);
      if (!sha) return; // already gone — same no-op contract as document remove
      const res = await fetchImpl(`${base}/${name}`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ message: `builder: delete media ${name}`, sha, branch }),
      });
      if (!res.ok) throw new Error(`GitHub delete failed (${res.status})`);
    },
  };
}

/** Pick the adapter from the environment — same resolution as getBuilderStorage. */
export function getMediaStore(env: NodeJS.ProcessEnv = process.env): MediaStore {
  const repo = env.BUILDER_GITHUB_REPO ?? "";
  const token = env.BUILDER_GITHUB_TOKEN ?? "";
  const backend = env.BUILDER_BACKEND ?? (repo && token ? "github" : "fs");
  if (backend === "github") {
    if (!repo || !token) {
      throw new Error("BUILDER_BACKEND=github requires BUILDER_GITHUB_REPO and BUILDER_GITHUB_TOKEN");
    }
    return createGithubMediaStore({ repo, token, branch: env.BUILDER_GITHUB_BRANCH });
  }
  if (backend !== "fs") {
    throw new Error(`Unknown BUILDER_BACKEND "${backend}" (expected "fs" or "github")`);
  }
  return createFsMediaStore();
}
