// ============================================================
// Backup & restore (Phase 12) — durability in both modes
// ============================================================
// Backup = every document (builder/** + content/**) read through
// the storage adapter — so it works identically on a thumb drive
// and on the hosted GitHub backend — zipped with a manifest.
//
// Restore is ALL-OR-NOTHING: every entry is path-checked and
// runs the same validateDocument gate as a manual save; one bad
// file and NOTHING is written. A backup can't half-apply.
// ============================================================

import type { BuilderStorage } from "../storage/index.ts";
import { assertDocPath, DocPathError } from "../storage/paths.ts";
import { validateDocument, type DocIssue } from "./validateDoc.ts";
import type { ZipEntry } from "./zip.ts";

export async function collectAllDocs(storage: BuilderStorage): Promise<ZipEntry[]> {
  const files: ZipEntry[] = [];
  for (const root of ["builder", "content"]) {
    for (const path of await storage.list(root)) {
      const content = await storage.read(path);
      if (content !== null) files.push({ path, content });
    }
  }
  return files;
}

export interface RestoreReport {
  ok: boolean;
  written: string[];
  problems: Array<{ path: string; issues: DocIssue[] }>;
}

export async function restoreDocs(storage: BuilderStorage, entries: ZipEntry[]): Promise<RestoreReport> {
  const docs = entries.filter((e) => e.path.endsWith(".json") && e.path !== "backup-manifest.json");
  const problems: RestoreReport["problems"] = [];

  // Phase 1: validate EVERYTHING before writing ANYTHING.
  const validated: Array<{ path: string; content: unknown }> = [];
  for (const entry of docs) {
    try {
      assertDocPath(entry.path);
      const content = JSON.parse(entry.content);
      const issues = await validateDocument(entry.path, content);
      if (issues.length > 0) problems.push({ path: entry.path, issues });
      else validated.push({ path: entry.path, content });
    } catch (err) {
      problems.push({
        path: entry.path,
        issues: [{
          level: "error",
          code: err instanceof DocPathError ? "bad_path" : "bad_json",
          message: err instanceof Error ? err.message : String(err),
        }],
      });
    }
  }
  if (problems.length > 0) return { ok: false, written: [], problems };

  // Phase 2: write.
  const written: string[] = [];
  for (const doc of validated) {
    await storage.write(doc.path, JSON.stringify(doc.content, null, 2) + "\n", `builder: restore ${doc.path}`);
    written.push(doc.path);
  }
  return { ok: true, written, problems: [] };
}
