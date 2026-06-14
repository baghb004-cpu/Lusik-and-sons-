// ============================================================
// Theme compiler — theme.json → CSS custom properties
// ============================================================
// One token, one variable: "color.ink" → --bt-color-ink. The
// renderer's tokenToCss() (renderer/style.ts) emits var() refs
// with the SAME naming, so re-theming a site never touches its
// documents — the variables move underneath them.
//
// glassPresetToCss compiles a §6 glass preset (the pill-menu
// slider set) into plain CSS — backdrop-filter + tint + border +
// shadow/highlight — used by the theme panel's live preview now
// and the pillNav block in Phase 8.
// ============================================================

import type { GlassPreset, Theme } from "../schema/index.ts";

function varName(group: string, key: string): string {
  return `--bt-${group}-${key.replace(/\./g, "-")}`;
}

/** All theme tokens as a CSS declaration block body (no selector). */
export function themeToCssDeclarations(theme: Theme): string {
  const lines: string[] = [];
  const push = (group: string, record: Record<string, string>) => {
    for (const [key, value] of Object.entries(record)) {
      lines.push(`${varName(group, key)}: ${value};`);
    }
  };
  push("color", theme.tokens.colors);
  push("spacing", theme.tokens.spacing);
  push("radius", theme.tokens.radii);
  push("shadow", theme.tokens.shadows);
  push("typeScale", theme.tokens.typeScale);

  const fonts = theme.tokens.fonts;
  lines.push(`${varName("font", "display")}: "${fonts.display.family}", ${fonts.display.fallback};`);
  lines.push(`${varName("font", "body")}: "${fonts.body.family}", ${fonts.body.fallback};`);
  if (fonts.accent) {
    lines.push(`${varName("font", "accent")}: "${fonts.accent.family}", ${fonts.accent.fallback};`);
  }
  return lines.join("\n  ");
}

/** A full :root rule (editor preview injects this; published pages get it at build). */
export function themeToCssVars(theme: Theme): string {
  return `:root {\n  ${themeToCssDeclarations(theme)}\n}`;
}

function hexWithOpacity(hex: string, opacity: number): string {
  const h = hex.replace(/^#/, "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6);
  const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${full}${alpha}`;
}

/**
 * Compile a glass preset to CSS properties. `refraction: 0` is the
 * "Frosted" look (flat blur); higher values layer a lens highlight.
 * Pure CSS — no JS at runtime, same cost profile as the live site's nav.
 */
export function glassPresetToCss(p: GlassPreset): Record<string, string> {
  const filter = `blur(${p.blurPx}px) saturate(${p.saturation}) brightness(${p.brightness}) contrast(${p.contrast})`;
  const css: Record<string, string> = {
    background: hexWithOpacity(p.tintColor, p.tintOpacity * p.opacity),
    backdropFilter: filter,
    WebkitBackdropFilter: filter,
    border: p.borderWidthPx > 0 ? `${p.borderWidthPx}px solid ${hexWithOpacity(p.borderColor, 0.55)}` : "none",
    transition: `all ${p.transitionMs}ms ease`,
  };
  const shadows: string[] = [];
  if (p.shadowStrength > 0) {
    shadows.push(`0 8px 32px rgba(0,0,0,${(0.35 * p.shadowStrength).toFixed(3)})`);
  }
  if (p.highlightStrength > 0) {
    shadows.push(`inset 0 1px 0 rgba(255,255,255,${(0.6 * p.highlightStrength).toFixed(3)})`);
  }
  if (p.refraction > 0) {
    // The "lens" — an inner rim glow that reads as curved glass.
    shadows.push(`inset 0 0 ${Math.round(18 * p.refraction)}px rgba(255,255,255,${(0.28 * p.refraction).toFixed(3)})`);
  }
  if (shadows.length) css.boxShadow = shadows.join(", ");
  return css;
}
