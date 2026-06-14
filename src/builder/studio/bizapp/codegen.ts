// ============================================================
// Business App Builder — blueprint generator (pure, §30, Phase 3)
// ============================================================
// AppBlueprint → a clean, portable blueprint: app_config.json, a
// JSON-Schema file per table, a SCREENS.md, and README/PRIVACY notes.
// This is the spec a future runtime (or the Store Manager pattern) builds
// from. Offline; no payment-card fields, ever.
// ============================================================

import type { AppBlueprint, Field, Table } from "./schemas.ts";

const jsonType = (t: Field["type"]): { type: string; format?: string } => {
  switch (t) {
    case "number": case "money": return { type: "number" };
    case "bool": return { type: "boolean" };
    case "date": return { type: "string", format: "date" };
    case "time": return { type: "string", format: "time" };
    default: return { type: "string" };
  }
};

function tableJsonSchema(t: Table): string {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const f of t.fields) {
    const base = jsonType(f.type);
    properties[f.name] = f.type === "select" && f.options.length ? { ...base, enum: f.options } : f.type === "money" ? { ...base, description: "amount in cents" } : base;
    if (f.required) required.push(f.name);
  }
  return JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", title: t.name, type: "object", properties, required }, null, 2) + "\n";
}

function screensMd(bp: AppBlueprint): string {
  const lines = [`# Screens — ${bp.name}`, ""];
  for (const s of bp.screens) lines.push(`- **${s.title}** (${s.type}${s.tableId ? ` → ${s.tableId}` : ""})`);
  return lines.join("\n") + "\n";
}

export interface GeneratedApp { files: Record<string, string> }

export function generateApp(bp: AppBlueprint): GeneratedApp {
  const root = "business-app";
  const files: Record<string, string> = {
    [`${root}/app_config.json`]: JSON.stringify(bp, null, 2) + "\n",
    [`${root}/SCREENS.md`]: screensMd(bp),
    [`${root}/README.md`]: `# ${bp.name}\n\n${bp.description || "A small business app blueprint from Creation Studio."}\n\nThis folder is a **blueprint**: \`app_config.json\` plus a JSON-Schema per table under \`schema/\`, and the screen list in \`SCREENS.md\`. It defines the data + screens for an offline app (the same shape the Store Manager runs on).\n\n- Tables: ${bp.tables.map((t) => t.name).join(", ") || "—"}\n- Data retention: ${bp.retention}${bp.pinLock ? " · PIN lock on" : ""}\n`,
    [`${root}/PRIVACY_NOTES.md`]: `# Privacy\n\nThis app stores its data locally on the device unless exported, backed up, or synced. Make personal fields optional where you can; offer delete/anonymize and a retention setting.\n\nNEVER store payment card numbers, CVV/CVC, PIN, or magnetic-stripe/chip data. For payments, use an official processor (Square / Clover / Stripe). The generator refuses card-like fields.\n`,
  };
  for (const t of bp.tables) files[`${root}/schema/${t.id}.schema.json`] = tableJsonSchema(t);
  return { files };
}
