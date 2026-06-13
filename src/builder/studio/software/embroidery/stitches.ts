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
export interface Stitch { x: number; y: number; flag: StitchFlag; }
export interface StitchPlan {
  stitches: Stitch[];
  colors: number[];          // thread index per color block, in stitch order
  units: number;             // 0.1mm units per cell
}

// distance (in cells) above which we lift the needle (jump) instead of stitch
const JUMP_CELLS = 1.9;

export function buildStitchPlan(g: Grid, mmPerCell = 2): StitchPlan {
  const units = Math.max(1, Math.round(mmPerCell * 10)); // 0.1mm units per cell
  const colors = usedColors(g);
  const stitches: Stitch[] = [];
  const cx = (g.w - 1) / 2;
  const cy = (g.h - 1) / 2;
  const toX = (x: number) => Math.round((x - cx) * units);
  const toY = (y: number) => Math.round((cy - y) * units); // Y up

  let prevX = -999, prevY = -999, hasPrev = false;
  colors.forEach((color, ci) => {
    const cellsForColor: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < g.h; y++) {
      const xs: number[] = [];
      for (let x = 0; x < g.w; x++) if (getCell(g, x, y) === color) xs.push(x);
      if (y % 2 === 1) xs.reverse(); // snake
      for (const x of xs) cellsForColor.push({ x, y });
    }
    for (const cell of cellsForColor) {
      const far = !hasPrev || Math.hypot(cell.x - prevX, cell.y - prevY) > JUMP_CELLS;
      stitches.push({ x: toX(cell.x), y: toY(cell.y), flag: far ? "jump" : "stitch" });
      prevX = cell.x; prevY = cell.y; hasPrev = true;
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
  return { stitches, colors, units };
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
