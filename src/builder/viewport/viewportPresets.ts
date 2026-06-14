// ============================================================
// Viewport presets — the developer-facing screen library
// ============================================================
// One config file; add ratios here without touching the engine.
//
// PRIVACY-SAFE LABELS: no brand/model/manufacturer names ever —
// presets are screen FAMILIES and aspect RATIOS based on common
// real-world sizes, labeled generically. A unit test enforces the
// no-brand rule against the label set.
//
// Each preset maps to one of the three real CSS breakpoints
// (mobile <768 / tablet 768–1023 / desktop ≥1024) — that's the
// bucket an "Apply preset" change actually lands in, because it's
// what the renderer + CSS exports ship. The fine-grained width/
// height/safe-area/hinge data drives PREVIEW and ISSUE-SCANNING
// fidelity, which is where per-model accuracy matters.
// ============================================================

export type DeviceFamily = "phone" | "foldable" | "tablet" | "desktop" | "legacy" | "tv";
export type Breakpoint3 = "mobile" | "tablet" | "desktop";
export type Posture = "folded" | "unfolded" | "tabletop" | "partially-open";

export interface SafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface HingeZone {
  axis: "vertical" | "horizontal"; // vertical = a left/right split (book), horizontal = top/bottom (clamshell)
  /** Center of the hinge as a fraction of the relevant dimension (0–1). */
  position: number;
  /** Width of the dead zone in px. */
  widthPx: number;
}

export interface ViewportPreset {
  id: string;
  label: string; // generic, privacy-safe
  family: DeviceFamily;
  group: string; // UI grouping header
  width: number;
  height: number;
  ratioLabel: string;
  touch: boolean; // touch input → larger tap targets
  safeArea?: SafeArea; // notch / cutout / home-indicator insets
  hinge?: HingeZone; // foldable dead zone
  dualPane?: boolean; // wide enough to split into two panes
  postures?: Posture[]; // foldable states this preset represents
}

/** Which of the three shipped breakpoints a width belongs to. */
export function breakpointForWidth(width: number): Breakpoint3 {
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Reduce w:h to a short ratio label, snapping near-common values. */
export function ratioLabel(width: number, height: number): string {
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  const r = longSide / shortSide;
  // snap to the well-known tall-phone ratios the spec lists
  const known: Array<[number, string]> = [
    [16 / 9, "16:9"], [18 / 9, "18:9"], [18.5 / 9, "18.5:9"], [19 / 9, "19:9"],
    [19.5 / 9, "19.5:9"], [20 / 9, "20:9"], [21 / 9, "21:9"], [22 / 9, "22:9"],
    [32 / 9, "32:9"], [4 / 3, "4:3"], [3 / 2, "3:2"], [16 / 10, "16:10"],
    [5 / 3, "5:3"], [6 / 5, "6:5"], [5 / 4, "5:4"], [1, "1:1"],
  ];
  for (const [val, label] of known) {
    if (Math.abs(r - val) < 0.03) return width >= height ? label : label.split(":").reverse().join(":");
  }
  const g = gcd(width, height) || 1;
  return `${width / g}:${height / g}`;
}

const TOUCH = true;
const POINTER = false;

/** Factory: fills ratioLabel + breakpoint-derived defaults. */
function vp(
  id: string,
  label: string,
  family: DeviceFamily,
  group: string,
  width: number,
  height: number,
  touch: boolean,
  extra: Partial<ViewportPreset> = {}
): ViewportPreset {
  return { id, label, family, group, width, height, touch, ratioLabel: ratioLabel(width, height), ...extra };
}

const NOTCH: SafeArea = { top: 44, bottom: 34, left: 0, right: 0 };
const NOTCH_LANDSCAPE: SafeArea = { top: 0, bottom: 21, left: 44, right: 44 };

export const VIEWPORT_PRESETS: ViewportPreset[] = [
  // ── Phones (by size) ──────────────────────────────────────
  vp("phone-compact", "Compact Phone", "phone", "Phones", 320, 568, TOUCH),
  vp("phone-small", "Small Phone", "phone", "Phones", 360, 640, TOUCH),
  vp("phone-standard", "Standard Phone", "phone", "Phones", 375, 667, TOUCH),
  vp("phone-tall", "Tall Phone", "phone", "Phones", 390, 844, TOUCH, { safeArea: NOTCH }),
  vp("phone-modern", "Modern Phone", "phone", "Phones", 393, 873, TOUCH, { safeArea: NOTCH }),
  vp("phone-large", "Large Phone", "phone", "Phones", 412, 915, TOUCH, { safeArea: NOTCH }),
  vp("phone-large-tall", "Large Tall Phone", "phone", "Phones", 430, 932, TOUCH, { safeArea: NOTCH }),
  vp("phone-xl", "Extra-Large Phone", "phone", "Phones", 480, 960, TOUCH),

  // ── Tall-phone aspect ratios (representative width 393) ────
  ...([
    ["16:9", 16 / 9], ["18:9", 18 / 9], ["18.5:9", 18.5 / 9], ["19:9", 19 / 9],
    ["19.5:9", 19.5 / 9], ["20:9", 20 / 9], ["21:9", 21 / 9], ["22:9", 22 / 9],
  ] as Array<[string, number]>).map(([lbl, r]) =>
    vp(`phone-ratio-${lbl.replace(/[:.]/g, "-")}`, `Tall Phone ${lbl}`, "phone", "Tall-phone ratios", 393, Math.round(393 * r), TOUCH, {
      ratioLabel: lbl,
      safeArea: NOTCH,
    })
  ),

  // ── Legacy mobile ─────────────────────────────────────────
  vp("legacy-compact", "Legacy Compact", "legacy", "Legacy mobile", 320, 480, TOUCH),
  vp("legacy-wide", "Legacy Wide", "legacy", "Legacy mobile", 360, 480, TOUCH),
  vp("legacy-tall", "Legacy Tall", "legacy", "Legacy mobile", 480, 800, TOUCH),
  vp("legacy-touch", "Legacy Touch Phone", "legacy", "Legacy mobile", 540, 960, TOUCH),
  vp("legacy-hd", "Legacy HD Phone", "legacy", "Legacy mobile", 720, 1280, TOUCH),
  vp("legacy-wide-hd", "Legacy Wide HD", "legacy", "Legacy mobile", 768, 1280, TOUCH),

  // ── Foldables (cover + inner, folded/unfolded) ────────────
  vp("fold-cover-narrow", "Narrow Cover Screen", "foldable", "Foldables", 320, 748, TOUCH, {
    safeArea: NOTCH,
    postures: ["folded"],
  }),
  vp("fold-cover-tall", "Tall Cover Screen", "foldable", "Foldables", 360, 880, TOUCH, { safeArea: NOTCH, postures: ["folded"] }),
  vp("fold-cover-wide", "Wide Cover Screen", "foldable", "Foldables", 412, 904, TOUCH, { safeArea: NOTCH, postures: ["folded"] }),
  vp("fold-inner-square", "Inner Square Display", "foldable", "Foldables", 768, 768, TOUCH, {
    ratioLabel: "1:1",
    dualPane: true,
    postures: ["unfolded"],
    hinge: { axis: "vertical", position: 0.5, widthPx: 28 },
  }),
  vp("fold-inner-near-square", "Inner Near-Square Display", "foldable", "Foldables", 884, 1104, TOUCH, {
    ratioLabel: "4:5",
    dualPane: true,
    postures: ["unfolded"],
    hinge: { axis: "vertical", position: 0.5, widthPx: 28 },
  }),
  vp("fold-inner-tablet", "Inner Tablet-Style Display", "foldable", "Foldables", 1812, 2176, TOUCH, {
    ratioLabel: "5:6",
    dualPane: true,
    postures: ["unfolded"],
    hinge: { axis: "vertical", position: 0.5, widthPx: 32 },
  }),
  vp("fold-dual-pane", "Dual-Pane Foldable Display", "foldable", "Foldables", 1344, 1892, TOUCH, {
    dualPane: true,
    postures: ["unfolded"],
    hinge: { axis: "vertical", position: 0.5, widthPx: 30 },
  }),
  vp("fold-book", "Book-Style Foldable", "foldable", "Foldables", 1100, 1440, TOUCH, {
    dualPane: true,
    postures: ["unfolded", "tabletop"],
    hinge: { axis: "vertical", position: 0.5, widthPx: 26 },
  }),
  vp("fold-clamshell", "Clamshell-Style Foldable", "foldable", "Foldables", 720, 748, TOUCH, {
    ratioLabel: "1:1",
    postures: ["folded", "partially-open", "unfolded", "tabletop"],
    hinge: { axis: "horizontal", position: 0.5, widthPx: 24 },
  }),

  // ── Tablets ───────────────────────────────────────────────
  vp("tablet-small", "Small Tablet", "tablet", "Tablets", 600, 960, TOUCH),
  vp("tablet-reading", "Reading Tablet", "tablet", "Tablets", 744, 1133, TOUCH),
  vp("tablet-standard", "Standard Tablet", "tablet", "Tablets", 768, 1024, TOUCH, { dualPane: true }),
  vp("tablet-wide", "Wide Tablet", "tablet", "Tablets", 800, 1280, TOUCH, { dualPane: true }),
  vp("tablet-drawing", "Drawing Tablet", "tablet", "Tablets", 810, 1080, TOUCH, { dualPane: true }),
  vp("tablet-portrait", "Portrait Tablet", "tablet", "Tablets", 834, 1194, TOUCH, { dualPane: true }),
  vp("tablet-large", "Large Tablet", "tablet", "Tablets", 1024, 1366, TOUCH, { dualPane: true }),
  vp("tablet-landscape", "Landscape Tablet", "tablet", "Tablets", 1280, 800, TOUCH, { dualPane: true }),
  vp("tablet-landscape-lg", "Large Landscape Tablet", "tablet", "Tablets", 1366, 1024, TOUCH, { dualPane: true }),

  // ── Desktop / web ─────────────────────────────────────────
  vp("desktop-xga", "Desktop", "desktop", "Desktop", 1024, 768, POINTER),
  vp("desktop-720", "Desktop HD", "desktop", "Desktop", 1280, 720, POINTER),
  vp("desktop-800", "Desktop", "desktop", "Desktop", 1280, 800, POINTER),
  vp("desktop-laptop", "Laptop", "desktop", "Desktop", 1366, 768, POINTER),
  vp("desktop-wxga", "Laptop Plus", "desktop", "Desktop", 1440, 900, POINTER),
  vp("desktop-1536", "Desktop", "desktop", "Desktop", 1536, 864, POINTER),
  vp("desktop-hd+", "Desktop HD+", "desktop", "Desktop", 1600, 900, POINTER),
  vp("desktop-fhd", "Wide Desktop", "desktop", "Desktop", 1920, 1080, POINTER),
  vp("desktop-fhd+", "Wide Desktop Tall", "desktop", "Desktop", 1920, 1200, POINTER),
  vp("desktop-qhd", "Large Desktop", "desktop", "Desktop", 2560, 1440, POINTER),
  vp("desktop-ultrawide", "Ultrawide Desktop", "desktop", "Desktop", 3440, 1440, POINTER, { ratioLabel: "21:9" }),

  // ── TV / large display ────────────────────────────────────
  vp("tv-fhd", "TV / Large Display", "tv", "TV & large displays", 1920, 1080, POINTER),
  vp("tv-uhd", "Large TV Display", "tv", "TV & large displays", 3840, 2160, POINTER),
];

// satisfy unused-import-style references for landscape safe area helper
export const LANDSCAPE_SAFE_AREA = NOTCH_LANDSCAPE;

export function presetById(id: string): ViewportPreset | null {
  return VIEWPORT_PRESETS.find((p) => p.id === id) ?? null;
}

export function presetsByFamily(family: DeviceFamily): ViewportPreset[] {
  return VIEWPORT_PRESETS.filter((p) => p.family === family);
}

/** Grouped for the UI, in declaration order. */
export function presetGroups(): Array<{ group: string; presets: ViewportPreset[] }> {
  const order: string[] = [];
  const byGroup = new Map<string, ViewportPreset[]>();
  for (const p of VIEWPORT_PRESETS) {
    if (!byGroup.has(p.group)) {
      byGroup.set(p.group, []);
      order.push(p.group);
    }
    byGroup.get(p.group)!.push(p);
  }
  return order.map((group) => ({ group, presets: byGroup.get(group)! }));
}
