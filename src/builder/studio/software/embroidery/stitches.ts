// ============================================================
// Embroidery (§31, Phase 5) — grid → ordered stitch path (pure)
// ============================================================
// Turns a counted design into a machine-ready stitch sequence, ordered per
// color in a boustrophedon (snake) sweep to minimize jumps, with a color-change
// ("stop") between colors. Coordinates are in 0.1mm units, origin at the design
// center, Y up.
//
// Stitch styles:
//   cross   — an authentic X per filled cell (counted cross-stitch)
//   tatami  — one tacking stitch per cell (light, fast)
//   running — a running line along each row-run (outline / redwork look)
// Plus optional underlay (a coarse first pass that stabilizes the fabric) and
// pull compensation (slightly enlarges the design to counter fabric pull-in).
// Honest v1: grid-based, not vector satin columns — labelled in the UI.
// ============================================================

import { getCell, usedColors, type Grid } from "./model.ts";

export type StitchFlag = "stitch" | "jump" | "stop" | "end";
export type StitchStyle = "cross" | "tatami" | "running";
export interface Stitch { x: number; y: number; flag: StitchFlag; }
export interface PlanOptions { underlay?: boolean; pullCompMm?: number; }
export interface StitchPlan {
  stitches: Stitch[];
  colors: number[];          // thread index per color block, in stitch order
  units: number;             // 0.1mm units per cell
  style: StitchStyle;
}

function jumpDist(units: number) { return units * 1.9; }

// contiguous horizontal runs of one color in a row, snake-ordered
function rowRuns(g: Grid, color: number): Array<{ y: number; x0: number; x1: number }> {
  const runs: Array<{ y: number; x0: number; x1: number }> = [];
  for (let y = 0; y < g.h; y++) {
    let start = -1;
    for (let x = 0; x <= g.w; x++) {
      const on = x < g.w && getCell(g, x, y) === color;
      if (on && start < 0) start = x;
      if (!on && start >= 0) { runs.push({ y, x0: start, x1: x - 1 }); start = -1; }
    }
  }
  return runs;
}

export function buildStitchPlan(g: Grid, mmPerCell = 2, style: StitchStyle = "cross", opts: PlanOptions = {}): StitchPlan {
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
  const dot = (ux: number, uy: number) => { const far = !hasPrev || Math.hypot(ux - prevX, uy - prevY) > jumpDist(units); push(ux, uy, far ? "jump" : "stitch"); };

  colors.forEach((color, ci) => {
    // optional underlay: a coarse running pass along every other row-run
    if (opts.underlay) {
      rowRuns(g, color).filter((_, i) => i % 2 === 0).forEach((run) => {
        push(X(run.x0), Y(run.y), "jump");
        push(X(run.x1), Y(run.y), "stitch");
      });
    }

    if (style === "running") {
      for (const run of rowRuns(g, color)) {
        push(X(run.x0), Y(run.y), "jump");
        for (let x = run.x0 + 1; x <= run.x1; x++) push(X(x), Y(run.y), "stitch");
      }
    } else {
      const cells: Array<{ x: number; y: number }> = [];
      for (let y = 0; y < g.h; y++) {
        const xs: number[] = [];
        for (let x = 0; x < g.w; x++) if (getCell(g, x, y) === color) xs.push(x);
        if (y % 2 === 1) xs.reverse(); // snake
        for (const x of xs) cells.push({ x, y });
      }
      for (const c of cells) {
        const ux = X(c.x), uy = Y(c.y);
        if (style === "tatami") dot(ux, uy);
        else {
          push(R(ux - h), R(uy - h), "jump"); push(R(ux + h), R(uy + h), "stitch");
          push(R(ux - h), R(uy + h), "jump"); push(R(ux + h), R(uy - h), "stitch");
        }
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

  // pull compensation: scale the whole path outward from the origin
  const pull = opts.pullCompMm ?? 0;
  if (pull > 0) {
    let span = 1;
    for (const s of stitches) span = Math.max(span, Math.abs(s.x), Math.abs(s.y));
    const f = 1 + (pull * 10) / (span * 2);
    for (const s of stitches) { s.x = Math.round(s.x * f); s.y = Math.round(s.y * f); }
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
