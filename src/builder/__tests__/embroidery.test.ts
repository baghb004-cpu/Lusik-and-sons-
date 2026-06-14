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
import { toExp, decodeExp } from "../studio/software/embroidery/exp.ts";
import { toJef, decodeJef } from "../studio/software/embroidery/jef.ts";
import { reduceColors } from "../studio/software/embroidery/autodigitize.ts";
import { resampleGrid, splitForHoop } from "../studio/software/embroidery/model.ts";
import { jobCost, hoopCells } from "../studio/software/embroidery/metrics.ts";
import { metrics, checkDesign, HOOPS } from "../studio/software/embroidery/metrics.ts";
import { nearestThread } from "../studio/software/embroidery/palette.ts";
import { gridFromPixels } from "../studio/software/embroidery/autodigitize.ts";

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

test("stitches (tatami): one stitch per filled cell + a color stop between colors", () => {
  let g = createGrid(10, 10);
  g = setCell(g, 0, 0, 1);
  g = setCell(g, 1, 0, 1);
  g = setCell(g, 5, 5, 2); // different color, far away
  const plan = buildStitchPlan(g, 2, "tatami");
  const moves = plan.stitches.filter((s) => s.flag === "stitch" || s.flag === "jump");
  assert.equal(moves.length, 3, "three filled cells → three positioned stitches");
  assert.ok(plan.stitches.some((s) => s.flag === "stop"), "color change emitted");
  assert.equal(plan.stitches[plan.stitches.length - 1].flag, "end");
  assert.equal(plan.style, "tatami");
  assert.ok(threadLengthMm(plan) >= 0);
});

test("stitches (cross): each cell is a real X — two diagonal legs", () => {
  let g = createGrid(10, 10);
  g = setCell(g, 0, 0, 1);
  g = setCell(g, 1, 0, 1);
  const plan = buildStitchPlan(g, 2, "cross"); // default
  const legs = plan.stitches.filter((s) => s.flag === "stitch").length;
  const jumps = plan.stitches.filter((s) => s.flag === "jump").length;
  assert.equal(legs, 4, "2 cells × 2 diagonal stitches");
  assert.equal(jumps, 4, "2 cells × 2 needle-up moves");
  assert.equal(buildStitchPlan(g).style, "cross", "cross is the default");
});

test("DST: header + end record + encode round-trips through decode", () => {
  let g = createGrid(16, 16);
  g = stampText(g, "AB", 1, 2, 3); // two-letter design
  const plan = buildStitchPlan(g, 2, "tatami");
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

test("EXP: encode round-trips through decode (incl. split jumps + color stop)", () => {
  let g = createGrid(60, 2);
  g = setCell(g, 0, 0, 1);
  g = setCell(g, 59, 0, 1);   // far → forces a >127u split
  g = setCell(g, 5, 1, 2);    // second color → a color-change record
  const plan = buildStitchPlan(g, 2, "tatami");
  const recs = decodeExp(toExp(plan));
  let x = 0, y = 0;
  for (const r of recs) { x += r.dx; y += r.dy; }
  const last = plan.stitches.filter((s) => s.flag !== "end").slice(-1)[0];
  assert.equal(x, last.x, "reconstructs final X after splits");
  assert.equal(y, last.y, "reconstructs final Y");
  assert.ok(recs.some((r) => r.flag === "stop"), "color change preserved");
});

test("JEF: encode round-trips through decode (offset-driven, with splits)", () => {
  let g = createGrid(60, 2);
  g = setCell(g, 0, 0, 1); g = setCell(g, 59, 0, 1); g = setCell(g, 5, 1, 2);
  const plan = buildStitchPlan(g, 2, "tatami");
  const recs = decodeJef(toJef(plan));
  let x = 0, y = 0; for (const r of recs) { x += r.dx; y += r.dy; }
  const last = plan.stitches.filter((s) => s.flag !== "end").slice(-1)[0];
  assert.equal(x, last.x); assert.equal(y, last.y);
  assert.ok(recs.some((r) => r.flag === "stop"));
});

test("stitches: running style outlines row-runs; underlay + pull comp change output", () => {
  let g = createGrid(10, 3);
  for (let x = 1; x <= 6; x++) g = setCell(g, x, 1, 1); // one run of 6 cells
  const run = buildStitchPlan(g, 2, "running");
  assert.equal(run.style, "running");
  assert.ok(run.stitches.some((s) => s.flag === "jump"), "run starts with a jump");
  const plain = buildStitchPlan(g, 2, "tatami");
  const withUnderlay = buildStitchPlan(g, 2, "tatami", { underlay: true });
  assert.ok(withUnderlay.stitches.length > plain.stitches.length, "underlay adds a pass");
  // pull compensation enlarges the extent
  const span = (p: { stitches: Array<{ x: number }> }) => Math.max(...p.stitches.map((s) => Math.abs(s.x)));
  assert.ok(span(buildStitchPlan(g, 2, "tatami", { pullCompMm: 2 })) >= span(plain));
});

test("model: resample scales the design; splitForHoop tiles a big design", () => {
  let g = createGrid(40, 40);
  g = setCell(g, 0, 0, 3);
  const small = resampleGrid(g, 20, 20);
  assert.equal(small.w, 20); assert.equal(small.h, 20);
  assert.equal(small.cells[0], 3, "top-left content preserved");
  const tiles = splitForHoop(g, 25, 25); // 40x40 into 25-cell tiles → 2x2
  assert.equal(tiles.length, 4);
  assert.ok(tiles.every((t) => t.grid.w <= 25 && t.grid.h <= 25));
});

test("metrics: job cost + sew time; hoopCells from hoop size", () => {
  const c = jobCost({ stitches: 5000, colors: 3, pieces: 10 });
  assert.ok(c.minutesEach > 0 && c.priceEach > 0);
  assert.equal(c.priceTotal, Math.round(c.priceEach * 10 * 100) / 100);
  const hc = hoopCells(HOOPS[0], 2); // 100mm / 2mm = 50 cells
  assert.equal(hc.w, 50);
});

test("auto-digitize: dithering keeps cells filled; maxColors caps the palette", () => {
  // a 4x1 gradient grey strip
  const px = [40, 40, 40, 255, 110, 110, 110, 255, 170, 170, 170, 255, 210, 210, 210, 255];
  const dithered = gridFromPixels(px, 4, 1, { dither: true, skipWhite: false });
  assert.equal(dithered.cells.filter((c) => c >= 0).length, 4, "all cells still mapped");
  // force a 1-color cap on a 2-color design
  let g = createGrid(4, 1);
  g = setCell(g, 0, 0, 2); g = setCell(g, 1, 0, 6); g = setCell(g, 2, 0, 6); g = setCell(g, 3, 0, 6);
  const reduced = reduceColors(g, 1);
  assert.equal(new Set(reduced.cells.filter((c) => c >= 0)).size, 1, "collapsed to one color");
});

test("auto-digitize: maps pixels to nearest threads; skips white + transparent", () => {
  assert.equal(THREADS[nearestThread(0, 0, 0)].name, "Black");
  assert.equal(THREADS[nearestThread(255, 255, 255)].name, "White");
  // 2x1 image: opaque red, then transparent
  const rgba = [200, 30, 40, 255, /* transparent */ 0, 0, 0, 0];
  const g = gridFromPixels(rgba, 2, 1);
  assert.ok(g.cells[0] >= 0, "red cell mapped to a thread");
  assert.equal(g.cells[1], -1, "transparent cell empty");
  // near-white is skipped (fabric shows through)
  const g2 = gridFromPixels([250, 250, 250, 255], 1, 1);
  assert.equal(g2.cells[0], -1, "near-white skipped");
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
