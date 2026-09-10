// ============================================================
// ARRANGING A SET INTO THE FRAME THE CAMERA GIVES IT
// ============================================================
// The stage's camera pose is fixed: it frames one bib. A set of seven has
// to lay itself out and shrink to fit that same box. Getting it wrong
// does not throw — it puts half the set outside the picture, which is
// exactly what the Hye Em Yes cap did before it learned to fit itself,
// and what nobody notices until they look at a render.
//
// Pure arithmetic, so it can be checked here rather than by screenshot.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { fitScale, gridPlacements, rowPlacements, rowsOf } from "../../../../src/loom/rigs/arrange.js";

test("seven pieces at three per row are three, three and one", () => {
  // How the set is photographed (public/img/days-bib/02.jpg).
  assert.deepEqual(rowsOf(7, 3), [3, 3, 1]);
});

test("rowsOf handles the exact and the empty cases", () => {
  assert.deepEqual(rowsOf(6, 3), [3, 3]);
  assert.deepEqual(rowsOf(2, 2), [2]);
  assert.deepEqual(rowsOf(1, 3), [1]);
  assert.deepEqual(rowsOf(0, 3), []);
  // A nonsense per-row must not loop forever.
  assert.deepEqual(rowsOf(3, 0), [1, 1, 1]);
});

test("a short last row is centred under the rows above it", () => {
  const { placements } = gridPlacements({ count: 7, perRow: 3, itemW: 2, itemD: 2 });
  const lastRow = placements.filter((p) => p.row === 2);
  assert.equal(lastRow.length, 1);
  assert.equal(lastRow[0].x, 0, "the seventh bib hangs off one side instead of sitting in the middle");
});

test("the arrangement is centred on the origin in both axes", () => {
  const { placements, width, depth } = gridPlacements({
    count: 6, perRow: 3, itemW: 2, itemD: 3, gapX: 0.5, gapZ: 0.25,
  });
  const xs = placements.map((p) => p.x);
  const zs = placements.map((p) => p.z);
  assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2) < 1e-9, "not centred across");
  assert.ok(Math.abs((Math.min(...zs) + Math.max(...zs)) / 2) < 1e-9, "not centred front to back");
  assert.equal(width, 3 * 2 + 2 * 0.5);
  assert.equal(depth, 2 * 3 + 1 * 0.25);
});

test("every piece lands inside the extent the layout reports", () => {
  // The extent is what the fit scale is computed from, so a piece outside
  // it is a piece outside the frame.
  const itemW = 2;
  const itemD = 3;
  const layout = gridPlacements({ count: 7, perRow: 3, itemW, itemD, gapX: 0.4, gapZ: 0.3 });
  for (const p of layout.placements) {
    assert.ok(p.x - itemW / 2 >= -layout.width / 2 - 1e-9, `piece at ${p.x} runs off the left`);
    assert.ok(p.x + itemW / 2 <= layout.width / 2 + 1e-9, `piece at ${p.x} runs off the right`);
    assert.ok(p.z - itemD / 2 >= -layout.depth / 2 - 1e-9, `piece at ${p.z} runs off the back`);
    assert.ok(p.z + itemD / 2 <= layout.depth / 2 + 1e-9, `piece at ${p.z} runs off the front`);
  }
});

test("a single row is centred and reports its own width", () => {
  const { placements, width } = rowPlacements({ count: 2, itemW: 2, gapX: 0.5 });
  assert.equal(width, 4.5);
  assert.deepEqual(placements.map((p) => p.x), [-1.25, 1.25]);
  assert.deepEqual(rowPlacements({ count: 0, itemW: 2 }).placements, []);
});

test("the fit scale takes the tighter axis, never the looser", () => {
  // A set that fits by width but not by depth is a set with its front row
  // cut off. Averaging or taking the max would ship exactly that.
  const target = { width: 2, depth: 2 };
  assert.equal(fitScale({ width: 4, depth: 2 }, target), 0.5);
  assert.equal(fitScale({ width: 2, depth: 8 }, target), 0.25);
  assert.equal(fitScale({ width: 4, depth: 8 }, target), 0.25);
});

test("a set that already fits is not blown up to fill the frame", () => {
  // Not strictly wrong, but a two-bib pair scaled up to the width of one
  // bib's frame would be bigger than the single bib beside it in the shop.
  const scale = fitScale({ width: 1, depth: 1 }, { width: 2, depth: 2 });
  assert.equal(scale, 2, "documented behaviour: callers pass a frame the set should fill");
});

test("a degenerate extent scales by one rather than dividing by zero", () => {
  assert.equal(fitScale({ width: 0, depth: 0 }, { width: 2, depth: 2 }), 1);
  assert.equal(fitScale({ width: 2, depth: 0 }, { width: 2, depth: 2 }), 1);
});

test("the seven-bib set actually fits the frame it is given", () => {
  // The real numbers: a bib is 1.72 across and about 1.55 deep, and the
  // camera frames one of them.
  const itemW = 1.72;
  const itemD = 1.55;
  const frame = { width: itemW, depth: itemD };
  const layout = gridPlacements({
    count: 7, perRow: 3, itemW, itemD, gapX: itemW * 0.1, gapZ: itemD * 0.08,
  });
  const scale = fitScale(layout, frame);
  assert.ok(scale > 0 && scale < 1, `scale ${scale} does not shrink the set`);
  assert.ok(layout.width * scale <= frame.width + 1e-9);
  assert.ok(layout.depth * scale <= frame.depth + 1e-9);
});
