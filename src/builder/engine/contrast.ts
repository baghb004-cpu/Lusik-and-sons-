// ============================================================
// Builder engine — WCAG contrast math
// ============================================================
// Powers the theme panel's live contrast meter and the
// publish-blocking "unreadable text" guardrail (plan §6/§11).
// Implements WCAG 2.x relative luminance + contrast ratio.
// ============================================================

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace(/^#/, "");
  if (h.length === 3 || h.length === 4) {
    h = [...h].map((c) => c + c).join("");
  }
  if (h.length !== 6 && h.length !== 8) {
    throw new Error(`Not a hex color: ${hex}`);
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio, 1..21. Order of arguments doesn't matter. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface ContrastCheck {
  ratio: number;
  passesAA: boolean;
  passesAAA: boolean;
}

/** `largeText` = ≥24px regular or ≥18.66px bold (WCAG large-text thresholds). */
export function checkContrast(fg: string, bg: string, largeText = false): ContrastCheck {
  const ratio = contrastRatio(fg, bg);
  return {
    ratio,
    passesAA: ratio >= (largeText ? 3 : 4.5),
    passesAAA: ratio >= (largeText ? 4.5 : 7),
  };
}
