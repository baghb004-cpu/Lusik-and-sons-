// ============================================================
// Business App Builder — offline vibe parser (§30, Phase 3)
// ============================================================
// Plain English → the closest app template (no cloud AI). Returns the
// blueprint + notes; unclear input falls back to a generic records app
// and says so.
// ============================================================

import type { AppBlueprint } from "./schemas.ts";
import { makeAppTemplate, APP_TEMPLATE_LIST } from "./templates.ts";
import { appBlueprintSchema } from "./schemas.ts";
import { deriveScreens } from "./engine.ts";

const KEY_WORDS: Array<[string, string[]]> = [
  ["appointments", ["appointment", "booking", "schedule", "calendar"]],
  ["repair", ["repair", "fix", "ticket", "device", "shop tracker"]],
  ["quotes", ["quote", "estimate", "invoice", "proposal"]],
  ["crm", ["crm", "contact", "lead", "follow up", "follow-up"]],
  ["orders", ["order", "fulfillment", "delivery"]],
  ["inventory", ["inventory", "stock", "product", "barcode", "sku"]],
];

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9 -]/g, " ").replace(/\s+/g, " ")} `;
const has = (h: string, k: string) => h.includes(` ${k} `) || h.includes(`${k} `) || h.includes(` ${k}`);

export function detectAppType(text: string): string | null {
  const h = norm(text);
  for (const [key, words] of KEY_WORDS) for (const w of words) if (has(h, w)) return key;
  return null;
}

export interface AppVibe { blueprint: AppBlueprint; notes: string[] }

export function vibeApp(text: string): AppVibe {
  const key = detectAppType(text);
  if (key) {
    const bp = makeAppTemplate(key)!;
    return { blueprint: bp, notes: [`Started a ${bp.name}. Edit the fields, then export.`] };
  }
  // generic single-table app
  const tables = [{ id: "records", name: "Records", fields: [{ name: "title", label: "title", type: "text" as const, required: true, options: [], relationTableId: "" }, { name: "date", label: "date", type: "date" as const, required: false, options: [], relationTableId: "" }, { name: "notes", label: "notes", type: "longtext" as const, required: false, options: [], relationTableId: "" }] }];
  const bp = appBlueprintSchema.parse({ id: `app-${Date.now()}`, name: "Records App", description: text.slice(0, 120), tables, screens: deriveScreens(tables) });
  return { blueprint: bp, notes: ["I couldn't match a specific app type, so I started a simple records app — add tables/fields, or pick a template.", `Templates: ${APP_TEMPLATE_LIST.map((t) => t.name).join(", ")}.`] };
}
