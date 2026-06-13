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

import { nearestThread } from "./palette.ts";
import { createGrid, type Grid } from "./model.ts";

export interface DigitizeOptions {
  skipTransparent?: boolean; // alpha < 128 → empty (default true)
  skipWhite?: boolean;       // near-white → empty (treat as fabric) (default true)
  whiteCutoff?: number;      // brightness 0..255 above which a pixel counts as "white" (default 240)
}

// rgba: row-major RGBA, length = w*h*4 (one sample per grid cell).
export function gridFromPixels(rgba: ArrayLike<number>, w: number, h: number, opts: DigitizeOptions = {}): Grid {
  const skipTransparent = opts.skipTransparent ?? true;
  const skipWhite = opts.skipWhite ?? true;
  const whiteCutoff = opts.whiteCutoff ?? 240;
  const g = createGrid(w, h);
  const cells = g.cells.slice();
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4], gg = rgba[i * 4 + 1], b = rgba[i * 4 + 2], a = rgba[i * 4 + 3];
    if (skipTransparent && a < 128) { cells[i] = -1; continue; }
    if (skipWhite && r >= whiteCutoff && gg >= whiteCutoff && b >= whiteCutoff) { cells[i] = -1; continue; }
    cells[i] = nearestThread(r, gg, b);
  }
  return { ...g, cells };
}
