// ============================================================
// Embroidery (§31, Phase 5) — grid → ordered stitch path (pure)
// ============================================================
// Turns a counted design into a machine-ready stitch sequence: one stitch per
// filled cell, ordered per color in a boustrophedon (snake) sweep to minimize
// thread jumps, with a color-change ("stop") between colors. Coordinates are in
// 0.1mm units (DST units), origin at the design center, Y up.
//
// This is an honest v1: a single tacking stitch per cell ("dot fill"), not a
// satin/cross digitization. It is clearly labelled experimental in the UI.
// ============================================================

import { getCell, usedColors, type Grid } from "./model.ts";

export type StitchFlag = "stitch" | "jump" | "stop" | "end";
export type StitchStyle = "cross" | "tatami";
export interface Stitch { x: number; y: number; flag: StitchFlag; }
export interface StitchPlan {
  stitches: Stitch[];
  colors: number[];          // thread index per color block, in stitch order
  units: number;             // 0.1mm units per cell
  style: StitchStyle;
}

// distance (in units) above which we lift the needle (jump) instead of stitch
function jumpDist(units: number) { return units * 1.9; }

// "cross" = an authentic X in each cell (two diagonal stitches, needle up
// between). "tatami" = a single tacking stitch per cell (lighter, faster).
export function buildStitchPlan(g: Grid, mmPerCell = 2, style: StitchStyle = "cross"): StitchPlan {
  const units = Math.max(1, Math.round(mmPerCell * 10)); // 0.1mm units per cell
  const h = units / 2;
  const colors = usedColors(g);
  const stitches: Stitch[] = [];
  const cx = (g.w - 1) / 2;
  const cy = (g.h - 1) / 2;
  const X = (x: number) => Math.round((x - cx) * units);
  const Y = (y: number) => Math.round((cy - y) * units); // Y up
  const R = (n: number) => Math.round(n);

  let prevX = -99999, prevY = -99999, hasPrev = false;
  const push = (x: number, y: number, flag: StitchFlag) => { stitches.push({ x, y, flag }); prevX = x; prevY = y; hasPrev = true; };

  colors.forEach((color, ci) => {
    const cells: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < g.h; y++) {
      const xs: number[] = [];
      for (let x = 0; x < g.w; x++) if (getCell(g, x, y) === color) xs.push(x);
      if (y % 2 === 1) xs.reverse(); // snake
      for (const x of xs) cells.push({ x, y });
    }
    for (const c of cells) {
      const ux = X(c.x), uy = Y(c.y);
      if (style === "tatami") {
        const far = !hasPrev || Math.hypot(ux - prevX, uy - prevY) > jumpDist(units);
        push(ux, uy, far ? "jump" : "stitch");
      } else {
        // an X: bottom-left → top-right ("/"), then top-left → bottom-right ("\")
        push(R(ux - h), R(uy - h), "jump");
        push(R(ux + h), R(uy + h), "stitch");
        push(R(ux - h), R(uy + h), "jump");
        push(R(ux + h), R(uy - h), "stitch");
      }
    }
    if (ci < colors.length - 1 && stitches.length) {
      const lp = stitches[stitches.length - 1];
      stitches.push({ x: lp.x, y: lp.y, flag: "stop" });
    }
  });

  if (stitches.length) {
    const lp = stitches[stitches.length - 1];
    stitches.push({ x: lp.x, y: lp.y, flag: "end" });
  }
  return { stitches, colors, units, style };
}

// total thread length in millimetres (sum of stitch segment lengths)
export function threadLengthMm(plan: StitchPlan): number {
  let total = 0;
  let prev: Stitch | null = null;
  for (const s of plan.stitches) {
    if (prev && s.flag !== "stop" && s.flag !== "end") total += Math.hypot(s.x - prev.x, s.y - prev.y) / 10;
    prev = s;
  }
  return total;
}
