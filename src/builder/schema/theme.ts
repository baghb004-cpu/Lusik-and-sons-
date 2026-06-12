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

// ── Appearance: Day / Night / Candlelight (plan §19) ────────
// Inspired by iOS Night Shift, with the workshop twist: besides a
// real dark palette ("Night"), the site can light a CANDLE — a warm
// amber wash with its own Less↔More Warm dial, an after-dark
// schedule, and a visitor tap that lasts "until morning". Dark mode
// is honest CSS: explicit choice via [data-bt-mode], OS preference
// via prefers-color-scheme (works with zero JS). Visitor state is
// per-device (localStorage); THIS schema holds only the design.
const timeHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const candlelightSchema = z
  .object({
    /** The Night-Shift slider: 0 = off-white wash, 100 = deep amber. */
    warmth: z.number().min(0).max(100).default(45),
    /** Gentle brightness drop (%) layered under the warmth. */
    dim: z.number().min(0).max(40).default(8),
    /** Light the candle automatically after dark. */
    scheduled: z.boolean().default(false),
    start: timeHHMM.default("21:00"),
    end: timeHHMM.default("07:00"),
  })
  .strict();

export const appearanceSchema = z
  .object({
    enabled: z.boolean().default(false),
    /** Dark-palette overrides per color token; missing keys auto-derive
     *  (lightness-flipped) so one click yields a complete Night look. */
    darkColors: z.record(z.string(), hexColor).default({}),
    candlelight: candlelightSchema.default({ warmth: 45, dim: 8, scheduled: false, start: "21:00", end: "07:00" }),
  })
  .strict();

export type Candlelight = z.infer<typeof candlelightSchema>;
export type Appearance = z.infer<typeof appearanceSchema>;

export const themeSchema = z
  .object({
    schemaVersion: z.number().int().min(1).default(CURRENT_SCHEMA_VERSION),
    appearance: appearanceSchema.optional(),
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
