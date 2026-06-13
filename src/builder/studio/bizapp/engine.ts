// ============================================================
// Business App Builder — pure helpers (§30, Phase 3)
// ============================================================
// Auto-derive the screen set from the tables (a dashboard + list/form/
// detail per table) and validate a blueprint. Pure + tested.
// ============================================================

import type { AppBlueprint, Table, Screen } from "./schemas.ts";

/** Standard screens for a set of tables: one dashboard + list/form/detail each. */
export function deriveScreens(tables: Table[]): Screen[] {
  const screens: Screen[] = [{ id: "dashboard", type: "dashboard", title: "Dashboard", tableId: "" }];
  for (const t of tables) {
    screens.push({ id: `${t.id}-list`, type: "list", title: t.name, tableId: t.id });
    screens.push({ id: `${t.id}-form`, type: "form", title: `Add / edit ${singular(t.name)}`, tableId: t.id });
    screens.push({ id: `${t.id}-detail`, type: "detail", title: `${singular(t.name)} details`, tableId: t.id });
  }
  return screens;
}

const singular = (s: string) => (s.endsWith("ies") ? s.slice(0, -3) + "y" : s.endsWith("s") ? s.slice(0, -1) : s);

/** Re-derive screens after the tables change. */
export function withDerivedScreens(bp: AppBlueprint): AppBlueprint {
  return { ...bp, screens: deriveScreens(bp.tables) };
}

export interface BlueprintIssue { level: "error" | "warn"; message: string }

/** Sanity-check a blueprint before export. */
export function validateBlueprint(bp: AppBlueprint): BlueprintIssue[] {
  const issues: BlueprintIssue[] = [];
  if (bp.tables.length === 0) issues.push({ level: "error", message: "Add at least one table." });
  const ids = new Set<string>();
  for (const t of bp.tables) {
    if (ids.has(t.id)) issues.push({ level: "error", message: `Duplicate table id: ${t.id}` });
    ids.add(t.id);
    if (t.fields.length === 0) issues.push({ level: "warn", message: `Table "${t.name}" has no fields.` });
    const fnames = new Set<string>();
    for (const f of t.fields) {
      const key = f.name.toLowerCase();
      if (fnames.has(key)) issues.push({ level: "error", message: `Table "${t.name}" has duplicate field "${f.name}".` });
      fnames.add(key);
      if (f.type === "select" && f.options.length === 0) issues.push({ level: "warn", message: `Select field "${f.name}" has no options.` });
      if (f.type === "relation" && !bp.tables.some((x) => x.id === f.relationTableId)) issues.push({ level: "warn", message: `Relation field "${f.name}" points to no table.` });
      if (/\b(card\s*number|cardnumber|card_no|cc\s*num|ccnumber|cvv2?|cvc2?|pan|magstripe|track\s*[12])\b/i.test(f.name)) issues.push({ level: "error", message: `Field "${f.name}" looks like payment-card data — never store that. Use an official processor.` });
    }
  }
  return issues;
}
