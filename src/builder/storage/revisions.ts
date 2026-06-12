// ============================================================
// Revision history (Phase 12) — "git IS the revision store"
// ============================================================
// The plan's §4 promise made real: every publish is a commit, so
// history/rollback read the commit log rather than a second
// versioning database.
//
//   fs mode     → the local repo's git CLI (the thumb drive's
//                 history travels in .git)
//   github mode → the commits API (same shape out)
//
// Restoring a revision is NOT a direct write: the UI loads the
// old content into the editor as a dirty draft, and saving runs
// the normal validation gate — a years-old document still can't
// bypass today's rules.
// ============================================================

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { assertDocPath } from "./paths.ts";
import type { GithubStorageConfig } from "./github.ts";

const exec = promisify(execFile);

export interface RevisionInfo {
  sha: string;
  date: string;
  author: string;
  message: string;
}

export interface RevisionSource {
  list(path: string, limit?: number): Promise<RevisionInfo[]>;
  read(path: string, sha: string): Promise<string | null>;
}

// ── fs mode: the local git CLI ──────────────────────────────
export function createGitCliRevisions(rootDir: string = process.cwd()): RevisionSource {
  return {
    async list(path, limit = 20) {
      assertDocPath(path);
      try {
        const { stdout } = await exec(
          "git",
          ["-C", rootDir, "log", `-${limit}`, "--format=%H%x1f%aI%x1f%an%x1f%s", "--", path],
          { maxBuffer: 1024 * 1024 }
        );
        return stdout
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const [sha, date, author, message] = line.split("\x1f");
            return { sha, date, author, message };
          });
      } catch {
        return []; // not a git repo / git unavailable → empty history, not an error
      }
    },
    async read(path, sha) {
      assertDocPath(path);
      if (!/^[0-9a-f]{7,40}$/i.test(sha)) return null;
      try {
        const { stdout } = await exec("git", ["-C", rootDir, "show", `${sha}:${path}`], {
          maxBuffer: 4 * 1024 * 1024,
        });
        return stdout;
      } catch {
        return null;
      }
    },
  };
}

// ── github mode: the commits API ────────────────────────────
export function createGithubRevisions(
  config: GithubStorageConfig,
  fetchImpl: typeof fetch = fetch
): RevisionSource {
  const branch = config.branch || "main";
  const headers = {
    Authorization: `Bearer ${config.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "lusik-builder",
  };
  return {
    async list(path, limit = 20) {
      assertDocPath(path);
      const url = `https://api.github.com/repos/${config.repo}/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(branch)}&per_page=${limit}`;
      const res = await fetchImpl(url, { headers });
      if (!res.ok) return [];
      const commits = (await res.json()) as Array<{
        sha: string;
        commit: { author?: { date?: string; name?: string }; message: string };
      }>;
      return commits.map((c) => ({
        sha: c.sha,
        date: c.commit.author?.date ?? "",
        author: c.commit.author?.name ?? "",
        message: c.commit.message.split("\n")[0],
      }));
    },
    async read(path, sha) {
      assertDocPath(path);
      if (!/^[0-9a-f]{7,40}$/i.test(sha)) return null;
      const url = `https://api.github.com/repos/${config.repo}/contents/${path}?ref=${encodeURIComponent(sha)}`;
      const res = await fetchImpl(url, { headers });
      if (!res.ok) return null;
      const body = (await res.json()) as { content?: string };
      return typeof body.content === "string" ? Buffer.from(body.content, "base64").toString("utf8") : null;
    },
  };
}

/** Pick the revision source matching the active storage backend. */
export function getRevisionSource(env: NodeJS.ProcessEnv = process.env): RevisionSource {
  const repo = env.BUILDER_GITHUB_REPO ?? "";
  const token = env.BUILDER_GITHUB_TOKEN ?? "";
  const backend = env.BUILDER_BACKEND ?? (repo && token ? "github" : "fs");
  if (backend === "github" && repo && token) {
    return createGithubRevisions({ repo, token, branch: env.BUILDER_GITHUB_BRANCH });
  }
  return createGitCliRevisions();
}
