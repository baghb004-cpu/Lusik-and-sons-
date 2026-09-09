// ============================================================
// STITCH CHARTS + PLANNER
// ============================================================
// This is the layer that decides what actually gets stitched onto a
// blanket a customer paid for, so it is tested rather than eyeballed.
// The planner is pure by design (no three, no canvas, no DOM) precisely
// so it can be checked here.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseChart, chartCells, chartFromSampler, centerChart,
  CUBE_OUTLINE, MOTIFS, SYMBOLS, CAPITAL_W, CAPITAL_H,
} from "../../../../src/loom/stitch/chart.js";
import {
  layoutText, planLine, orderStitches, planDesign,
} from "../../../../src/loom/stitch/planner.js";

// ---- charts -------------------------------------------------------------

test("a ragged chart is rejected, not quietly padded", () => {
  // A padded chart is a wrong letter on real cloth.
  assert.throws(() => parseChart(["XXX", "XX"]), /equal length/);
});

test("an illegal symbol is rejected and named", () => {
  assert.throws(() => parseChart(["X.Q"]), /"Q"/);
});

test("chartCells walks in working order and skips empties", () => {
  const chart = parseChart([".X.", "X.X"]);
  assert.deepEqual(chartCells(chart).map((c) => [c.x, c.y]), [[1, 0], [0, 1], [2, 1]]);
});

test("the sampler threshold decides what gets stitched", () => {
  // coverage below the threshold is bare cloth, at or above it is a stitch
  const chart = chartFromSampler((x) => (x === 0 ? 0.49 : 0.5), { w: 2, h: 1, threshold: 0.5 });
  assert.deepEqual(chart.rows, [".X"]);
});

test("a sampler returning junk does not produce a stitch", () => {
  const chart = chartFromSampler(() => NaN, { w: 2, h: 1 });
  assert.deepEqual(chart.rows, [".."]);
});

test("centerChart re-centres a glyph that the font placed off to one side", () => {
  // Armenian sits differently in the em box than Latin; every letter has
  // to end up centred in its own cube regardless.
  const offset = parseChart(["X....", ".....", "....."]);
  const centred = centerChart(offset, { w: 5, h: 3 });
  // centred on both axes: a letter has to sit in the middle of its cube
  assert.deepEqual(centred.rows, [".....", "..X..", "....."]);
});

test("centering an empty chart yields an empty chart of the right size", () => {
  const blank = centerChart(parseChart(["..", ".."]), { w: 3, h: 2 });
  assert.deepEqual(blank.rows, ["...", "..."]);
});

test("the cube outline is backstitch, not filled cells", () => {
  // It is the outline worked AROUND the letter; if it were full stitches
  // it would cover the letter it is supposed to frame.
  assert.equal(CUBE_OUTLINE.w, CAPITAL_W);
  assert.equal(CUBE_OUTLINE.h, CAPITAL_H);
  const kinds = new Set(chartCells(CUBE_OUTLINE).map((c) => c.sym));
  assert.ok(!kinds.has(SYMBOLS.FULL), "the cube outline must not contain full stitches");
});

test("every shipped motif parses and has stitches", () => {
  for (const [name, chart] of Object.entries(MOTIFS)) {
    assert.ok(chartCells(chart).length > 0, `${name} is blank`);
  }
});

// ---- layout -------------------------------------------------------------

test("a name that fits is centred in its slot", () => {
  // 4 chars of 3 wide with 1 gap = 15; in a 21-wide slot that leaves 3 each side.
  const { placements, dropped } = layoutText({ text: "OLEN", slotW: 21, charW: 3, gap: 1 });
  assert.equal(dropped, 0);
  assert.deepEqual(placements.map((p) => p.originX), [3, 7, 11, 15]);
});

test("a name too long is truncated, never shrunk", () => {
  // Lusik works a fixed grid. Scaling letters down would preview a
  // blanket that cannot be made.
  const { placements, dropped } = layoutText({ text: "ALEXANDRA", slotW: 11, charW: 3, gap: 1 });
  assert.equal(placements.length, 3);
  assert.equal(dropped, 6);
});

test("left alignment starts at the slot edge", () => {
  const { placements } = layoutText({ text: "AB", slotW: 20, charW: 3, gap: 1, align: "left" });
  assert.deepEqual(placements.map((p) => p.originX), [0, 4]);
});

test("empty and oversized-character cases do not throw", () => {
  assert.deepEqual(layoutText({ text: "", slotW: 10, charW: 3 }).placements, []);
  assert.equal(layoutText({ text: "AB", slotW: 2, charW: 3 }).placements.length, 0);
  assert.equal(layoutText({ text: "AB", slotW: 2, charW: 3 }).dropped, 2);
});

test("layout counts characters, not UTF-16 units", () => {
  // Armenian is outside ASCII; counting code units would mis-measure.
  const { placements } = layoutText({ text: "ԱԲԳ", slotW: 11, charW: 3, gap: 1 });
  assert.equal(placements.length, 3);
});

// ---- planning -----------------------------------------------------------

const BLOCK = parseChart(["XX", "XX"]);
const chartFor = (ch) => (ch === "?" ? null : BLOCK);

test("a planned line lands inside its slot", () => {
  const slot = { x: 10, y: 4, w: 8, h: 4 };
  const { stitches } = planLine({ text: "AB", slot, chartFor, color: "#2B4C73" });
  assert.ok(stitches.length > 0);
  for (const s of stitches) {
    assert.ok(s.x >= slot.x && s.x < slot.x + slot.w, `x ${s.x} outside slot`);
    assert.ok(s.y >= slot.y && s.y < slot.y + slot.h, `y ${s.y} outside slot`);
    assert.equal(s.color, "#2B4C73");
  }
});

test("an unknown character is reported and costs no layout width", () => {
  // If "?" consumed width, a letter that CAN be stitched would be pushed
  // out of the slot by one the font cannot draw.
  const slot = { x: 0, y: 0, w: 8, h: 4 };
  const withUnknown = planLine({ text: "A?B", slot, chartFor, color: "#000" });
  const without = planLine({ text: "AB", slot, chartFor, color: "#000" });
  assert.deepEqual(withUnknown.unknown, ["?"]);
  assert.deepEqual(
    withUnknown.stitches.map((s) => [s.x, s.y]),
    without.stitches.map((s) => [s.x, s.y]),
  );
});

test("whitespace is not reported as an unknown character", () => {
  const { unknown } = planLine({ text: "A B", slot: { x: 0, y: 0, w: 20, h: 4 }, chartFor: (c) => (c === " " ? null : BLOCK), color: "#000" });
  assert.deepEqual(unknown, []);
});

test("stitches are worked across rows, top to bottom", () => {
  const stitches = orderStitches([
    { x: 5, y: 1, sym: "X", color: "#000", order: 0 },
    { x: 1, y: 0, sym: "X", color: "#000", order: 0 },
    { x: 3, y: 0, sym: "X", color: "#000", order: 0 },
  ]);
  assert.deepEqual(stitches.map((s) => [s.x, s.y]), [[1, 0], [3, 0], [5, 1]]);
  assert.deepEqual(stitches.map((s) => s.order), [0, 1, 2]);
});

test("the outline is worked last, over the crosses", () => {
  // A stitcher fills the crosses then backstitches the outline. Replaying
  // it the other way round looks like a colouring book.
  const stitches = orderStitches([
    { x: 0, y: 0, sym: SYMBOLS.BACK_TOP, color: "#000", order: 0 },
    { x: 9, y: 9, sym: SYMBOLS.FULL, color: "#000", order: 0 },
  ]);
  assert.equal(stitches[0].sym, SYMBOLS.FULL);
  assert.equal(stitches[1].sym, SYMBOLS.BACK_TOP);
});

test("planDesign merges the fixed product stitches with the personalisation", () => {
  const fixed = [{ x: 0, y: 0, sym: "X", color: "#B08842", order: 0 }];
  const { stitches, dropped, unknown } = planDesign({
    fixed,
    chartFor,
    lines: [
      { text: "A", slot: { x: 2, y: 0, w: 4, h: 2 }, color: "#2B4C73" },
      { text: "??", slot: { x: 2, y: 4, w: 4, h: 2 }, color: "#2B4C73" },
    ],
  });
  assert.ok(stitches.some((s) => s.color === "#B08842"), "fixed stitches were dropped");
  assert.ok(stitches.some((s) => s.color === "#2B4C73"), "personalisation was dropped");
  assert.deepEqual(unknown, ["?"]);
  assert.equal(dropped, 0);
  // order is a dense 0..n-1 sequence over the merged list
  assert.deepEqual(stitches.map((s) => s.order), stitches.map((_, i) => i));
});

test("planDesign with no lines is the bare product", () => {
  const fixed = [{ x: 1, y: 1, sym: "X", color: "#B08842", order: 0 }];
  const { stitches } = planDesign({ fixed, chartFor, lines: [] });
  assert.equal(stitches.length, 1);
});
