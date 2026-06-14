// ============================================================
// Export — the package manifest (plan §10: "the contract")
// ============================================================

import { createHash } from "node:crypto";
import { CURRENT_SCHEMA_VERSION, type Block } from "../schema/index.ts";

export interface ExportManifest {
  format: "lusik-builder-export";
  formatVersion: 1;
  schemaVersion: number;
  target: "static" | "next" | "pwa" | "swiftui" | "twa" | "deck";
  createdAt: string;
  pages: number;
  blockTypesUsed: string[];
  files: Array<{ path: string; sha256: string; bytes: number }>;
}

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function collectBlockTypes(sections: Block[], into = new Set<string>()): Set<string> {
  for (const b of sections) {
    into.add(b.type);
    if (b.children) collectBlockTypes(b.children, into);
  }
  return into;
}

export function buildManifest(
  target: ExportManifest["target"],
  pages: Array<{ sections: Block[] }>,
  files: Array<{ path: string; content: string | Buffer }>
): ExportManifest {
  const types = new Set<string>();
  for (const p of pages) collectBlockTypes(p.sections, types);
  return {
    format: "lusik-builder-export",
    formatVersion: 1,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    target,
    createdAt: new Date().toISOString(),
    pages: pages.length,
    blockTypesUsed: [...types].sort(),
    files: files.map((f) => ({
      path: f.path,
      sha256: sha256(f.content),
      bytes: Buffer.byteLength(f.content),
    })),
  };
}
