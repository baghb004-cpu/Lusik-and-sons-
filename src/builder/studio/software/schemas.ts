// ============================================================
// Software Creation Mode (§31) — data model
// ============================================================
// "Visual vibe coding": drag big feature cards (presets) into a project,
// answer simple questions, preview safely, build, export. This file is the
// pure, offline, local data contract. No React, no IO, no network.
//
// A SoftwareProject lives in one localStorage key and round-trips through
// these schemas. Presets are pure metadata (see registry.ts); dropping one
// creates a FeatureInstance. Every committing change pushes a RollbackPoint.
// ============================================================

import { z } from "zod";

// --- preset taxonomy (registry rows are validated against these) ----------

export const PRESET_STATUSES = ["ready", "preview", "planned"] as const;
export type PresetStatus = (typeof PRESET_STATUSES)[number];

export const EXPORT_KINDS = [
  "thumb-drive", "static-site", "web-app", "desktop", "mobile",
  "raspberry-pi", "source", "pdf", "image", "model-3d", "database",
] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

// A simple plain-English question a preset asks when dropped.
export const presetQuestionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "longtext", "number", "bool", "choice"]).default("text"),
  required: z.boolean().default(false),
  choices: z.array(z.string()).default([]),
  help: z.string().default(""),
});
export type PresetQuestion = z.infer<typeof presetQuestionSchema>;

export const presetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),               // big, clear: "Make Pantry Labels"
  icon: z.string().min(1).default("🧩"), // big emoji on the card
  blurb: z.string().min(1),              // plain-English, explain-like-five
  categoryId: z.string().min(1),
  subcategoryId: z.string().default(""),
  status: z.enum(PRESET_STATUSES).default("planned"),
  pi: z.boolean().default(true),          // Raspberry Pi 5 friendly?
  needsData: z.boolean().default(false),  // needs a local dataset to be useful?
  exports: z.array(z.enum(EXPORT_KINDS)).default([]),
  creates: z.array(z.string()).default([]), // plain-English: what it scaffolds
  dependsOn: z.array(z.string()).default([]), // preset ids it needs present
  questions: z.array(presetQuestionSchema).default([]),
});
export type Preset = z.infer<typeof presetSchema>;

export const subcategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type Subcategory = z.infer<typeof subcategorySchema>;

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().min(1).default("📦"),
  blurb: z.string().default(""),
  subcategories: z.array(subcategorySchema).default([]),
});
export type Category = z.infer<typeof categorySchema>;

// --- project model --------------------------------------------------------

export const featureInstanceSchema = z.object({
  instanceId: z.string().min(1),
  presetId: z.string().min(1),
  label: z.string().min(1),                       // user-renamable
  options: z.record(z.string(), z.unknown()).default({}),
  addedAt: z.number().int().nonnegative().default(0),
});
export type FeatureInstance = z.infer<typeof featureInstanceSchema>;

export const rollbackPointSchema = z.object({
  id: z.string().min(1),
  at: z.number().int().nonnegative().default(0),
  reason: z.string().default(""),
  // snapshot of the committed feature list before the change
  features: z.array(featureInstanceSchema).default([]),
  exportTargets: z.array(z.enum(EXPORT_KINDS)).default([]),
});
export type RollbackPoint = z.infer<typeof rollbackPointSchema>;

export const softwareProjectSchema = z.object({
  schemaVersion: z.number().int().min(1).default(1),
  id: z.string().min(1),
  name: z.string().min(1).default("My software project"),
  mode: z.enum(["beginner", "advanced"]).default("beginner"),
  features: z.array(featureInstanceSchema).default([]),
  exportTargets: z.array(z.enum(EXPORT_KINDS)).default(["thumb-drive"]),
  history: z.array(rollbackPointSchema).default([]),
  updatedAt: z.number().int().nonnegative().default(0),
});
export type SoftwareProject = z.infer<typeof softwareProjectSchema>;

// How many rollback points we retain (bounded so the file stays small).
export const MAX_HISTORY = 25;

// Backup file marker — refuse foreign/newer files on restore.
export const SOFTWARE_BACKUP_TAG = "lusik-software-project";
