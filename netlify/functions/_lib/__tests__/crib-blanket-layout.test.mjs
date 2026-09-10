// ============================================================
// THE FULL ALPHABET GRID
// ============================================================
// Forty-two squares, thirty-eight letters, four corners. The failure
// this guards is a letter appearing twice or not at all on a blanket
// whose entire point is that it carries the whole alphabet.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ARMENIAN_ALPHABET, CRIB_COLS, CRIB_ROWS, cribAlphabetText, cribCells,
} from "../../../../src/data/cribBlanketLayout.js";

test("the grid is six across and seven down, as photographed", () => {
  assert.equal(CRIB_COLS, 6);
  assert.equal(CRIB_ROWS, 7);
  assert.equal(cribCells().length, 42);
});

test("the alphabet is thirty-eight letters, in Unicode order, all distinct", () => {
  assert.equal(ARMENIAN_ALPHABET.length, 38);
  assert.equal(new Set(ARMENIAN_ALPHABET).size, 38);
  assert.equal(ARMENIAN_ALPHABET[0], "Ա");
  assert.equal(ARMENIAN_ALPHABET.at(-1), "Ֆ");
  for (let i = 0; i < ARMENIAN_ALPHABET.length; i += 1) {
    assert.equal(ARMENIAN_ALPHABET[i].codePointAt(0), 0x0531 + i);
  }
});

test("every letter appears exactly once in the grid", () => {
  const glyphs = cribCells().filter((c) => c.kind === "letter").map((c) => c.glyph);
  assert.equal(glyphs.length, 38, `the grid holds ${glyphs.length} letters, not 38`);
  assert.deepEqual(glyphs, [...ARMENIAN_ALPHABET], "the alphabet is out of order or repeats");
});

test("the corners carry the motifs the photographs show", () => {
  const cells = cribCells();
  assert.deepEqual(cells[0], { kind: "motif", motif: "cross" });
  assert.deepEqual(cells[CRIB_COLS - 1], { kind: "motif", motif: "cross" });
  assert.deepEqual(cells.at(-1), { kind: "motif", motif: "heart" });
  assert.deepEqual(cells[42 - CRIB_COLS], { kind: "motif", motif: "pomegranate" });
});

test("a name takes the free square, and takes nothing else", () => {
  const plain = cribCells();
  const named = cribCells({ hasName: true });
  assert.equal(named.length, plain.length);

  const nameCells = named.filter((c) => c.kind === "name");
  assert.equal(nameCells.length, 1, "a name must occupy exactly one square");
  assert.equal(named[42 - CRIB_COLS].kind, "name", "the name did not go in the free square");

  // And not at the cost of a letter: the alphabet is the product.
  const glyphs = named.filter((c) => c.kind === "letter").map((c) => c.glyph);
  assert.deepEqual(glyphs, [...ARMENIAN_ALPHABET],
    "adding a name displaced a letter from the alphabet");
});

test("no square is left undefined", () => {
  for (const cells of [cribCells(), cribCells({ hasName: true })]) {
    for (const [i, cell] of cells.entries()) {
      assert.ok(cell && typeof cell.kind === "string", `square ${i} is empty`);
    }
  }
});

test("the text alternative names every letter", () => {
  const text = cribAlphabetText();
  for (const letter of ARMENIAN_ALPHABET) {
    assert.ok(text.includes(letter), `${letter} is missing from the description`);
  }
});
