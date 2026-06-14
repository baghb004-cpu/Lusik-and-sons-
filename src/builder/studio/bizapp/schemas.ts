// ============================================================
// Creation Studio — Business App Builder data model (§30, Phase 3)
// ============================================================
// Generalizes the Store Manager into a generator: describe a small
// business tool → a blueprint of tables (typed fields) + screens, which
// exports as schema/config files. Offline, local, no card data ever.
// ============================================================

import { z } from "zod";

export const FIELD_TYPES = ["text", "longtext", "number", "money", "date", "time", "bool", "select", "relation"] as const;
export const fieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().default(""),
  type: z.enum(FIELD_TYPES).default("text"),
  required: z.boolean().default(false),
  options: z.array(z.string()).default([]), // for "select"
  relationTableId: z.string().default(""), // for "relation"
});
export type Field = z.infer<typeof fieldSchema>;

export const tableSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  fields: z.array(fieldSchema).default([]),
});
export type Table = z.infer<typeof tableSchema>;

export const SCREEN_TYPES = ["dashboard", "list", "form", "detail"] as const;
export const screenSchema = z.object({
  id: z.string().min(1),
  type: z.enum(SCREEN_TYPES),
  title: z.string().min(1),
  tableId: z.string().default(""), // empty for dashboard
});
export type Screen = z.infer<typeof screenSchema>;

export const appBlueprintSchema = z.object({
  schemaVersion: z.number().int().min(1).default(1),
  id: z.string().min(1),
  name: z.string().min(1).default("My Business App"),
  description: z.string().default(""),
  tables: z.array(tableSchema).default([]),
  screens: z.array(screenSchema).default([]),
  // privacy choices baked into the generated app's notes
  pinLock: z.boolean().default(false),
  retention: z.enum(["1y", "3y", "5y", "forever"]).default("5y"),
});
export type AppBlueprint = z.infer<typeof appBlueprintSchema>;
