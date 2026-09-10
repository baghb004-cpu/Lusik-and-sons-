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
  ARMENIAN_FLAG, CAPITAL_H, CAPITAL_W, CUBE_OUTLINE, LOWER_H, MOTIFS, STRAWBERRY,
  chartCells,
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

// ============================================================
// STITCHED LINES — the general case
// ============================================================
// The Hye Em Yes bib is one line in three colours; the set bibs are one
// or two lines in one colour, sometimes with a small motif worked between
// them. Same machinery, so it lives here rather than in each rig.

export interface StitchedLinesResult {
  stitches: Stitch[];
  /** Bounding size of the worked area, in chart cells. */
  width: number;
  height: number;
  /** Characters the font could not draw, so a rig can refuse to render. */
  unknown: string[];
}

/** Blank rows between one line and the next. */
const LINE_GAP = 4;
/** Blank rows above and below a motif sitting between two lines. */
const MOTIF_GAP = 2;

/**
 * Plan one or more lines of lowercase Armenian, centred on each other.
 *
 * Each line is measured with the same charts the planner will use — the
 * letterforms come out of the font, so their widths are only known once
 * the font is — and then placed, rather than laid into a slot of a guessed
 * width. Nothing is ever dropped, because the slot IS the line.
 *
 * A motif goes between the first two lines, which is where the
 * photographs put it (public/img/anushig-bib/cover.jpg).
 */
export function planStitchedLines({
  lines, color, motif = null,
}: {
  lines: string[];
  color: string;
  motif?: keyof typeof MOTIFS | null;
}): StitchedLinesResult {
  const chartFor = (char: string) => lowercaseChartForChar(char);
  const unknown: string[] = [];

  const measured = (lines ?? [])
    .map((text) => ({ text, w: measureLine({ text, chartFor, gap: LETTER_GAP }) }))
    .filter((line) => line.w > 0);
  if (measured.length === 0) return { stitches: [], width: 0, height: 0, unknown };

  const motifChart = motif ? MOTIFS[motif] : null;
  const width = Math.max(...measured.map((l) => l.w), motifChart?.w ?? 0);

  const stitches: Stitch[] = [];
  let y = 0;
  measured.forEach((line, i) => {
    const result = planLine({
      text: line.text,
      // Centred by giving the line the full width of the block and letting
      // the planner centre inside it.
      slot: { x: 0, y, w: width, h: LOWER_H },
      chartFor,
      color,
      gap: LETTER_GAP,
      align: "center",
    });
    stitches.push(...result.stitches);
    for (const u of result.unknown) if (!unknown.includes(u)) unknown.push(u);
    y += LOWER_H;

    // The motif sits between the first pair of lines only. On a one-line
    // piece there is no "between", and stitching it under the line would
    // be inventing a decoration the real bib does not have.
    if (motifChart && i === 0 && measured.length > 1) {
      y += MOTIF_GAP;
      const originX = Math.floor((width - motifChart.w) / 2);
      for (const cell of chartCells(motifChart)) {
        stitches.push({ x: originX + cell.x, y: y + cell.y, sym: cell.sym, color, order: 0 });
      }
      y += motifChart.h + MOTIF_GAP;
    } else if (i < measured.length - 1) {
      y += LINE_GAP;
    }
  });

  return {
    ...planDesign({ lines: [], chartFor: () => null, fixed: stitches }),
    width,
    height: y,
    unknown,
  };
}

// ============================================================
// THE BARI AKHORZHAK SET
// ============================================================

/**
 * The strawberry worked between the words of the blessing: a red body
 * under a green crown, two charts sharing one origin.
 *
 * The product's own copy says the motif varies by piece — a bottle, a
 * strawberry, a grape, a carrot — so this is one of Lusik's, not the
 * only one. It is the one in the photograph the rig was modelled from.
 */
export function planStrawberry(x = 0, y = 0): Stitch[] {
  const out: Stitch[] = [];
  const parts: [keyof typeof STRAWBERRY, string][] = [
    ["leaves", "#4E7A3A"],
    ["body", "#C4243B"],
  ];
  for (const [part, color] of parts) {
    for (const cell of chartCells(STRAWBERRY[part])) {
      out.push({ x: x + cell.x, y: y + cell.y, sym: cell.sym, color, order: 0 });
    }
  }
  return out;
}

/**
 * One piece of the Bari Akhorzhak set: two lines with the berry between
 * them, the way both the bib and the burp cloth are worked.
 */
export function planBlessing({ lines, color }: { lines: string[]; color: string }) {
  const words = planStitchedLines({ lines, color });
  if (words.stitches.length === 0) return words;

  // The berry sits between the two lines, a little right of centre, as
  // the photograph has it — dead centre reads as a bullet point.
  const rows = words.stitches.map((s) => s.y);
  const midY = Math.round((Math.min(...rows) + Math.max(...rows)) / 2) - 6;
  const berry = planStrawberry(Math.round(words.width * 0.52), midY);

  return {
    ...planDesign({ lines: [], chartFor: () => null, fixed: [...words.stitches, ...berry] }),
    width: words.width,
    height: words.height,
    unknown: words.unknown,
  };
}

/**
 * The name or initial on the cap. Uppercase Armenian or Latin, worked
 * small on the cuff — public/img/bari-akhorzhak-set/cover.jpg shows three
 * initials with a little motif beside them.
 *
 * Empty means a plain cap, which is a real state: the customer may add
 * the cap and leave the name blank, and the copy says Lusik then uses the
 * first initial. A stage that invented one would be showing a piece the
 * order does not describe.
 */
export function planCapName({ name, color }: { name: string; color: string }) {
  const text = String(name ?? "").trim();
  if (text.length === 0) return { stitches: [] as Stitch[], width: 0, height: 0, unknown: [] };
  return planStitchedLines({ lines: [text], color });
}
