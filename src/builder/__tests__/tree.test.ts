import { test } from "node:test";
import assert from "node:assert/strict";

import {
  findBlock,
  collectIds,
  insertBlock,
  removeBlock,
  moveBlock,
  duplicateBlock,
  updateBlock,
  EngineError,
} from "../engine/index.ts";
import { newId, type Block } from "../schema/index.ts";
import { makePage } from "./fixtures.ts";

const spacer = (): Block => ({ id: newId(), type: "spacer", props: { size: "spacing.md" } });

test("findBlock locates nested blocks with parent + index", () => {
  const page = makePage();
  const loc = findBlock(page.sections, "b_img000000001");
  assert.ok(loc);
  assert.equal(loc.parent?.id, "b_sect00000001");
  assert.equal(loc.index, 1);
});

test("insertBlock inserts at index inside a container", () => {
  const page = makePage();
  const s = spacer();
  const next = insertBlock(page.sections, s, { parentId: "b_sect00000001", index: 1 });
  const section = findBlock(next, "b_sect00000001")!.block;
  assert.deepEqual(
    section.children!.map((b) => b.id),
    ["b_hero00000001", s.id, "b_img000000001"]
  );
  // immutability: the original page is untouched
  assert.equal(findBlock(page.sections, s.id), null);
});

test("insertBlock refuses non-container parents and duplicate ids", () => {
  const page = makePage();
  assert.throws(
    () => insertBlock(page.sections, spacer(), { parentId: "b_img000000001", index: 0 }),
    (e: unknown) => e instanceof EngineError && e.code === "not_container"
  );
  const dupe = { ...spacer(), id: "b_hero00000001" };
  assert.throws(
    () => insertBlock(page.sections, dupe, { parentId: null, index: 0 }),
    (e: unknown) => e instanceof EngineError && e.code === "duplicate_id"
  );
});

test("removeBlock respects delete locks, force overrides", () => {
  const page = makePage();
  assert.throws(
    () => removeBlock(page.sections, "b_card00000001"),
    (e: unknown) => e instanceof EngineError && e.code === "locked" && /footer legal link/.test(e.message)
  );
  const { blocks, removed } = removeBlock(page.sections, "b_card00000001", { force: true });
  assert.equal(removed.id, "b_card00000001");
  assert.equal(findBlock(blocks, "b_card00000001"), null);
});

test("moveBlock relocates and refuses cycles", () => {
  const page = makePage();
  // move the image out of the section to the top level
  const next = moveBlock(page.sections, "b_img000000001", { parentId: null, index: 0 });
  assert.equal(next[0].id, "b_img000000001");
  assert.equal(findBlock(next, "b_sect00000001")!.block.children!.length, 1);
  // a section cannot be moved into its own child
  assert.throws(
    () => moveBlock(page.sections, "b_sect00000001", { parentId: "b_sect00000001", index: 0 }),
    (e: unknown) => e instanceof EngineError && e.code === "cycle"
  );
});

test("duplicateBlock deep-clones with fresh ids, inserted after the original", () => {
  const page = makePage();
  const { blocks, copy } = duplicateBlock(page.sections, "b_sect00000001");
  assert.equal(blocks[1].id, copy.id);
  assert.notEqual(copy.id, "b_sect00000001");
  // every descendant got a fresh id; no collisions anywhere
  const ids = collectIds(blocks);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(copy.children!.length, 2);
});

test("updateBlock applies the updater and respects edit locks", () => {
  const page = makePage();
  const next = updateBlock(page.sections, "b_sect00000001", (b) => ({
    ...b,
    props: { ...b.props, heading: "Updated" },
  }));
  assert.equal(findBlock(next, "b_sect00000001")!.block.props.heading, "Updated");

  const withEditLock = updateBlock(page.sections, "b_hero00000001", (b) => ({
    ...b,
    locks: { edit: true },
  }));
  assert.throws(
    () => updateBlock(withEditLock, "b_hero00000001", (b) => b),
    (e: unknown) => e instanceof EngineError && e.code === "locked"
  );
});
