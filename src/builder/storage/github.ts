// ============================================================
// Builder storage — GitHub contents-API adapter (server-only)
// ============================================================
// Hosted mode (Netlify or any cloud host): the deployed app has
// no writable repo checkout, so documents read/write through the
// GitHub API. Every write is a commit on the configured branch —
// which is exactly what triggers the normal gated build, so a
// builder publish rides the same validation + deploy pipeline as
// a hand-made PR.
//
// Config (server env):
//   BUILDER_GITHUB_REPO    "owner/repo"            (required)
//   BUILDER_GITHUB_TOKEN   fine-grained PAT with contents:write
//                          scoped to that one repo  (required)
//   BUILDER_GITHUB_BRANCH  default "main" — point it at a drafts
//                          branch to get PR-style editorial flow
//
// `fetchImpl` is injectable for unit tests.
// ============================================================

import type { BuilderStorage } from "./types.ts";
import { assertDocDir, assertDocPath } from "./paths.ts";

export interface GithubStorageConfig {
  repo: string; // "owner/repo"
  token: string;
  branch?: string;
}

const API = "https://api.github.com";

export function createGithubStorage(
  config: GithubStorageConfig,
  fetchImpl: typeof fetch = fetch
): BuilderStorage {
  if (!/^[\w.-]+\/[\w.-]+$/.test(config.repo)) {
    throw new Error(`BUILDER_GITHUB_REPO must be "owner/repo", got "${config.repo}"`);
  }
  const branch = config.branch || "main";
  const base = `${API}/repos/${config.repo}/contents`;

  const headers = {
    Authorization: `Bearer ${config.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "lusik-builder",
  };

  async function getEntry(path: string): Promise<{ sha: string; content?: string } | null> {
    const res = await fetchImpl(`${base}/${path}?ref=${encodeURIComponent(branch)}`, { headers });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub read failed (${res.status}) for ${path}`);
    const body = (await res.json()) as { sha: string; content?: string; encoding?: string };
    return body;
  }

  return {
    backend: "github",

    async list(dir) {
      assertDocDir(dir);
      const out: string[] = [];
      const walk = async (rel: string): Promise<void> => {
        const res = await fetchImpl(`${base}/${rel}?ref=${encodeURIComponent(branch)}`, { headers });
        if (res.status === 404) return;
        if (!res.ok) throw new Error(`GitHub list failed (${res.status}) for ${rel}`);
        const entries = (await res.json()) as Array<{ type: string; path: string; name: string }>;
        if (!Array.isArray(entries)) return; // a file, not a directory
        for (const e of entries) {
          if (e.type === "dir") await walk(e.path);
          else if (e.type === "file" && e.name.endsWith(".json")) out.push(e.path);
        }
      };
      await walk(dir);
      return out.sort();
    },

    async read(path) {
      assertDocPath(path);
      const entry = await getEntry(path);
      if (!entry || typeof entry.content !== "string") return null;
      return Buffer.from(entry.content, "base64").toString("utf8");
    },

    async write(path, content, message) {
      assertDocPath(path);
      const existing = await getEntry(path);
      const res = await fetchImpl(`${base}/${path}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message,
          branch,
          content: Buffer.from(content, "utf8").toString("base64"),
          ...(existing ? { sha: existing.sha } : {}),
        }),
      });
      if (!res.ok) throw new Error(`GitHub write failed (${res.status}) for ${path}`);
    },

    async remove(path, message) {
      assertDocPath(path);
      const existing = await getEntry(path);
      if (!existing) return;
      const res = await fetchImpl(`${base}/${path}`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ message, branch, sha: existing.sha }),
      });
      if (!res.ok) throw new Error(`GitHub delete failed (${res.status}) for ${path}`);
    },
  };
}
