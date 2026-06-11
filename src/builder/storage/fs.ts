// ============================================================
// Builder storage — filesystem adapter (server-only)
// ============================================================
// Thumb-drive / home-server / `next dev` mode: documents are
// plain JSON files under <repo>/builder. assertDocPath has
// already constrained shapes; the resolved-path check below is
// defense-in-depth so even a future paths.ts bug can't escape
// the document root.
// ============================================================

import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

import type { BuilderStorage } from "./types.ts";
import { assertDocDir, assertDocPath, DocPathError } from "./paths.ts";

export function createFsStorage(rootDir: string = process.cwd()): BuilderStorage {
  const root = resolve(rootDir);

  const toAbs = (relPath: string): string => {
    const abs = resolve(root, relPath);
    if (abs !== join(root, "builder") && !abs.startsWith(join(root, "builder") + sep)) {
      throw new DocPathError(`Path escapes the document root: ${relPath}`);
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

    async write(path, content, _message) {
      assertDocPath(path);
      const abs = toAbs(path);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, content, "utf8");
    },

    async remove(path, _message) {
      assertDocPath(path);
      await rm(toAbs(path), { force: true });
    },
  };
}
