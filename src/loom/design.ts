// ============================================================
// DESIGN — a configurator state becomes a stitch list
// ============================================================
// Deliberately inside the engine chunk. The planner and the glyph
// rasteriser are small, but importing them from page code would put them
// in the product route's first-load JS for a feature most visitors never
// trigger. LoomStage imports this only after the engine is armed.
//
// Cell PLACEMENT is not decided here: it comes from
// src/data/blanketLayout.js, the same module the 2D BlanketLayoutPreview
// uses. That is the point — the customer sees the 2D preview and the 3D
// stage side by side, and they must be the same blanket.
// ============================================================

import { buildLayoutCells, GRID } from "../data/blanketLayout.js";
import { CAPITAL_H, CAPITAL_W, CUBE_OUTLINE } from "./stitch/chart.js";
import { planDesign } from "./stitch/planner.js";
import { makeChartResolver } from "./stitch/rasterize.js";
import type { LoomDesign } from "./LoomStage";

/**
 * Turn the configurator's state into every stitch on the cloth.
 *
 * Alphabet cells get a backstitched cube around the letter; text cells
 * do not, because the real blanket stitches the name and year straight
 * onto the waffle weave rather than inside a cube frame.
 */
export function planDesignFor(design: LoomDesign) {
  const chartFor = makeChartResolver({});
  const cells = buildLayoutCells({
    letters: design.letters ?? [],
    layout: design.layout ?? { preview: [] },
    line1: design.line1,
    line2: design.line2,
    // A "your name goes here" hint is guidance for the form, not thread.
    // Stitching it would show a blanket reading the word "name".
    showHints: false,
  });

  const lines: Parameters<typeof planDesign>[0]["lines"] = [];
  const fixed: NonNullable<Parameters<typeof planDesign>[0]["fixed"]> = [];

  cells.forEach((cell, pos) => {
    if (!cell) return;
    const x = (pos % GRID) * CAPITAL_W;
    const y = Math.floor(pos / GRID) * CAPITAL_H;

    if (cell.kind === "alphabet") {
      const color = design.letterColors?.length
        ? design.letterColors[(cell.letterIdx ?? 0) % design.letterColors.length]
        : design.letterColor;
      lines.push({ text: cell.glyph ?? "", slot: { x, y, w: CAPITAL_W, h: CAPITAL_H }, color });
      // The cube is part of the product, not the personalisation, so it
      // is "fixed": it does not move when the customer retypes a name.
      for (let cy = 0; cy < CUBE_OUTLINE.h; cy += 1) {
        const row = CUBE_OUTLINE.rows[cy];
        for (let cx = 0; cx < CUBE_OUTLINE.w; cx += 1) {
          const sym = row[cx];
          if (sym === ".") continue;
          fixed.push({ x: x + cx, y: y + cy, sym, color: design.blockColor, order: 0 });
        }
      }
      return;
    }

    if (cell.kind === "text" && cell.glyph && !cell.placeholder) {
      lines.push({
        text: cell.glyph,
        slot: { x, y, w: CAPITAL_W, h: CAPITAL_H },
        color: design.letterColor,
      });
    }
    // Pomegranate cells are woven into the cloth, not stitched on top —
    // they belong to the fabric texture, not the stitch list.
  });

  return planDesign({ lines, chartFor, fixed });
}
