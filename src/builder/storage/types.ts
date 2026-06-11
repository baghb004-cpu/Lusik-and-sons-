// ============================================================
// Builder storage — the adapter contract
// ============================================================
// One interface, two implementations (plan §3):
//
//   fs      — dev server, home server, thumb drive. Documents are
//             plain files in the working tree; committing/backup
//             is local git (the Phase 4 publish pipeline adds the
//             auto-commit).
//   github  — Netlify or any cloud host, where the deployed app
//             has no writable repo checkout. Reads and writes go
//             through the GitHub contents API; every write IS a
//             commit, which is what triggers the normal gated
//             build → deploy.
//
// The engine and the editor never know which one is underneath —
// that indirection is the portability story.
// ============================================================

export type BuilderBackend = "fs" | "github";

export interface BuilderStorage {
  readonly backend: BuilderBackend;
  /** Recursively list .json document paths under a builder/ directory. */
  list(dir: string): Promise<string[]>;
  /** Raw document text, or null if it doesn't exist. */
  read(path: string): Promise<string | null>;
  /** Create or replace a document. `message` becomes the commit message where applicable. */
  write(path: string, content: string, message: string): Promise<void>;
  /** Delete a document. No-op if absent. */
  remove(path: string, message: string): Promise<void>;
}
