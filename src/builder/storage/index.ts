// Builder storage — public surface + backend resolution.

import type { BuilderStorage } from "./types.ts";
import { createFsStorage } from "./fs.ts";
import { createGithubStorage } from "./github.ts";

export type { BuilderStorage, BuilderBackend } from "./types.ts";
export { createFsStorage } from "./fs.ts";
export { createGithubStorage, type GithubStorageConfig } from "./github.ts";
export { assertDocPath, assertDocDir, DocPathError, DOC_ROOT } from "./paths.ts";

/**
 * Pick the adapter from the environment.
 *   BUILDER_BACKEND=fs      → filesystem (dev / home server / thumb drive)
 *   BUILDER_BACKEND=github  → GitHub contents API (Netlify / cloud hosts)
 * Unset: github when BUILDER_GITHUB_REPO+TOKEN are configured, else fs —
 * so `next dev` Just Works locally and the hosted site Just Works once
 * the two env vars are set.
 */
export function getBuilderStorage(env: NodeJS.ProcessEnv = process.env): BuilderStorage {
  const repo = env.BUILDER_GITHUB_REPO ?? "";
  const token = env.BUILDER_GITHUB_TOKEN ?? "";
  const backend = env.BUILDER_BACKEND ?? (repo && token ? "github" : "fs");

  if (backend === "github") {
    if (!repo || !token) {
      throw new Error("BUILDER_BACKEND=github requires BUILDER_GITHUB_REPO and BUILDER_GITHUB_TOKEN");
    }
    return createGithubStorage({ repo, token, branch: env.BUILDER_GITHUB_BRANCH });
  }
  if (backend !== "fs") {
    throw new Error(`Unknown BUILDER_BACKEND "${backend}" (expected "fs" or "github")`);
  }
  return createFsStorage();
}
