import { test } from "node:test";
import assert from "node:assert/strict";

import {
  setOverridePatch,
  clearOverridePatch,
  addMobileOnlyBlock,
  removeMobileOnlyBlock,
  emptyLayer,
  overridePath,
  resolveBlocks,
  findSmallTargets,
  findOverlaps,
  auditTapTargets,
  type TargetRect,
} from "../engine/index.ts";
import { overrideLayerSchema, newId } from "../schema/index.ts";
import { textDoc } from "../schema/richtext.ts";
import { makePage } from "./fixtures.ts";

// ── override editing helpers ────────────────────────────────
test("setOverridePatch merges style edits; clearing every field removes the patch", () => {
  let layer = emptyLayer("b_page00000001", "mobile");
  layer = setOverridePatch(layer, "b_hero00000001", { style: { textAlign: "center" } });
  layer = setOverridePatch(layer, "b_hero00000001", { style: { maxWidth: "20rem" } });
  assert.deepEqual(layer.patches.b_hero00000001.style, { textAlign: "center", maxWidth: "20rem" });
  assert.equal(overrideLayerSchema.safeParse(layer).success, true);

  // resetting both fields to undefined dissolves the patch entirely
  layer = setOverridePatch(layer, "b_hero00000001", { style: { textAlign: undefined, maxWidth: undefined } });
  assert.equal("b_hero00000001" in layer.patches, false);
});

test("clearOverridePatch = reset to desktop; untouched layers return by reference", () => {
  let layer = emptyLayer("b_page00000001", "mobile");
  layer = setOverridePatch(layer, "b_hero00000001", { visibility: false });
  const cleared = clearOverridePatch(layer, "b_hero00000001");
  assert.deepEqual(cleared.patches, {});
  assert.equal(clearOverridePatch(cleared, "b_hero00000001"), cleared);
});

test("mobile-only blocks add/remove and render only on mobile", () => {
  const page = makePage();
  const extra = { id: newId(), type: "richText", props: { doc: textDoc("mobile note") } };
  let layer = emptyLayer(page.id, "mobile");
  layer = addMobileOnlyBlock(layer, "b_sect00000001", "after", extra);
  assert.equal(overrideLayerSchema.safeParse(layer).success, true);

  const mobile = resolveBlocks(page.sections, [layer], "mobile");
  assert.ok(mobile.blocks.some((b) => b.id === extra.id));
  const desktop = resolveBlocks(page.sections, [layer], "desktop");
  assert.ok(!desktop.blocks.some((b) => b.id === extra.id));

  layer = removeMobileOnlyBlock(layer, extra.id);
  assert.equal(layer.mobileOnlyBlocks.length, 0);
});

test("overridePath derives per-page, per-breakpoint document paths", () => {
  assert.equal(overridePath("gift-guide", "mobile"), "builder/overrides/gift-guide.mobile.json");
  assert.equal(overridePath("gift-guide", "tablet"), "builder/overrides/gift-guide.tablet.json");
});

// ── tap-target math ─────────────────────────────────────────
const rect = (id: string, x: number, y: number, w: number, h: number): TargetRect => ({
  id,
  label: id,
  x,
  y,
  width: w,
  height: h,
});

test("findSmallTargets flags under-44px targets and ignores zero-size (hidden) ones", () => {
  const issues = findSmallTargets([
    rect("ok", 0, 0, 44, 44),
    rect("thin", 0, 100, 200, 24), // tall enough? no — 24px high
    rect("tiny", 0, 200, 20, 20),
    rect("hidden", 0, 300, 0, 0),
  ]);
  assert.deepEqual(issues.map((i) => i.ids[0]).sort(), ["thin", "tiny"]);
  assert.match(issues[0].message, /44px tap floor/);
});

test("findOverlaps flags intersections but NOT containment (label wrapping its input)", () => {
  const issues = findOverlaps([
    rect("a", 0, 0, 50, 50),
    rect("b", 40, 40, 50, 50), // overlaps a
    rect("outer", 200, 0, 100, 60),
    rect("inner", 210, 10, 40, 40), // contained in outer — one target, not a collision
    rect("far", 500, 500, 50, 50),
  ]);
  assert.equal(issues.length, 1);
  assert.deepEqual(issues[0].ids.sort(), ["a", "b"]);
});

test("auditTapTargets combines both checks", () => {
  const issues = auditTapTargets([rect("tiny", 0, 0, 10, 10), rect("x", 5, 5, 60, 60)]);
  const kinds = issues.map((i) => i.kind).sort();
  assert.deepEqual(kinds, ["overlap", "too_small"]);
});
