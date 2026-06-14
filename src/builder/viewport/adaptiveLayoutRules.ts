// ============================================================
// Adaptive layout rules — viewport → layout decisions
// ============================================================
// Pure: a preset in, a recommended layout out. This is the
// "smart decisions" brain (columns, nav style, panes, spacing,
// tap targets) the apply-engine and the scanner both consult.
// Tunable by editing the thresholds here — no engine rewrite.
// ============================================================

import { breakpointForWidth, type Breakpoint3, type ViewportPreset } from "./viewportPresets.ts";

export interface LayoutRules {
  breakpoint: Breakpoint3;
  /** Recommended grid columns for product/card grids. */
  columns: number;
  navStyle: "bottom" | "sidebar" | "top";
  /** Sticky bottom action bar (phones / short touch screens). */
  stickyActions: boolean;
  headerStyle: "full" | "compact";
  /** Multipliers applied to spacing/type tokens (1 = unchanged). */
  spacingScale: number;
  typeScale: number;
  /** Minimum comfortable tap target. */
  tapTargetMinPx: number;
  panes: "single" | "dual";
  mediaEmphasis: "normal" | "large";
  /** Honor a foldable hinge dead zone in layout. */
  hingeAware: boolean;
  /** Honor notch/cutout/home-indicator insets. */
  safeAreaAware: boolean;
}

const SHORT_SCREEN_PX = 600; // below this height, compact the chrome

export function layoutRulesFor(preset: ViewportPreset): LayoutRules {
  const bp = breakpointForWidth(preset.width);
  const landscape = preset.width > preset.height;
  const shortScreen = preset.height < SHORT_SCREEN_PX;

  // Columns scale with width, capped by family sensibility.
  let columns: number;
  if (preset.width < 380) columns = 1;
  else if (preset.width < 560) columns = preset.family === "phone" || preset.family === "legacy" ? 1 : 2; // large phones still read better at 1
  else if (preset.width < 900) columns = 2;
  else if (preset.width < 1300) columns = 3;
  else if (preset.width < 1900) columns = 4;
  else columns = 5;
  // Large phones MAY go 2-up for short cards, but default 1 for safety.
  if (preset.family === "phone" && preset.width >= 412) columns = Math.min(columns, 2);

  const dual = (preset.dualPane || (bp !== "mobile" && preset.width >= 820)) && preset.width >= 768;

  return {
    breakpoint: bp,
    columns,
    navStyle: bp === "mobile" ? "bottom" : bp === "tablet" ? (dual ? "sidebar" : "top") : "sidebar",
    stickyActions: bp === "mobile" || (preset.touch && shortScreen),
    headerStyle: shortScreen || (landscape && bp === "mobile") ? "compact" : "full",
    spacingScale: shortScreen ? 0.7 : bp === "desktop" ? 1.1 : 1,
    typeScale: preset.width >= 1900 ? 1.1 : preset.width < 360 ? 0.95 : 1,
    tapTargetMinPx: preset.touch ? 44 : 28,
    panes: dual ? "dual" : "single",
    mediaEmphasis: preset.width >= 1280 ? "large" : "normal",
    hingeAware: !!preset.hinge,
    safeAreaAware: !!preset.safeArea,
  };
}

/** Plain-language summary for the panel ("1 column · bottom nav · compact header"). */
export function describeRules(r: LayoutRules): string {
  const bits = [
    `${r.columns} column${r.columns === 1 ? "" : "s"}`,
    `${r.navStyle} nav`,
    `${r.headerStyle} header`,
    r.panes === "dual" ? "split-pane" : "single-pane",
  ];
  if (r.stickyActions) bits.push("sticky actions");
  if (r.hingeAware) bits.push("hinge-aware");
  if (r.safeAreaAware) bits.push("safe-area padding");
  return bits.join(" · ");
}
