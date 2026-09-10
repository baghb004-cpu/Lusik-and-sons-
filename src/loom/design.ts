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
import { ARMENIAN_FLAG_COLORS, HYE_EM_YES_WORDS } from "../data/hyeEmYes.js";
import {
  ARMENIAN_FLAG, CAPITAL_H, CAPITAL_W, CUBE_OUTLINE, LOWER_H, chartCells,
} from "./stitch/chart.js";
import { measureLine, planDesign, planLine } from "./stitch/planner.js";
import { lowercaseChartForChar, makeChartResolver } from "./stitch/rasterize.js";
import type { LoomDesign } from "./types";

/** A planned stitch, as the planner emits and the stitch mesh consumes. */
interface Stitch { x: number; y: number; sym: string; color: string; order: number }

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

// ============================================================
// HYE EM YES
// ============================================================
// Three words, one line, three colours: red հայ, blue եմ, orange ես.
// Reference: public/img/hye-em-bib/cover.jpg and 02.jpg.
//
// Nothing here is personalised. The words are the product and the flag
// is the design, so this plans the same stitches every time and the rig
// only re-plans when the webfont arrives with better letterforms.

/** Cells between letters inside a word, and between words. */
const LETTER_GAP = 1;
const WORD_GAP = 5;

/**
 * The flag on the cap's brim, as stitches. Four charts sharing one
 * origin — see ARMENIAN_FLAG for why it is four and not one.
 */
export function planCapFlag() {
  const parts: [keyof typeof ARMENIAN_FLAG, string][] = [
    ["pole", ARMENIAN_FLAG_COLORS.pole],
    ["red", ARMENIAN_FLAG_COLORS.red],
    ["blue", ARMENIAN_FLAG_COLORS.blue],
    ["orange", ARMENIAN_FLAG_COLORS.orange],
  ];
  const stitches: Stitch[] = [];
  for (const [part, color] of parts) {
    for (const cell of chartCells(ARMENIAN_FLAG[part])) {
      stitches.push({ x: cell.x, y: cell.y, sym: cell.sym, color, order: 0 });
    }
  }
  // Working order: down the pole, then the bands top to bottom, which is
  // what planDesign's row-major ordering already gives.
  return planDesign({ lines: [], chartFor: () => null, fixed: stitches });
}

/**
 * The bib's line of lettering, as stitches on a shared baseline.
 *
 * Each word is planned into its own slot so it can carry its own thread,
 * and the slots are placed from the measured widths rather than from a
 * guess: the letterforms come out of the font, so their widths are only
 * known once the font is.
 */
export function planHyeEmYes() {
  const chartFor = (char: string) => lowercaseChartForChar(char);

  const widths = HYE_EM_YES_WORDS.map((word) =>
    measureLine({ text: word.text, chartFor, gap: LETTER_GAP }));
  const total = widths.reduce((sum, w) => sum + w, 0) + WORD_GAP * (HYE_EM_YES_WORDS.length - 1);

  const stitches: Stitch[] = [];
  let x = 0;
  // A zero total means the font could draw none of it — no Armenian in
  // the fallback face, most likely, and the webfont has not landed yet.
  // The loop below then simply produces nothing, and the rig keeps its
  // poster rather than showing a bare bib. Re-planning after the font
  // loads is the rig's job.
  HYE_EM_YES_WORDS.forEach((word, i) => {
    const w = widths[i];
    if (w > 0) {
      const line = planLine({
        text: word.text,
        // The slot IS the word: it was measured from these same charts,
        // so nothing can be dropped and "center" and "left" agree.
        slot: { x, y: 0, w, h: LOWER_H },
        chartFor,
        color: word.color,
        gap: LETTER_GAP,
        align: "left",
      });
      stitches.push(...line.stitches);
    }
    x += w + WORD_GAP;
  });

  return {
    ...planDesign({ lines: [], chartFor: () => null, fixed: stitches }),
    width: Math.max(0, total),
    height: LOWER_H,
  };
}
