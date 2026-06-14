// ============================================================
// Export — override layers → @media CSS (plan §10/§11)
// ============================================================
// Static pages can't run the override cascade, so patches compile
// to media queries targeting [data-block-id] — the SAME breakpoint
// boundaries the renderer's visibility classes use (mobile <768,
// tablet 768–1023). A hidden patch becomes display:none inside the
// media block; style patches become plain declarations. Fidelity
// without a byte of JavaScript.
// ============================================================

import type { Breakpoint, OverrideLayer } from "../schema/index.ts";
import { resolveStyle } from "../renderer/style.ts";

const MEDIA: Record<Breakpoint, string> = {
  // tablet patches apply tablet-and-down? NO — cascade is base→tablet→mobile,
  // tablet layer applies to tablet AND mobile (mobile then overrides). The
  // equivalent CSS: tablet rules under max-width:1023px, mobile rules under
  // max-width:767px (later in the sheet, so they win on phones).
  tablet: "@media (max-width: 1023.98px)",
  mobile: "@media (max-width: 767.98px)",
};

function cssDeclarations(style: Record<string, unknown>): string {
  // Reuse the renderer's token resolution, then kebab-case the result.
  const resolved = resolveStyle(style as Parameters<typeof resolveStyle>[0]);
  return Object.entries(resolved)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${String(v)};`)
    .join(" ");
}

export function layerToMediaCss(layer: OverrideLayer): string {
  const rules: string[] = [];
  for (const [blockId, patch] of Object.entries(layer.patches)) {
    const parts: string[] = [];
    if (patch.style) {
      const decls = cssDeclarations(patch.style);
      if (decls) parts.push(decls);
    }
    if (patch.visibility === false) parts.push("display: none;");
    if (parts.length > 0) {
      rules.push(`  [data-block-id="${blockId}"] { ${parts.join(" ")} }`);
    }
  }
  if (rules.length === 0) return "";
  return `${MEDIA[layer.breakpoint]} {\n${rules.join("\n")}\n}`;
}

/** Tablet first, mobile second — source order makes mobile win on phones. */
export function layersToMediaCss(layers: OverrideLayer[]): string {
  const ordered = [...layers].sort((a, b) => (a.breakpoint === "tablet" ? -1 : 1) - (b.breakpoint === "tablet" ? -1 : 1));
  return ordered
    .map(layerToMediaCss)
    .filter(Boolean)
    .join("\n\n");
}
