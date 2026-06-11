// ============================================================
// Builder engine — document validation
// ============================================================
// The publish gate's core. validatePage() runs migration + zod
// schema validation, then the cross-cutting rules a per-field
// schema can't see (duplicate ids, a11y, dead-page warnings).
// Errors block publish; warnings surface in the editor.
//
// Later phases register more rules here (tap targets, fixed-
// element collisions, theme contrast) — the ValidationIssue
// shape is the contract the editor UI renders.
// ============================================================

import { pageSchema, type Page } from "../schema/documents.ts";
import { migrateDocument, SchemaVersionError } from "../schema/migrate.ts";
import type { Block } from "../schema/block.ts";
import { collectIds } from "./tree.ts";

export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  blockId?: string;
  path?: string;
}

export interface ValidatePageResult {
  page: Page | null;
  issues: ValidationIssue[];
  /** True when nothing at "error" level — drafts may save with warnings. */
  publishable: boolean;
}

export function validatePage(raw: unknown): ValidatePageResult {
  const issues: ValidationIssue[] = [];

  let migrated: unknown;
  try {
    migrated = migrateDocument(raw);
  } catch (err) {
    issues.push({
      level: "error",
      code: err instanceof SchemaVersionError ? "schema_version" : "malformed",
      message: err instanceof Error ? err.message : String(err),
    });
    return { page: null, issues, publishable: false };
  }

  const parsed = pageSchema.safeParse(migrated);
  if (!parsed.success) {
    for (const zi of parsed.error.issues) {
      issues.push({
        level: "error",
        code: "schema",
        message: zi.message,
        path: zi.path.join("."),
      });
    }
    return { page: null, issues, publishable: false };
  }

  const page = parsed.data;
  checkDuplicateIds(page.sections, issues);
  checkImageAlt(page.sections, issues);
  checkHiddenEverywhere(page.sections, issues);
  if (page.sections.length === 0) {
    issues.push({ level: "warning", code: "empty_page", message: "Page has no sections" });
  }

  const publishable = !issues.some((i) => i.level === "error");
  return { page, issues, publishable };
}

function checkDuplicateIds(blocks: Block[], issues: ValidationIssue[]): void {
  const seen = new Set<string>();
  for (const id of collectIds(blocks)) {
    if (seen.has(id)) {
      issues.push({
        level: "error",
        code: "duplicate_id",
        message: `Duplicate block id ${id} — overrides and edits would be ambiguous`,
        blockId: id,
      });
    }
    seen.add(id);
  }
}

// a11y: images need alt text unless explicitly marked decorative.
// (Schema allows alt:"" so the editor can save drafts; publish doesn't.)
function checkImageAlt(blocks: Block[], issues: ValidationIssue[]): void {
  walk(blocks, (b) => {
    if (b.type !== "image") return;
    const alt = b.props.alt;
    const decorative = b.props.decorative === true;
    if (!decorative && (typeof alt !== "string" || alt.trim() === "")) {
      issues.push({
        level: "error",
        code: "image_alt",
        message: "Image needs alt text (or mark it decorative)",
        blockId: b.id,
      });
    }
  });
}

function checkHiddenEverywhere(blocks: Block[], issues: ValidationIssue[]): void {
  walk(blocks, (b) => {
    const v = b.visibility;
    if (v && v.desktop === false && v.tablet === false && v.mobile === false) {
      issues.push({
        level: "warning",
        code: "hidden_everywhere",
        message: `Block ${b.id} is hidden on every device — delete it instead?`,
        blockId: b.id,
      });
    }
  });
}

function walk(blocks: Block[], visit: (b: Block) => void): void {
  for (const b of blocks) {
    visit(b);
    if (b.children) walk(b.children, visit);
  }
}
