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
  checkPillNav(page.sections, issues);
  checkSectionJumper(page.sections, issues);
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

// Pill-menu publish rules (plan §6): exactly one per page, top-level
// only (a pill inside a drawer/column is a layout accident), and it
// shouldn't share an edge with another fixed-position pill. The
// geometric checkout/ATC collision check is the editor's hit-box
// overlay; these are the structural rules a document alone can prove.
function checkPillNav(blocks: Block[], issues: ValidationIssue[]): void {
  const all: Block[] = [];
  walk(blocks, (b) => {
    if (b.type === "pillNav") all.push(b);
  });
  if (all.length === 0) return;

  if (all.length > 1) {
    for (const b of all.slice(1)) {
      issues.push({
        level: "error",
        code: "pill_multiple",
        message: "Only one pill menu per page — two fixed navs would fight for the same thumb space",
        blockId: b.id,
      });
    }
  }
  const topLevelIds = new Set(blocks.map((b) => b.id));
  for (const b of all) {
    if (!topLevelIds.has(b.id)) {
      issues.push({
        level: "error",
        code: "pill_nested",
        message: "The pill menu must be a top-level block — inside a container its fixed positioning escapes the layout",
        blockId: b.id,
      });
    }
    if (b.visibility?.mobile === false) {
      issues.push({
        level: "warning",
        code: "pill_hidden_mobile",
        message: "This pill menu is hidden on mobile — phones are what it exists for",
        blockId: b.id,
      });
    }
  }
}

// Section-jumper publish rules (plan §18): like the pill menu it's a
// fixed-position singleton — two sets of floating arrows would overlap,
// and inside a container its fixed positioning escapes the layout. It
// also needs sections to hop between, so a one-section page gets a
// warning (the buttons would only bounce between top and bottom).
function checkSectionJumper(blocks: Block[], issues: ValidationIssue[]): void {
  const all: Block[] = [];
  walk(blocks, (b) => {
    if (b.type === "sectionJumper") all.push(b);
  });
  if (all.length === 0) return;

  if (all.length > 1) {
    for (const b of all.slice(1)) {
      issues.push({
        level: "error",
        code: "jumper_multiple",
        message: "Only one section jumper per page — two sets of floating arrows would stack on the same edge",
        blockId: b.id,
      });
    }
  }
  const topLevelIds = new Set(blocks.map((b) => b.id));
  const sectionCount = blocks.filter((b) => b.type === "section").length;
  for (const b of all) {
    if (!topLevelIds.has(b.id)) {
      issues.push({
        level: "error",
        code: "jumper_nested",
        message: "The section jumper must be a top-level block — inside a container its fixed positioning escapes the layout",
        blockId: b.id,
      });
    }
  }
  if (sectionCount < 2) {
    issues.push({
      level: "warning",
      code: "jumper_few_sections",
      message: "The section jumper hops between sections — this page has fewer than two, so the arrows have nowhere to go",
      blockId: all[0].id,
    });
  }
}

function walk(blocks: Block[], visit: (b: Block) => void): void {
  for (const b of blocks) {
    visit(b);
    if (b.children) walk(b.children, visit);
  }
}
