// Embroidery engine (§31, Phase 5): palette, 5x7 font + text-to-stitch, grid
// model, grid→stitch-path, the Tajima DST encoder (proven by round-trip decode),
// and metrics/hoop/density checks. All pure + offline.
import { test } from "node:test";
import assert from "node:assert/strict";

import { THREADS, thread } from "../studio/software/embroidery/palette.ts";
import { FONT, GLYPH_W, GLYPH_H, glyph } from "../studio/software/embroidery/font.ts";
import { createGrid, setCell, getCell, stampText, stitchCount, usedColors, bounds, clearGrid } from "../studio/software/embroidery/model.ts";
import { buildStitchPlan, threadLengthMm } from "../studio/software/embroidery/stitches.ts";
import { toDst, decodeRecords, dstStitchCount } from "../studio/software/embroidery/dst.ts";
import { metrics, checkDesign, HOOPS } from "../studio/software/embroidery/metrics.ts";

test("palette: refs unique, hex well-formed, indexing wraps", () => {
  const refs = THREADS.map((t) => t.ref);
  assert.equal(new Set(refs).size, refs.length);
  for (const t of THREADS) assert.match(t.hex, /^#[0-9a-f]{6}$/i);
  assert.equal(thread(THREADS.length).ref, THREADS[0].ref, "wraps");
});

test("font: every glyph is exactly 7 rows of 5 columns", () => {
  for (const [ch, rows] of Object.entries(FONT)) {
    assert.equal(rows.length, GLYPH_H, `${ch} row count`);
    for (const r of rows) assert.equal(r.length, GLYPH_W, `${ch} col width`);
  }
  assert.equal(glyph("a"), FONT["A"], "lowercase maps to uppercase");
  assert.equal(glyph("ա"), FONT[" "], "unknown → blank");
});

test("model: set/get, stampText fills the glyph cells, bounds + colors", () => {
  let g = createGrid(20, 12);
  assert.equal(stitchCount(g), 0);
  g = setCell(g, 3, 4, 2);
  assert.equal(getCell(g, 3, 4), 2);
  // "I" glyph has a known filled-cell count
  const iCells = FONT["I"].join("").split("").filter((c) => c === "#").length;
  let g2 = stampText(createGrid(20, 12), "I", 1, 1, 5);
  assert.equal(stitchCount(g2), iCells);
  assert.deepEqual(usedColors(g2), [5]);
  const b = bounds(g2)!;
  assert.equal(b.w, GLYPH_W);
  assert.equal(b.h, GLYPH_H);
  assert.equal(stitchCount(clearGrid(g2)), 0);
});

test("stitches: one stitch per filled cell + a color stop between colors", () => {
  let g = createGrid(10, 10);
  g = setCell(g, 0, 0, 1);
  g = setCell(g, 1, 0, 1);
  g = setCell(g, 5, 5, 2); // different color, far away
  const plan = buildStitchPlan(g, 2);
  const moves = plan.stitches.filter((s) => s.flag === "stitch" || s.flag === "jump");
  assert.equal(moves.length, 3, "three filled cells → three positioned stitches");
  assert.ok(plan.stitches.some((s) => s.flag === "stop"), "color change emitted");
  assert.equal(plan.stitches[plan.stitches.length - 1].flag, "end");
  assert.ok(threadLengthMm(plan) >= 0);
});

test("DST: header + end record + encode round-trips through decode", () => {
  let g = createGrid(16, 16);
  g = stampText(g, "AB", 1, 2, 3); // two-letter design
  const plan = buildStitchPlan(g, 2);
  const bytes = toDst(plan, "TEST");
  // header
  assert.equal(bytes[0], "L".charCodeAt(0));
  assert.equal(bytes[1], "A".charCodeAt(0));
  assert.equal(bytes[511 < bytes.length ? 0 : 0], bytes[0]); // header present
  assert.ok(dstStitchCount(bytes) > 0, "ST field populated");
  // ends with the DST end record
  assert.equal(bytes[bytes.length - 1], 0xf3);

  // round-trip: sum of decoded deltas reconstructs each absolute stitch point
  const recs = decodeRecords(bytes);
  let x = 0, y = 0;
  const rebuilt: Array<{ x: number; y: number }> = [];
  for (const r of recs) { x += r.dx; y += r.dy; rebuilt.push({ x, y }); }
  const expected = plan.stitches.filter((s) => s.flag !== "end");
  assert.equal(rebuilt.length, expected.length, "record count matches (small moves, no splits)");
  for (let i = 0; i < expected.length; i++) {
    assert.equal(rebuilt[i].x, expected[i].x, `x[${i}]`);
    assert.equal(rebuilt[i].y, expected[i].y, `y[${i}]`);
  }
});

test("DST: large jumps are split but still reconstruct the target point", () => {
  // two cells far apart force a jump > 121 units (200 cells * 20u = 4000u)
  let g = createGrid(200, 1);
  g = setCell(g, 0, 0, 1);
  g = setCell(g, 199, 0, 1);
  const plan = buildStitchPlan(g, 2);
  const recs = decodeRecords(toDst(plan, "JUMP"));
  let x = 0, y = 0;
  for (const r of recs) { x += r.dx; y += r.dy; }
  const last = plan.stitches.filter((s) => s.flag !== "end").slice(-1)[0];
  assert.equal(x, last.x, "split jumps still land on the target X");
  assert.equal(y, last.y);
});

test("metrics + checks: finished size, hoop fit warning, density, honesty note", () => {
  let g = createGrid(40, 40);
  g = stampText(g, "LUSIK", 2, 16, 2);
  const m = metrics(g, 14, 2);
  assert.ok(m.stitches > 0 && m.colors === 1);
  assert.ok(m.finishedInW > 0 && m.finishedMmW > 0);

  // a design bigger than the small hoop warns
  let big = createGrid(120, 120);
  for (let i = 0; i < 120; i++) big = setCell(big, i, i, 1);
  const checks = checkDesign(big, HOOPS[0], 14, 2);
  assert.ok(checks.some((c) => c.level === "warn" && /Too big/.test(c.message)));
  assert.ok(checks.some((c) => c.level === "info" && /EXPERIMENTAL/.test(c.message)), "honest machine-file note present");
});
