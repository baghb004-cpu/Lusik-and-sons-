// ============================================================
// Appearance compiler — Day / Night / Candlelight (plan §19)
// ============================================================
// Turns a theme's appearance config into plain CSS, the same way
// css.ts turns tokens into variables. Three honest layers:
//
//   1. NIGHT (dark mode) — variable overrides under
//      [data-bt-mode="dark"], plus a prefers-color-scheme media
//      rule for visitors who never touched the switcher. The auto
//      path is PURE CSS: dark mode follows the OS with zero JS.
//   2. CANDLELIGHT — a fixed, pointer-events-none warm wash
//      (html::after, multiply-blended amber) plus a gentle dim
//      (html::before). Strength rides one CSS variable
//      (--bt-candle-a) so the visitor's warmth slider is a single
//      property write. Independent of light/dark, like Night
//      Shift is independent of iOS dark mode.
//   3. UTILITIES RE-SKIN — exported pages compile their Tailwind
//      palette to rgb(var(--bt-rgb-*)) channels instead of fixed
//      hex, so EVERY utility (bg-cream, text-ink, bg-white/60 …)
//      follows the mode, alpha variants included.
//
// deriveDarkColors gives a complete Night palette from the light
// one (lightness-flipped, hue kept) so enabling dark mode is one
// click; explicit darkColors entries always win.
// ============================================================

import type { Theme } from "../schema/index.ts";

/** localStorage key for the visitor's choice ({mode, candle, warmth, candleUntil}). */
export const APPEARANCE_STORAGE_KEY = "bt_appearance_v1";

// ── color math (tiny, dependency-free) ──────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6);
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

export function hexToRgbChannels(hex: string): string {
  return hexToRgb(hex).join(" ");
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Auto-derive a Night palette: flip each color's lightness around the
 * midpoint (dark ink → warm off-white, cream → deep brown-black) while
 * keeping hue and most saturation, so the brand still reads as itself
 * after dark. Mid-lightness colors (accents) brighten slightly — they
 * need more light to hold contrast on a dark ground.
 */
export function deriveDarkColors(colors: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, hex] of Object.entries(colors)) {
    const [h, s, l] = rgbToHsl(...hexToRgb(hex));
    const flipped = Math.min(0.96, Math.max(0.06, 1.02 - l));
    // accents (mid lightness) drift up a touch instead of flipping hard
    const target = l > 0.35 && l < 0.65 ? Math.min(0.72, l + 0.12) : flipped;
    out[name] = hslToHex(h, s * 0.9, target);
  }
  return out;
}

/** The full Night palette: derived base + explicit overrides on top. */
export function nightPalette(theme: Theme): Record<string, string> {
  const derived = deriveDarkColors(theme.tokens.colors);
  return { ...derived, ...(theme.appearance?.darkColors ?? {}) };
}

// "white" isn't a brand token but the renderer's cards lean on
// bg-white/60 — give it channels too so surfaces darken with the mode.
const DARK_WHITE = "#262119"; // warm near-black paper

function rgbVarLines(colors: Record<string, string>, extraWhite?: string): string[] {
  const lines = Object.entries(colors).map(([name, hex]) => `--bt-rgb-${name.replace(/\./g, "-")}: ${hexToRgbChannels(hex)};`);
  if (extraWhite) lines.push(`--bt-rgb-white: ${hexToRgbChannels(extraWhite)};`);
  return lines;
}

function colorVarLines(colors: Record<string, string>): string[] {
  return Object.entries(colors).map(([name, hex]) => `--bt-color-${name.replace(/\./g, "-")}: ${hex};`);
}

/**
 * Tailwind palette for appearance-enabled exports: every brand color
 * (and white) resolves through rgb channels, so dark mode's variable
 * flip re-skins every utility — alpha variants included. Fallback
 * channels keep light mode correct before any variable is set.
 */
export function appearanceTailwindColors(theme: Theme): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, hex] of Object.entries(theme.tokens.colors)) {
    out[name] = `rgb(var(--bt-rgb-${name.replace(/\./g, "-")}, ${hexToRgbChannels(hex)}) / <alpha-value>)`;
  }
  out.white = `rgb(var(--bt-rgb-white, 255 255 255) / <alpha-value>)`;
  return out;
}

/**
 * All appearance CSS for a theme: light rgb channels on :root, Night
 * overrides for the explicit choice AND the OS-preference auto path,
 * and the Candlelight overlay layers. Returns "" when disabled.
 */
export function appearanceCss(theme: Theme): string {
  const a = theme.appearance;
  if (!a?.enabled) return "";
  const light = theme.tokens.colors;
  const dark = nightPalette(theme);
  const darkLines = [...colorVarLines(dark), ...rgbVarLines(dark, DARK_WHITE), "color-scheme: dark;"].join("\n  ");
  const warmthAlpha = (a.candlelight.warmth / 100) * 0.45;
  const dimAlpha = a.candlelight.dim / 100;

  return `/* Appearance: Day / Night / Candlelight */
:root {
  ${rgbVarLines(light, "#FFFFFF").join("\n  ")}
  color-scheme: light dark;
}
/* Night — explicit visitor choice */
:root[data-bt-mode="dark"] {
  ${darkLines}
}
/* Night — follow the OS when the visitor hasn't chosen (zero-JS path) */
@media (prefers-color-scheme: dark) {
  :root:not([data-bt-mode="light"]):not([data-bt-mode="dark"]) {
    ${darkLines}
  }
}
/* Candlelight — warm amber wash + gentle dim; visitor warmth rides --bt-candle-a */
:root[data-bt-candle="1"]::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  pointer-events: none;
  background: rgb(255 147 41 / var(--bt-candle-a, ${warmthAlpha.toFixed(3)}));
  mix-blend-mode: multiply;
}
:root[data-bt-candle="1"]::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 2147483645;
  pointer-events: none;
  background: rgb(0 0 0 / ${dimAlpha.toFixed(3)});
}
@media (prefers-reduced-motion: no-preference) {
  :root[data-bt-candle="1"]::after { transition: background 400ms ease; }
}`;
}
