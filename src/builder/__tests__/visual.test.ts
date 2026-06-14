import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createHistory,
  pushHistory,
  replaceHistory,
  undo,
  redo,
  canUndo,
  canRedo,
  HISTORY_CAP,
  moveBlockBy,
  setBlockLocks,
  findBlock,
  updateBlock,
  EngineError,
} from "../engine/index.ts";
import { makePage } from "./fixtures.ts";

// ── history ─────────────────────────────────────────────────
test("history: push/undo/redo round-trip", () => {
  let h = createHistory("a");
  h = pushHistory(h, "b");
  h = pushHistory(h, "c");
  assert.equal(h.present, "c");
  assert.equal(canUndo(h), true);

  h = undo(h);
  assert.equal(h.present, "b");
  h = undo(h);
  assert.equal(h.present, "a");
  assert.equal(canUndo(h), false);
  assert.equal(undo(h), h); // undo at the floor is a no-op

  h = redo(h);
  h = redo(h);
  assert.equal(h.present, "c");
  assert.equal(canRedo(h), false);
  assert.equal(redo(h), h);
});

test("history: a new push clears the redo branch", () => {
  let h = pushHistory(pushHistory(createHistory("a"), "b"), "c");
  h = undo(h); // back at b, c in future
  h = pushHistory(h, "d");
  assert.equal(canRedo(h), false);
  assert.deepEqual([h.past[h.past.length - 1], h.present], ["b", "d"]);
});

test("history: replace coalesces without creating a step", () => {
  let h = pushHistory(createHistory("a"), "b");
  h = replaceHistory(h, "b2");
  h = replaceHistory(h, "b3");
  assert.equal(h.present, "b3");
  h = undo(h);
  assert.equal(h.present, "a"); // the b-edits were one step
});

test("history: capped so long sessions can't grow unbounded", () => {
  let h = createHistory(0);
  for (let i = 1; i <= HISTORY_CAP + 20; i++) h = pushHistory(h, i);
  assert.equal(h.past.length, HISTORY_CAP);
  assert.equal(h.present, HISTORY_CAP + 20);
});

// ── moveBlockBy ─────────────────────────────────────────────
test("moveBlockBy nudges among siblings and no-ops at the edges", () => {
  const page = makePage(); // top level: [section, lockedCard]
  const down = moveBlockBy(page.sections, "b_sect00000001", 1);
  assert.deepEqual(down.map((b) => b.id), ["b_card00000001", "b_sect00000001"]);

  // already first → unchanged (same reference, no phantom undo step material)
  const up = moveBlockBy(page.sections, "b_sect00000001", -1);
  assert.equal(up, page.sections);

  // nested: image is index 1 inside the section
  const nested = moveBlockBy(page.sections, "b_img000000001", -1);
  const section = findBlock(nested, "b_sect00000001")!.block;
  assert.deepEqual(section.children!.map((b) => b.id), ["b_img000000001", "b_hero00000001"]);
});

test("moveBlockBy respects move locks via moveBlock", () => {
  const page = makePage();
  const locked = setBlockLocks(page.sections, "b_sect00000001", { move: true, reason: "test" });
  assert.throws(() => moveBlockBy(locked, "b_sect00000001", 1), EngineError);
});

// ── setBlockLocks ───────────────────────────────────────────
test("setBlockLocks can lock AND unlock — even when edit-locked", () => {
  const page = makePage();
  let s = setBlockLocks(page.sections, "b_hero00000001", { edit: true, delete: true });
  const locked = findBlock(s, "b_hero00000001")!.block;
  assert.deepEqual(locked.locks, { edit: true, delete: true });

  // updateBlock refuses (edit lock)…
  assert.throws(() => updateBlock(s, "b_hero00000001", (b) => b), EngineError);
  // …but lock management still works, otherwise it could never be undone
  s = setBlockLocks(s, "b_hero00000001", undefined);
  assert.equal(findBlock(s, "b_hero00000001")!.block.locks, undefined);
});
