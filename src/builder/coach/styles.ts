// ============================================================
// Communication Coach — response-style selection (pure)
// ============================================================
// Each objection/question carries several ResponseVariants. The
// "make it shorter / friendlier / more professional / less pushy"
// chips ask for a style; if it isn't authored, fall back to the
// closest sensible register — never return nothing.
// ============================================================

import type { ResponseVariant, Style } from "./schemas.ts";

// For each requested style, the order to try if the exact one is missing.
const FALLBACK: Record<Style, Style[]> = {
  simple: ["simple", "beginner", "friendly", "short", "professional"],
  beginner: ["beginner", "simple", "friendly", "short", "professional"],
  short: ["short", "simple", "beginner", "friendly", "professional"],
  friendly: ["friendly", "simple", "beginner", "professional"],
  "less-pushy": ["less-pushy", "friendly", "simple", "beginner", "professional"],
  professional: ["professional", "confident", "friendly", "simple"],
  confident: ["confident", "professional", "friendly", "simple"],
  "follow-up": ["follow-up", "friendly", "professional", "simple"],
};

/** Pick the best variant for a requested style, with graceful fallback. */
export function pickVariant(variants: ResponseVariant[], style: Style): ResponseVariant | null {
  if (variants.length === 0) return null;
  for (const want of FALLBACK[style] ?? [style]) {
    const hit = variants.find((v) => v.style === want);
    if (hit) return hit;
  }
  return variants[0]; // last resort: whatever exists
}

/** Which styles are actually authored for an item (drives which chips show). */
export function availableStyles(variants: ResponseVariant[]): Style[] {
  return [...new Set(variants.map((v) => v.style))];
}
