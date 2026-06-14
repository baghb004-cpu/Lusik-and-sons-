// ============================================================
// Preset apply engine — rules → override patches
// ============================================================
// "Apply This Layout Preset" turns a viewport's recommended rules
// into edits the builder actually ships:
//   - desktop preset → edits the BASE document (desktop is base)
//   - mobile/tablet preset → writes sparse patches into that
//     breakpoint's OVERRIDE LAYER (the Phase 7 mechanism)
//
// It only ever turns knobs the schema already exposes (grid
// columns, spacing, tap-target height, pill-nav position) — it
// never restructures content, never touches protected zones. Pure:
// returns the next sections and/or the next layer; the caller
// commits them through the normal save path (which re-gates).
// ============================================================

import { updateBlock } from "../engine/index.ts";
import { setOverridePatch, emptyLayer } from "../engine/overrides.ts";
import type { Block, OverrideLayer, Page } from "../schema/index.ts";
import { layoutRulesFor, type LayoutRules } from "./adaptiveLayoutRules.ts";
import type { ViewportPreset } from "./viewportPresets.ts";

export interface ApplyResult {
  /** Present when a desktop preset edited the base document. */
  sections?: Block[];
  /** Present when a mobile/tablet preset wrote an override layer. */
  layer?: OverrideLayer;
  breakpoint: LayoutRules["breakpoint"];
  /** Human summary of what changed, for the status line. */
  changes: string[];
}

// Block max columns, mirrored from the schemas so we never exceed them.
const MAX_COLUMNS: Record<string, number> = { columns: 4, productGrid: 4, gallery: 4 };

function collectGridEdits(sections: Block[], targetColumns: number): Array<{ id: string; columns: number }> {
  const edits: Array<{ id: string; columns: number }> = [];
  const walk = (blocks: Block[]) => {
    for (const b of blocks) {
      if (b.type === "productGrid" || b.type === "gallery" || b.type === "columns") {
        const cap = MAX_COLUMNS[b.type] ?? 4;
        const current = Number((b.props as { columns?: number; count?: number }).columns ?? (b.props as { count?: number }).count ?? 0);
        const next = Math.min(targetColumns, cap);
        if (next >= 1 && next !== current) edits.push({ id: b.id, columns: next });
      }
      if (b.children) walk(b.children);
    }
  };
  walk(sections);
  return edits;
}

export function applyPreset(page: Page, layers: Record<"tablet" | "mobile", OverrideLayer>, preset: ViewportPreset): ApplyResult {
  const rules = layoutRulesFor(preset);
  const changes: string[] = [];
  const gridEdits = collectGridEdits(page.sections, rules.columns);

  if (rules.breakpoint === "desktop") {
    // Edit the base document directly (desktop is the base layer).
    let sections = page.sections;
    for (const e of gridEdits) {
      sections = updateBlock(sections, e.id, (b) => {
        const key = b.type === "columns" ? "count" : "columns";
        return { ...b, props: { ...b.props, [key]: e.columns } };
      });
      changes.push(`${e.id} → ${e.columns} columns`);
    }
    if (changes.length === 0) changes.push("already optimal for this screen");
    return { sections, breakpoint: "desktop", changes };
  }

  // mobile / tablet → write into the override layer.
  const bp = rules.breakpoint;
  let layer = layers[bp] ?? emptyLayer(page.id, bp);

  for (const e of gridEdits) {
    const key = page.sections && findType(page.sections, e.id) === "columns" ? "count" : "columns";
    layer = setOverridePatch(layer, e.id, { props: { [key]: e.columns } });
    changes.push(`${e.id} → ${e.columns} columns on ${bp}`);
  }

  // Reduce vertical spacing on short screens (spacingScale < 1) for sections.
  if (rules.spacingScale < 1) {
    const tighten = `${Math.round(12 * rules.spacingScale)}px`;
    for (const b of page.sections) {
      layer = setOverridePatch(layer, b.id, { style: { margin: { top: tighten, bottom: tighten } } });
    }
    changes.push(`tighter vertical spacing on ${bp}`);
  }

  if (changes.length === 0) changes.push("already optimal for this screen");
  return { layer, breakpoint: bp, changes };
}

function findType(blocks: Block[], id: string): string | null {
  for (const b of blocks) {
    if (b.id === id) return b.type;
    if (b.children) {
      const hit = findType(b.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

/** "Generate Responsive Fixes": map fixable issues to an apply (currently
 *  the same column/spacing normalization the apply engine performs). */
export function generateFixes(page: Page, layers: Record<"tablet" | "mobile", OverrideLayer>, preset: ViewportPreset): ApplyResult {
  return applyPreset(page, layers, preset);
}
