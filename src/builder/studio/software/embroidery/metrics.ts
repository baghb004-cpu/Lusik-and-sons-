// ============================================================
// Embroidery (§31, Phase 5) — metrics, hoop fit, density & honesty checks
// ============================================================
// Pure helpers that turn a design into the numbers + plain-English warnings a
// stitcher needs: finished size, thread estimate, density, hoop fit, and the
// standing "this is experimental / not a tested machine file" note.
// ============================================================

import { bounds, stitchCount, usedColors, type Grid } from "./model.ts";
import { buildStitchPlan, threadLengthMm, type StitchStyle } from "./stitches.ts";

export interface Hoop { name: string; wmm: number; hmm: number; }
export const HOOPS: Hoop[] = [
  { name: "Small 4×4 in (100×100mm)", wmm: 100, hmm: 100 },
  { name: "Medium 5×7 in (130×180mm)", wmm: 130, hmm: 180 },
  { name: "Large 6×10 in (160×260mm)", wmm: 160, hmm: 260 },
  { name: "XL 8×8 in (200×200mm)", wmm: 200, hmm: 200 },
];

export interface DesignMetrics {
  stitches: number;
  colors: number;
  cellsW: number;
  cellsH: number;
  finishedInW: number;
  finishedInH: number;
  finishedMmW: number;
  finishedMmH: number;
  threadMeters: number;
  fillPct: number;
}

// `count` = Aida count (holes per inch) for hand cross-stitch sizing.
// `mmPerCell` = stitch spacing for the machine file.
export function metrics(g: Grid, count = 14, mmPerCell = 2, style: StitchStyle = "cross"): DesignMetrics {
  const b = bounds(g);
  const cw = b ? b.w : 0, ch = b ? b.h : 0;
  const sc = stitchCount(g);
  const plan = buildStitchPlan(g, mmPerCell, style);
  return {
    stitches: sc,
    colors: usedColors(g).length,
    cellsW: cw,
    cellsH: ch,
    finishedInW: round1(cw / count),
    finishedInH: round1(ch / count),
    finishedMmW: round1(cw * mmPerCell),
    finishedMmH: round1(ch * mmPerCell),
    threadMeters: round1(threadLengthMm(plan) / 1000),
    fillPct: g.w * g.h ? Math.round((sc / (g.w * g.h)) * 100) : 0,
  };
}

export interface Check { level: "ok" | "warn" | "info"; message: string; }

export function checkDesign(g: Grid, hoop: Hoop, count = 14, mmPerCell = 2, style: StitchStyle = "cross"): Check[] {
  const m = metrics(g, count, mmPerCell, style);
  const out: Check[] = [];

  if (m.stitches === 0) { out.push({ level: "warn", message: "Empty design — paint some cells or stamp text." }); return out; }

  // hoop fit (machine size)
  if (m.finishedMmW > hoop.wmm || m.finishedMmH > hoop.hmm) {
    out.push({ level: "warn", message: `Too big for the ${hoop.name}: design is ${m.finishedMmW}×${m.finishedMmH}mm. Shrink it, lower stitch spacing, or pick a larger hoop.` });
  } else {
    out.push({ level: "ok", message: `Fits the ${hoop.name} (${m.finishedMmW}×${m.finishedMmH}mm).` });
  }

  // density
  if (m.fillPct > 70) out.push({ level: "warn", message: `Very dense fill (${m.fillPct}%). On thin fabric this can pucker — use stabilizer or lighten the fill.` });

  // color changes
  if (m.colors > 8) out.push({ level: "warn", message: `${m.colors} thread colors — lots of changes. Consider merging similar shades.` });

  // honesty
  const how = style === "cross" ? "a real cross-stitch X per cell" : "one tacking stitch per cell";
  out.push({ level: "info", message: `Chart + size are accurate. The machine file (DST/PES) is EXPERIMENTAL — ${how}: test on your machine with stabilizer before a final piece.` });
  return out;
}

function round1(n: number): number { return Math.round(n * 10) / 10; }

// cells that fit in a hoop at the current stitch spacing (for multi-hoop split)
export function hoopCells(hoop: Hoop, mmPerCell: number): { w: number; h: number } {
  return { w: Math.floor(hoop.wmm / Math.max(0.5, mmPerCell)), h: Math.floor(hoop.hmm / Math.max(0.5, mmPerCell)) };
}

// --- production: job costing + sew-time estimate ---------------------------
export interface CostInput { stitches: number; colors: number; pieces?: number; ratePerKStitch?: number; setupFee?: number; colorFee?: number; stitchesPerMin?: number; }
export interface CostResult { minutesEach: number; priceEach: number; priceTotal: number; }
export function jobCost(i: CostInput): CostResult {
  const pieces = Math.max(1, i.pieces ?? 1);
  const ratePerK = i.ratePerKStitch ?? 1.0;
  const setup = i.setupFee ?? 5;
  const colorFee = i.colorFee ?? 0.5;
  const spm = Math.max(60, i.stitchesPerMin ?? 700);
  const minutesEach = round1(i.stitches / spm);
  const priceEach = Math.round((setup + (i.stitches / 1000) * ratePerK + i.colors * colorFee) * 100) / 100;
  return { minutesEach, priceEach, priceTotal: Math.round(priceEach * pieces * 100) / 100 };
}
