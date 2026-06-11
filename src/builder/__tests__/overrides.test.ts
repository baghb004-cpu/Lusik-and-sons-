import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveBlocks, listStaleOverrides, pruneStaleOverrides, findBlock } from "../engine/index.ts";
import { newId, type Block, type OverrideLayer } from "../schema/index.ts";
import { makePage, makeMobileLayer } from "./fixtures.ts";
import { CURRENT_SCHEMA_VERSION } from "../schema/migrate.ts";

test("desktop reads NO override layers — the core safety guarantee", () => {
  const page = makePage();
  const result = resolveBlocks(page.sections, [makeMobileLayer()], "desktop");
  assert.equal(result.appliedPatches, 0);
  assert.deepEqual(result.blocks, page.sections);
});

test("mobile patches apply on mobile without mutating the base", () => {
  const page = makePage();
  const before = structuredClone(page.sections);
  const result = resolveBlocks(page.sections, [makeMobileLayer()], "mobile");
  assert.equal(result.appliedPatches, 1);
  const hero = findBlock(result.blocks, "b_hero00000001")!.block;
  assert.equal(hero.style?.textAlign, "center");
  assert.deepEqual(page.sections, before); // base untouched
});

test("cascade order: tablet applies under mobile, mobile wins on conflicts", () => {
  const page = makePage();
  const tablet: OverrideLayer = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    pageId: page.id,
    breakpoint: "tablet",
    patches: {
      b_hero00000001: { style: { textAlign: "left", maxWidth: "spacing.lg" } },
    },
    mobileOnlyBlocks: [],
  };
  const mobile = makeMobileLayer(); // sets textAlign: center

  const onTablet = resolveBlocks(page.sections, [tablet, mobile], "tablet");
  assert.equal(findBlock(onTablet.blocks, "b_hero00000001")!.block.style?.textAlign, "left");

  const onMobile = resolveBlocks(page.sections, [tablet, mobile], "mobile");
  const hero = findBlock(onMobile.blocks, "b_hero00000001")!.block;
  assert.equal(hero.style?.textAlign, "center"); // mobile wins
  assert.equal(hero.style?.maxWidth, "spacing.lg"); // tablet survives where unconflicted
});

test("visibility patch flips the device flag only", () => {
  const page = makePage();
  const layer = makeMobileLayer({
    patches: { b_img000000001: { visibility: false } },
  });
  const result = resolveBlocks(page.sections, [layer], "mobile");
  const img = findBlock(result.blocks, "b_img000000001")!.block;
  assert.equal(img.visibility?.mobile, false);
  assert.notEqual(img.visibility?.desktop, false);
});

test("mobile-only blocks insert at their anchor; missing anchors are stale, not guessed", () => {
  const page = makePage();
  const extra: Block = { id: newId(), type: "spacer", props: { size: "spacing.md" } };
  const layer = makeMobileLayer({
    patches: {},
    mobileOnlyBlocks: [
      { anchorBlockId: "b_card00000001", position: "before", block: extra },
      { anchorBlockId: "b_gone00000001", position: "after", block: { ...extra, id: newId() } },
    ],
  });
  const result = resolveBlocks(page.sections, [layer], "mobile");
  // inserted before the card at top level
  const ids = result.blocks.map((b) => b.id);
  assert.deepEqual(ids, ["b_sect00000001", extra.id, "b_card00000001"]);
  // the dead anchor was reported, not silently dropped or mis-inserted
  assert.equal(result.stale.length, 1);
  assert.equal(result.stale[0].kind, "mobileOnlyAnchor");
  // and desktop still never sees the mobile-only block
  const desktop = resolveBlocks(page.sections, [layer], "desktop");
  assert.equal(findBlock(desktop.blocks, extra.id), null);
});

test("stale patches are reported and prunable", () => {
  const page = makePage();
  const layer = makeMobileLayer({
    patches: {
      b_hero00000001: { visibility: false },
      b_dead00000001: { visibility: false },
    },
  });
  const stale = listStaleOverrides(page.sections, layer);
  assert.deepEqual(stale.map((s) => s.blockId), ["b_dead00000001"]);

  const pruned = pruneStaleOverrides(page.sections, layer);
  assert.deepEqual(Object.keys(pruned.patches), ["b_hero00000001"]);
  // pruning an already-clean layer returns it unchanged (referential)
  assert.equal(pruneStaleOverrides(page.sections, pruned), pruned);
});
