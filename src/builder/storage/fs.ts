// ============================================================
// Builder storage — filesystem adapter (server-only)
// ============================================================
// Thumb-drive / home-server / `next dev` mode: documents are
// plain JSON files under <repo>/builder. assertDocPath has
// already constrained shapes; the resolved-path check below is
// defense-in-depth so even a future paths.ts bug can't escape
// the document root.
// ============================================================

import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join, resolve, sep } from "node:path";

import type { BuilderStorage } from "./types.ts";
import { assertDocDir, assertDocPath, DocPathError, DOC_ROOTS } from "./paths.ts";

const exec = promisify(execFile);

export function createFsStorage(rootDir: string = process.cwd()): BuilderStorage {
  const root = resolve(rootDir);

  // Best-effort commit so the History panel works in fs/thumb-drive mode
  // too — "git is the revision store" (plan §4). No-op (swallowed) when
  // git isn't installed or the folder isn't a repo: History just stays
  // empty, exactly as before, and Backup/Restore remains the guaranteed
  // recovery path. Never blocks or fails a save.
  const tryCommit = async (relPath: string, message: string, deleted: boolean) => {
    try {
      await exec("git", ["-C", root, deleted ? "rm" : "add", "--", relPath]);
      await exec("git", ["-C", root, "commit", "-q", "--no-verify", "-m", message, "--", relPath]);
    } catch {
      /* not a git repo / git absent / nothing to commit → no history, no error */
    }
  };

  const toAbs = (relPath: string): string => {
    const abs = resolve(root, relPath);
    const contained = [...DOC_ROOTS].some(
      (docRoot) => abs === join(root, docRoot) || abs.startsWith(join(root, docRoot) + sep)
    );
    if (!contained) {
      throw new DocPathError(`Path escapes the document roots: ${relPath}`);
    }
    return abs;
  };

  return {
    backend: "fs",

    async list(dir) {
      assertDocDir(dir);
      const out: string[] = [];
      const walk = async (rel: string): Promise<void> => {
        let entries;
        try {
          entries = await readdir(toAbs(rel), { withFileTypes: true });
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
          throw err;
        }
        for (const e of entries) {
          const childRel = `${rel}/${e.name}`;
          if (e.isDirectory()) await walk(childRel);
          else if (e.isFile() && e.name.endsWith(".json")) out.push(childRel);
        }
      };
      await walk(dir);
      return out.sort();
    },

    async read(path) {
      assertDocPath(path);
      try {
        return await readFile(toAbs(path), "utf8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },

    async write(path, content, message) {
      assertDocPath(path);
      const abs = toAbs(path);
      await mkdir(dirname(abs), { recursive: true });
      // Atomic write: a yanked thumb drive mid-save can't truncate the doc —
      // the old file stays intact until the rename completes.
      const tmp = `${abs}.tmp-${process.pid}-${Date.now()}`;
      await writeFile(tmp, content, "utf8");
      await rename(tmp, abs);
      await tryCommit(path, message, false);
    },

    async remove(path, message) {
      assertDocPath(path);
      await rm(toAbs(path), { force: true });
      await tryCommit(path, message, true);
    },
  };
}
