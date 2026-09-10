// ============================================================
// STITCH PLANNER — a name and a slot become an ordered stitch list
// ============================================================
// The customer types "OLEN" and a birth year. This turns that into the
// stitches: which grid cell, which colour, and in what order. The
// renderer then places one instanced mesh per stitch and animates them in
// that order, so the piece appears to be worked rather than to fade in.
//
// Everything here is pure. It never touches three, a canvas, or the DOM,
// which is what lets the whole layout be tested in Node rather than
// eyeballed on a screen.
//
// Plain JavaScript with JSDoc, same reason as ../tier.js.
// ============================================================

import { chartCells, SYMBOLS } from "./chart.js";

/** @typedef {import("./chart.js").Chart} Chart */
/** @typedef {{ x: number, y: number, sym: string, color: string, order: number }} Stitch */

/**
 * Lay characters out along a slot and return each one's origin cell.
 *
 * Overflow is truncation, never shrinking. Lusik works on a fixed grid:
 * if a name does not fit in the slot, the extra letters do not exist on
 * the cloth, and the caller is told how many were dropped so the UI can
 * say so. Silently scaling the letters down would show the customer a
 * preview of a blanket that cannot be made.
 *
 * Capitals on the blanket are monospaced — each one is worked inside a
 * cube of the same size, so `charW` alone describes the whole line.
 * Lowercase is not: ի carries a fraction of ղ's ink, and spacing it as
 * though it did not would leave holes in the middle of a word. Pass
 * `widths` to lay a line out on each character's own width; leave it out
 * and the uniform path is unchanged.
 *
 * @param {object} input
 * @param {string} input.text
 * @param {number} input.slotW  slot width in cells
 * @param {number} [input.charW]  one character's chart width, when they all share one
 * @param {number[]} [input.widths]  per-character widths, in the order of `text`
 * @param {number} [input.gap]  cells between characters
 * @param {"center"|"left"} [input.align]
 * @returns {{ placements: {char: string, originX: number}[], dropped: number, usedW: number }}
 */
export function layoutText({ text, slotW, charW, widths, gap = 1, align = "center" }) {
  const chars = [...String(text ?? "")];
  const proportional = Array.isArray(widths);
  if (chars.length === 0 || slotW <= 0) {
    return { placements: [], dropped: 0, usedW: 0 };
  }
  if (!proportional && !(charW > 0)) {
    return { placements: [], dropped: 0, usedW: 0 };
  }

  // How many characters fit. Uniform is arithmetic; proportional has to
  // walk the line, because whether the sixth letter fits depends on which
  // five came before it.
  let fit;
  if (proportional) {
    fit = 0;
    let run = 0;
    for (let i = 0; i < chars.length; i += 1) {
      const w = widths[i] ?? 0;
      const next = run === 0 ? w : run + gap + w;
      if (next > slotW) break;
      run = next;
      fit += 1;
    }
  } else {
    fit = Math.floor((slotW + gap) / (charW + gap));
  }
  if (fit < 0) fit = 0;
  const kept = chars.slice(0, fit);
  const dropped = chars.length - kept.length;

  let usedW = 0;
  if (kept.length > 0) {
    usedW = proportional
      ? kept.reduce((sum, _c, i) => sum + (widths[i] ?? 0), 0) + (kept.length - 1) * gap
      : kept.length * charW + (kept.length - 1) * gap;
  }
  const startX = align === "center" ? Math.floor((slotW - usedW) / 2) : 0;

  let cursor = startX;
  const placements = kept.map((char, i) => {
    const originX = cursor;
    cursor += (proportional ? (widths[i] ?? 0) : charW) + gap;
    return { char, originX };
  });
  return { placements, dropped, usedW };
}

/**
 * How wide a line of text would be worked, in cells, ignoring any slot.
 *
 * The Hye Em Yes bib needs this: three words, three colours, one line.
 * Each word is planned into its own slot so it can carry its own thread,
 * and the slots can only be placed once someone knows how wide the words
 * are. Measuring with the same charts the planner will use is what keeps
 * the answer honest — an estimate would drift the moment a font changed.
 *
 * @param {object} input
 * @param {string} input.text
 * @param {(char: string) => Chart | null} input.chartFor
 * @param {number} [input.gap]
 * @returns {number}
 */
export function measureLine({ text, chartFor, gap = 1 }) {
  const charts = [...String(text ?? "")]
    .map((char) => chartFor(char))
    .filter(Boolean);
  if (charts.length === 0) return 0;
  return charts.reduce((sum, c) => sum + c.w, 0) + (charts.length - 1) * gap;
}

/**
 * Plan the stitches for one line of text inside a slot.
 *
 * @param {object} input
 * @param {string} input.text
 * @param {{ x: number, y: number, w: number, h: number }} input.slot  slot rect in blanket-grid cells
 * @param {(char: string) => Chart | null} input.chartFor  resolve a character's chart, null if unknown
 * @param {string} input.color  thread colour for this line (a DMC hex)
 * @param {number} [input.gap]
 * @param {"center"|"left"} [input.align]
 * @returns {{ stitches: Stitch[], dropped: number, unknown: string[] }}
 */
export function planLine({ text, slot, chartFor, color, gap = 1, align = "center" }) {
  const unknown = [];
  const chars = [...String(text ?? "")];

  // Resolve charts first so an unknown character costs no layout width —
  // otherwise a character the font cannot draw would push a letter that
  // CAN be stitched off the end of the slot.
  const resolved = [];
  for (const char of chars) {
    const chart = chartFor(char);
    if (!chart) {
      if (char.trim() !== "") unknown.push(char);
      continue;
    }
    resolved.push({ char, chart });
  }
  if (resolved.length === 0) return { stitches: [], dropped: 0, unknown };

  const charW = resolved[0].chart.w;
  const charH = resolved[0].chart.h;
  // Charts of one width are the blanket's cubes; charts of several are
  // lowercase, trimmed to their own ink. Detecting it here rather than
  // taking a flag means a caller cannot get it wrong.
  const uniform = resolved.every((r) => r.chart.w === charW);
  const { placements, dropped } = layoutText({
    text: resolved.map((r) => r.char).join(""),
    slotW: slot.w,
    charW,
    widths: uniform ? undefined : resolved.map((r) => r.chart.w),
    gap,
    align,
  });

  // Vertically centre the line in the slot. Every chart in a line shares
  // a height by construction (capitals share a cube, lowercase shares the
  // baseline box), so one offset lines them all up; the max is belt and
  // braces against a caller mixing the two, which would otherwise push a
  // taller chart off the bottom of the slot.
  const lineH = resolved.reduce((max, r) => Math.max(max, r.chart.h), charH);
  const originY = slot.y + Math.floor((slot.h - lineH) / 2);

  const stitches = [];
  placements.forEach((placement, i) => {
    const { chart } = resolved[i];
    for (const cell of chartCells(chart)) {
      stitches.push({
        x: slot.x + placement.originX + cell.x,
        y: originY + cell.y,
        sym: cell.sym,
        color,
        order: 0,
      });
    }
  });

  return { stitches: orderStitches(stitches), dropped, unknown };
}

/**
 * Put a stitch list into working order: across each row, top to bottom,
 * with the outline (backstitch) worked last.
 *
 * That last part is not cosmetic. A cross-stitcher fills the crosses and
 * then backstitches the outline over them, and the animation replays this
 * order, so the cube outline draws itself around a letter that is already
 * there. Doing it the other way round looks like a colouring book.
 *
 * @param {Stitch[]} stitches
 * @returns {Stitch[]}
 */
export function orderStitches(stitches) {
  const isOutline = (s) => s.sym === SYMBOLS.BACK_TOP || s.sym === SYMBOLS.BACK_LEFT;
  const sorted = stitches.slice().sort((a, b) => {
    const ao = isOutline(a) ? 1 : 0;
    const bo = isOutline(b) ? 1 : 0;
    if (ao !== bo) return ao - bo;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
  return sorted.map((s, i) => ({ ...s, order: i }));
}

/**
 * Plan a whole design: the fixed alphabet cubes plus the customer's lines.
 *
 * @param {object} input
 * @param {{ text: string, slot: {x:number,y:number,w:number,h:number}, color: string, gap?: number, align?: "center"|"left" }[]} input.lines
 * @param {(char: string) => Chart | null} input.chartFor
 * @param {Stitch[]} [input.fixed]  stitches that are part of the product, not the personalisation
 * @returns {{ stitches: Stitch[], dropped: number, unknown: string[] }}
 */
export function planDesign({ lines, chartFor, fixed = [] }) {
  let dropped = 0;
  const unknown = [];
  const all = fixed.slice();
  for (const line of lines ?? []) {
    const result = planLine({ ...line, chartFor });
    all.push(...result.stitches);
    dropped += result.dropped;
    for (const u of result.unknown) if (!unknown.includes(u)) unknown.push(u);
  }
  return { stitches: orderStitches(all), dropped, unknown };
}
