// ============================================================
// Embroidery (§31, Phase 5) — auto-digitize artwork → counted design (pure)
// ============================================================
// Turn pixel data (the UI gets it from a <canvas> drawn at the target grid
// size) into a counted design: each cell maps to the nearest palette thread,
// with optional skipping of transparent / near-white pixels so the fabric
// shows through. Pure — the browser does the image decode + downscale; this
// does the color mapping. Honest: this is a flat color-reduction, not artistic
// digitizing, and it's labelled experimental in the UI.
// ============================================================

import { nearestThread, rgbOf, THREADS } from "./palette.ts";
import { createGrid, type Grid } from "./model.ts";

export interface DigitizeOptions {
  skipTransparent?: boolean; // alpha < 128 → empty (default true)
  skipWhite?: boolean;       // near-white → empty (treat as fabric) (default true)
  whiteCutoff?: number;      // brightness 0..255 above which a pixel counts as "white" (default 240)
  dither?: boolean;          // Floyd–Steinberg dithering for smoother photo blends (default false)
  maxColors?: number;        // keep only the N most-used threads (0 = no limit)
}

// rgba: row-major RGBA, length = w*h*4 (one sample per grid cell).
export function gridFromPixels(rgba: ArrayLike<number>, w: number, h: number, opts: DigitizeOptions = {}): Grid {
  const skipTransparent = opts.skipTransparent ?? true;
  const skipWhite = opts.skipWhite ?? true;
  const whiteCutoff = opts.whiteCutoff ?? 240;
  const dither = opts.dither ?? false;
  const g = createGrid(w, h);
  const cells = g.cells.slice();

  // working copy of the pixels (mutable for dithering error diffusion)
  const px = new Float32Array(w * h * 3);
  const skip = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4], gg = rgba[i * 4 + 1], b = rgba[i * 4 + 2], a = rgba[i * 4 + 3];
    if ((skipTransparent && a < 128) || (skipWhite && r >= whiteCutoff && gg >= whiteCutoff && b >= whiteCutoff)) { skip[i] = 1; }
    px[i * 3] = r; px[i * 3 + 1] = gg; px[i * 3 + 2] = b;
  }

  const spread = (i: number, er: number, eg: number, eb: number, f: number) => {
    if (i < 0 || i >= w * h || skip[i]) return;
    px[i * 3] += er * f; px[i * 3 + 1] += eg * f; px[i * 3 + 2] += eb * f;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (skip[i]) { cells[i] = -1; continue; }
      const r = px[i * 3], gg = px[i * 3 + 1], b = px[i * 3 + 2];
      const ti = nearestThread(r, gg, b);
      cells[i] = ti;
      if (dither) {
        const [tr, tg, tb] = rgbOf(THREADS[ti]);
        const er = r - tr, eg = gg - tg, eb = b - tb;
        spread(i + 1, er, eg, eb, 7 / 16);
        spread(i + w - 1, er, eg, eb, 3 / 16);
        spread(i + w, er, eg, eb, 5 / 16);
        spread(i + w + 1, er, eg, eb, 1 / 16);
      }
    }
  }

  let out: Grid = { ...g, cells };
  if (opts.maxColors && opts.maxColors > 0) out = reduceColors(out, opts.maxColors);
  return out;
}

// Keep only the N most-used threads; remap every other cell to its nearest
// surviving thread (so the design honors a "≤ N colors" limit).
export function reduceColors(g: Grid, maxColors: number): Grid {
  const counts = new Map<number, number>();
  for (const c of g.cells) if (c >= 0) counts.set(c, (counts.get(c) ?? 0) + 1);
  if (counts.size <= maxColors) return g;
  const keep = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxColors).map((e) => e[0]);
  const keepRgb = keep.map((i) => rgbOf(THREADS[i]));
  const remap = new Map<number, number>();
  for (const ci of counts.keys()) {
    if (keep.includes(ci)) { remap.set(ci, ci); continue; }
    const [r, gg, b] = rgbOf(THREADS[ci]);
    let best = keep[0], bestD = Infinity;
    keep.forEach((k, idx) => { const [tr, tg, tb] = keepRgb[idx]; const d = (r - tr) ** 2 + (gg - tg) ** 2 + (b - tb) ** 2; if (d < bestD) { bestD = d; best = k; } });
    remap.set(ci, best);
  }
  const cells = g.cells.map((c) => (c >= 0 ? remap.get(c) ?? c : -1));
  return { ...g, cells };
}
