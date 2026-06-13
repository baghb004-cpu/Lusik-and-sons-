// ============================================================
// Photo Booth — composition layout (pure)
// ============================================================
// Where each captured photo goes on the final canvas, per layout.
// single = one big photo; strip = a vertical column; grid = 2 columns.
// A footer band holds the event name/date/logo. Pure geometry, tested.
// ============================================================

import type { BoothProject } from "./schemas.ts";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface BoothCanvas {
  width: number;
  height: number;
  cells: Rect[]; // one per photo, in order
  footer: Rect; // band for event name / logo
}

const PAD = 28;
const GAP = 20;
const FOOTER = 110;

/** How many photos a layout takes (single=1, grid=4, strip=photoCount). */
export function photoSlots(p: Pick<BoothProject, "layout" | "photoCount">): number {
  if (p.layout === "single") return 1;
  if (p.layout === "grid") return 4;
  return Math.min(4, Math.max(1, p.photoCount));
}

/** Compute the output canvas size + photo cells + footer band. */
export function boothCanvas(p: Pick<BoothProject, "layout" | "photoCount">): BoothCanvas {
  const n = photoSlots(p);
  const cells: Rect[] = [];

  if (p.layout === "single") {
    const w = 960, h = 720;
    const width = PAD * 2 + w;
    const height = PAD * 2 + h + FOOTER;
    cells.push({ x: PAD, y: PAD, w, h });
    return { width, height, cells, footer: { x: PAD, y: PAD + h + 10, w, h: FOOTER - 10 } };
  }

  if (p.layout === "grid") {
    const w = 460, h = 345, cols = 2, rows = 2;
    const width = PAD * 2 + cols * w + (cols - 1) * GAP;
    const height = PAD * 2 + rows * h + (rows - 1) * GAP + FOOTER;
    for (let i = 0; i < 4; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      cells.push({ x: PAD + c * (w + GAP), y: PAD + r * (h + GAP), w, h });
    }
    return { width, height, cells, footer: { x: PAD, y: height - FOOTER + 10, w: width - PAD * 2, h: FOOTER - 20 } };
  }

  // strip (vertical column)
  const w = 560, h = 420;
  const width = PAD * 2 + w;
  const height = PAD * 2 + n * h + (n - 1) * GAP + FOOTER;
  for (let i = 0; i < n; i++) cells.push({ x: PAD, y: PAD + i * (h + GAP), w, h });
  return { width, height, cells, footer: { x: PAD, y: height - FOOTER + 10, w, h: FOOTER - 20 } };
}
