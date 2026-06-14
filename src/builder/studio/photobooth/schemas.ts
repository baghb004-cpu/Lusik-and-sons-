// ============================================================
// Creation Studio — Photo Booth data model (§30, Phase 8)
// ============================================================
// A simple, offline event photo booth: camera → countdown → capture
// → compose (single/strip/grid) → overlay frame/logo/text → save
// locally. Privacy-first: camera only while open, no auto-upload, no
// face recognition, no biometrics.
// ============================================================

import { z } from "zod";

export const BOOTH_LAYOUTS = ["single", "strip", "grid"] as const;
export const FILTERS = ["none", "bw", "warm", "cool", "vintage", "contrast"] as const;
export const COUNTDOWNS = [0, 3, 5, 10] as const;

export const boothProjectSchema = z.object({
  schemaVersion: z.number().int().min(1).default(1),
  id: z.string().min(1),
  name: z.string().min(1).default("My Photo Booth"),
  layout: z.enum(BOOTH_LAYOUTS).default("single"),
  photoCount: z.number().int().min(1).max(4).default(1),
  countdown: z.number().int().default(3),
  filter: z.enum(FILTERS).default("none"),
  eventName: z.string().default(""),
  eventDate: z.string().default(""),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#1A1612"),
  // overlays the export references (relative asset paths or empty):
  logoUrl: z.string().default(""),
  frameUrl: z.string().default(""),
  // privacy choices baked into the generated booth:
  askBeforeSave: z.boolean().default(false),
  saveOriginal: z.boolean().default(false),
  retakeAllowed: z.boolean().default(true),
});
export type BoothProject = z.infer<typeof boothProjectSchema>;

// CSS/canvas filter strings (applied via ctx.filter / CSS `filter`).
export const FILTER_CSS: Record<(typeof FILTERS)[number], string> = {
  none: "none",
  bw: "grayscale(1)",
  warm: "sepia(0.35) saturate(1.2)",
  cool: "saturate(1.1) brightness(1.02) hue-rotate(-12deg)",
  vintage: "sepia(0.5) contrast(0.95) brightness(1.05)",
  contrast: "contrast(1.3) saturate(1.1)",
};
