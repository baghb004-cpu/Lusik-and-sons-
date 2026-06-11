// ============================================================
// Builder schema — Theme (design tokens + glass presets)
// ============================================================
// Tokens compile to CSS custom properties at build time; blocks
// reference them via style.ts tokenRefs. The current Apple-style
// Liquid Glass look becomes the seeded default theme in Phase 5
// — this schema is what that seed file must satisfy.
// ============================================================

import { z } from "zod";
import { hexColor, cssLength } from "./style.ts";
import { CURRENT_SCHEMA_VERSION } from "./migrate.ts";

const fraction = z.number().min(0).max(1);

const fontDef = z
  .object({
    family: z.string().min(1),
    fallback: z.string().min(1), // e.g. "serif", "system-ui, sans-serif"
    source: z.enum(["google", "self"]).optional(),
  })
  .strict();

// The slider set behind the pill-menu appearance panel (plan §6).
// Three shipped presets: "Liquid Glass" (current look), "Frosted"
// (no refraction — cheaper, more readable), "Solid" (fallback).
export const glassPreset = z
  .object({
    name: z.string().min(1).max(40),
    blurPx: z.number().min(0).max(60),
    opacity: fraction,
    saturation: z.number().min(0).max(3),
    brightness: z.number().min(0).max(2),
    contrast: z.number().min(0).max(2),
    tintColor: hexColor,
    tintOpacity: fraction,
    borderWidthPx: z.number().min(0).max(4),
    borderColor: hexColor,
    shadowStrength: fraction,
    highlightStrength: fraction,
    refraction: fraction, // 0 = frosted, >0 layers the lens effect
    activeGlow: fraction,
    transitionMs: z.number().min(0).max(1000),
  })
  .strict();

export type GlassPreset = z.infer<typeof glassPreset>;

export const themeSchema = z
  .object({
    schemaVersion: z.number().int().min(1).default(CURRENT_SCHEMA_VERSION),
    tokens: z
      .object({
        colors: z.record(z.string(), hexColor),
        fonts: z.object({ display: fontDef, body: fontDef, accent: fontDef.optional() }).strict(),
        // Fluid sizes ship as ready CSS values (clamp()/rem strings);
        // the theme panel edits them through guided controls.
        typeScale: z.record(z.string(), z.string().min(1)),
        spacing: z.record(z.string(), cssLength),
        radii: z.record(z.string(), cssLength),
        shadows: z.record(z.string(), z.string().min(1)),
        glass: z.array(glassPreset).default([]),
      })
      .strict(),
    // Per-component style slots (button, card, drawer…). Values are
    // token refs or CSS values; typed slots harden in Phase 5 as the
    // theme panel grows controls for each.
    components: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  })
  .strict();

export type Theme = z.infer<typeof themeSchema>;
