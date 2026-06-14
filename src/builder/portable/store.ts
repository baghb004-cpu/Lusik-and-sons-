// ============================================================
// Portable environment — the local store (server-only)
// ============================================================
// Plain JSON files under <root>/portable/. Same safety habits as
// document storage (single gated segments, atomic tmp+rename
// writes, resolved-path containment) but deliberately OUTSIDE the
// git document roots: quick saves and XP ticks shouldn't write
// history, and this folder IS the user's private data directory
// ("keep everything inside the portable environment folder").
// ============================================================

import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

export const PORTABLE_DIR = "portable";

/** The folders the environment initializes on first run. */
export const PORTABLE_SKELETON = [
  "profiles",
  "quicksaves",
  "backups",
  "licenses",
  "retro/library",
  "retro/emulator-profiles",
  "retro/controller-profiles",
  "retro/emulators/dosbox-x",
  "retro/emulators/86box",
  "retro/emulators/qemu",
  "retro/backups",
  "retro/user-media/isos",
  "retro/user-media/covers",
  "retro/vm-images",
  "retro/save-data",
  "retro/screenshots",
  "retro/logs",
] as const;

const SEGMENT_RE = /^[a-z0-9][a-z0-9._-]*$/i;

export class PortablePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortablePathError";
  }
}

export interface PortableStore {
  root: string;
  init(): Promise<void>;
  /** Read a JSON file under portable/ (null when absent). */
  read(rel: string): Promise<string | null>;
  write(rel: string, content: string): Promise<void>;
  remove(rel: string): Promise<void>;
  /** List .json files directly inside a portable/ subdirectory. */
  list(relDir: string): Promise<string[]>;
}

export function createPortableStore(rootDir: string = process.cwd()): PortableStore {
  const base = join(resolve(rootDir), PORTABLE_DIR);

  const toAbs = (rel: string, mustBeJson = true): string => {
    if (typeof rel !== "string" || rel.length === 0 || rel.length > 200 || rel.includes("\\") || rel.startsWith("/")) {
      throw new PortablePathError(`Bad portable path: ${String(rel).slice(0, 60)}`);
    }
    const segments = rel.split("/");
    for (const seg of segments) {
      if (seg === "." || seg === ".." || !SEGMENT_RE.test(seg)) {
        throw new PortablePathError(`Bad portable path segment: "${seg}"`);
      }
    }
    if (mustBeJson && !rel.endsWith(".json")) {
      throw new PortablePathError("Portable documents are .json files");
    }
    const abs = resolve(base, rel);
    if (!abs.startsWith(base + sep)) {
      throw new PortablePathError(`Path escapes portable/: ${rel}`);
    }
    return abs;
  };

  return {
    root: base,

    async init() {
      for (const dir of PORTABLE_SKELETON) {
        await mkdir(join(base, dir), { recursive: true });
      }
    },

    async read(rel) {
      try {
        return await readFile(toAbs(rel), "utf8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },

    async write(rel, content) {
      const abs = toAbs(rel);
      await mkdir(join(abs, ".."), { recursive: true });
      const tmp = `${abs}.tmp-${process.pid}-${Date.now()}`;
      await writeFile(tmp, content, "utf8");
      await rename(tmp, abs);
    },

    async remove(rel) {
      await rm(toAbs(rel), { force: true });
    },

    async list(relDir) {
      const abs = toAbs(`${relDir}/x.json`).slice(0, -7); // gate the dir via a probe path
      try {
        return (await readdir(abs)).filter((f) => f.endsWith(".json")).sort();
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw err;
      }
    },
  };
}
