// ============================================================
// Embroidery (§31, Phase 5) — design grid model (pure)
// ============================================================
// A counted design = a grid of cells, each empty (-1) or a thread-palette
// index. Pure, immutable-ish helpers (mutate a copied array then return it).
// ============================================================

import { GLYPH_W, GLYPH_H, glyph } from "./font.ts";

export interface Grid {
  w: number;
  h: number;
  cells: number[]; // length w*h; -1 = empty, else thread index
}

export const MIN_DIM = 5;
export const MAX_DIM = 200;

export function createGrid(w = 40, h = 30): Grid {
  const W = clampDim(w), H = clampDim(h);
  return { w: W, h: H, cells: new Array(W * H).fill(-1) };
}
function clampDim(n: number): number { return Math.max(MIN_DIM, Math.min(MAX_DIM, Math.round(n) || MIN_DIM)); }

export function idx(g: Grid, x: number, y: number): number { return y * g.w + x; }
export function inBounds(g: Grid, x: number, y: number): boolean { return x >= 0 && y >= 0 && x < g.w && y < g.h; }
export function getCell(g: Grid, x: number, y: number): number { return inBounds(g, x, y) ? g.cells[idx(g, x, y)] : -1; }

export function setCell(g: Grid, x: number, y: number, color: number): Grid {
  if (!inBounds(g, x, y)) return g;
  const cells = g.cells.slice();
  cells[idx(g, x, y)] = color;
  return { ...g, cells };
}

// Stamp text into the grid using the 5x7 font, top-left at (ox, oy), 1px gap.
export function stampText(g: Grid, text: string, ox: number, oy: number, color: number): Grid {
  const cells = g.cells.slice();
  let cx = ox;
  for (const ch of text) {
    const rows = glyph(ch);
    for (let ry = 0; ry < GLYPH_H; ry++) {
      for (let rx = 0; rx < GLYPH_W; rx++) {
        if (rows[ry][rx] === "#") {
          const x = cx + rx, y = oy + ry;
          if (x >= 0 && y >= 0 && x < g.w && y < g.h) cells[y * g.w + x] = color;
        }
      }
    }
    cx += GLYPH_W + 1;
  }
  return { ...g, cells };
}

// Pixel width a string needs (for centering helpers in the UI).
export function textWidth(text: string): number {
  return text.length === 0 ? 0 : text.length * (GLYPH_W + 1) - 1;
}

export function stitchCount(g: Grid): number {
  let n = 0;
  for (const c of g.cells) if (c >= 0) n++;
  return n;
}

export function usedColors(g: Grid): number[] {
  const set = new Set<number>();
  for (const c of g.cells) if (c >= 0) set.add(c);
  return [...set].sort((a, b) => a - b);
}

export interface Bounds { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number; }
export function bounds(g: Grid): Bounds | null {
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.cells[y * g.w + x] >= 0) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function clearGrid(g: Grid): Grid { return { ...g, cells: new Array(g.w * g.h).fill(-1) }; }

// Resize-and-recalculate: nearest-neighbor resample the design to a new cell
// count (keeps the picture, changes the stitch resolution).
export function resampleGrid(g: Grid, newW: number, newH: number): Grid {
  const W = Math.max(MIN_DIM, Math.min(MAX_DIM, Math.round(newW)));
  const H = Math.max(MIN_DIM, Math.min(MAX_DIM, Math.round(newH)));
  const out = createGrid(W, H);
  const cells = out.cells.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = Math.min(g.w - 1, Math.floor((x / W) * g.w));
    const sy = Math.min(g.h - 1, Math.floor((y / H) * g.h));
    cells[y * W + x] = g.cells[sy * g.w + sx];
  }
  return { ...out, cells };
}

export interface HoopTile { grid: Grid; col: number; row: number; ox: number; oy: number; }

// Split a design too big for one hoop into hoop-sized tiles you can stitch in
// sections. `cellsPerTileW/H` come from the hoop size ÷ stitch spacing.
export function splitForHoop(g: Grid, cellsPerTileW: number, cellsPerTileH: number): HoopTile[] {
  const tw = Math.max(MIN_DIM, Math.floor(cellsPerTileW));
  const th = Math.max(MIN_DIM, Math.floor(cellsPerTileH));
  const tiles: HoopTile[] = [];
  for (let oy = 0, row = 0; oy < g.h; oy += th, row++) {
    for (let ox = 0, col = 0; ox < g.w; ox += tw, col++) {
      const w = Math.min(tw, g.w - ox), hh = Math.min(th, g.h - oy);
      const tile = createGrid(Math.max(MIN_DIM, w), Math.max(MIN_DIM, hh));
      const cells = tile.cells.slice();
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) cells[y * tile.w + x] = g.cells[(oy + y) * g.w + (ox + x)];
      tiles.push({ grid: { ...tile, cells }, col, row, ox, oy });
    }
  }
  return tiles;
}
