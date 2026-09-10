// ============================================================
// CONTRAST MATH — WCAG 2.1 relative luminance and ratios
// ============================================================
// Plain JavaScript on purpose (not .ts): the Node 20 unit test
// runner cannot import TypeScript, and the token contrast gate
// in netlify/functions/_lib/__tests__/token-contrast.test.mjs
// imports this file directly. Same reason src/lib/leadTime.js
// and src/lib/capabilityTier.js are plain JS.
//
// Nothing here touches the DOM, so it runs identically in the
// browser, in Node, and in a Playwright page.
// ============================================================

/**
 * Parse a CSS color into [r, g, b, a] with channels 0-255 and alpha 0-1.
 * Handles the three notations the token sheet actually uses: #rgb, #rrggbb,
 * and rgba()/rgb() with comma or space separators. Returns null for anything
 * else (gradients, var() references, named colors) so callers can skip it
 * rather than silently scoring a wrong number.
 */
export function parseColor(input) {
  if (typeof input !== "string") return null;
  const value = input.trim().toLowerCase();

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (hex) {
    const d = hex[1];
    const wide = d.length > 4;
    const step = wide ? 2 : 1;
    const chunk = (i) => {
      const s = d.slice(i * step, i * step + step);
      return parseInt(wide ? s : s + s, 16);
    };
    const hasAlpha = d.length === 4 || d.length === 8;
    return [chunk(0), chunk(1), chunk(2), hasAlpha ? chunk(3) / 255 : 1];
  }

  const fn = value.match(/^rgba?\(([^)]+)\)$/);
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const num = (s) => (s.endsWith("%") ? (parseFloat(s) / 100) * 255 : parseFloat(s));
    const r = num(parts[0]);
    const g = num(parts[1]);
    const b = num(parts[2]);
    if ([r, g, b].some((n) => !Number.isFinite(n))) return null;
    let a = 1;
    if (parts.length > 3) {
      a = parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
      if (!Number.isFinite(a)) return null;
    }
    return [r, g, b, Math.min(1, Math.max(0, a))];
  }

  return null;
}

/**
 * Composite a possibly-translucent foreground over an opaque backdrop,
 * returning an opaque [r, g, b]. Half our text tokens are rgba() over the
 * page cream, so scoring them without this step reports contrast for a
 * color that never appears on screen.
 */
export function flatten(color, backdrop) {
  const [r, g, b, a] = color;
  if (a >= 1) return [r, g, b];
  const [br, bg, bb] = backdrop;
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)];
}

/** WCAG 2.1 relative luminance of an opaque sRGB triple. */
export function luminance([r, g, b]) {
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Contrast ratio between a foreground and a background, 1 to 21.
 * The background is flattened first (it may itself be translucent, e.g. a
 * panel tint), then the foreground is composited onto that result.
 * `page` is the opaque ground everything ultimately sits on.
 */
export function contrastRatio(fg, bg, page) {
  const f = parseColor(fg);
  const b = parseColor(bg);
  if (!f || !b) return null;
  const ground = page ? parseColor(page) : null;
  const solidBg = flatten(b, ground ? flatten(ground, [255, 255, 255, 1]) : [255, 255, 255]);
  const solidFg = flatten(f, solidBg);
  const l1 = luminance(solidFg);
  const l2 = luminance(solidBg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG thresholds, named so failures read as intent rather than magic numbers. */
export const GATES = {
  /** Body copy. The plan asks for AAA on running text. */
  bodyAAA: 7,
  /** Any UI text, labels, small type. AA. */
  uiAA: 4.5,
  /** 24px+, or 18.66px+ bold. AA large. */
  largeAA: 3,
  /** Borders, focus rings, icons carrying meaning. WCAG 1.4.11. */
  nonTextAA: 3,
};
