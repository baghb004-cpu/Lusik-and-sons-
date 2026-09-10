// ============================================================
// BLANKET LAYOUT — the placement both previews share
// ============================================================
// This decides where every letter, the name, the year and the woven
// motifs sit on a 7x7 blanket. It is shared by the 2D preview and the 3D
// Loom precisely so they cannot disagree; these tests pin the behaviour
// the two of them rely on.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GRID, YEAR_CELLS, NAME_CELLS, POMEGRANATE_CELLS,
  splitAcrossCells, buildLayoutCells,
} from "../../../../src/data/blanketLayout.js";

const LAYOUT = { preview: [4, 12, 20, 28, 36, 44] };
const LETTERS = ["Ա", "Բ", "Գ"];

test("the alphabet lands exactly on the layout's cells", () => {
  const cells = buildLayoutCells({ letters: LETTERS, layout: LAYOUT });
  for (const pos of LAYOUT.preview) {
    assert.equal(cells[pos]?.kind, "alphabet", `cell ${pos} should hold a letter`);
  }
});

test("a three-letter alphabet is stitched twice across six cells", () => {
  // The blanket carries the first three letters a child learns, worked
  // once on each diagonal.
  const cells = buildLayoutCells({ letters: LETTERS, layout: LAYOUT });
  const glyphs = LAYOUT.preview.map((p) => cells[p].glyph);
  assert.deepEqual(glyphs, ["Ա", "Բ", "Գ", "Ա", "Բ", "Գ"]);
});

test("personalisation can never displace a letter", () => {
  // If a name could overwrite an alphabet cube the customer would be
  // shipped a blanket missing a letter.
  const overlapping = { preview: [...LAYOUT.preview, NAME_CELLS[0], YEAR_CELLS[0]] };
  const cells = buildLayoutCells({
    letters: LETTERS, layout: overlapping, line1: "ANI", line2: "2026",
  });
  assert.equal(cells[NAME_CELLS[0]].kind, "alphabet");
  assert.equal(cells[YEAR_CELLS[0]].kind, "alphabet");
});

test("a motif never displaces a letter or the personalisation", () => {
  const cells = buildLayoutCells({
    letters: LETTERS, layout: LAYOUT, line1: "ANI", line2: "2026",
  });
  for (const pos of LAYOUT.preview) assert.equal(cells[pos].kind, "alphabet");
  const textCells = cells.filter((c) => c?.kind === "text");
  assert.ok(textCells.length >= 6, "the name and year should both be placed");
});

test("the name and year run down their own diagonals", () => {
  const cells = buildLayoutCells({
    letters: LETTERS, layout: LAYOUT, line1: "ANI", line2: "2026",
  });
  assert.deepEqual(YEAR_CELLS.map((p) => cells[p]?.glyph), ["2", "0", "2", "6"]);
  // "ANI" is three characters in four cells: one per cell, last blank.
  assert.deepEqual(NAME_CELLS.slice(0, 3).map((p) => cells[p]?.glyph), ["A", "N", "I"]);
  assert.notEqual(cells[NAME_CELLS[3]]?.kind, "text");
});

test("a long name is distributed rather than truncated", () => {
  const cells = buildLayoutCells({ letters: LETTERS, layout: LAYOUT, line1: "ALEXANDRA" });
  const stitched = NAME_CELLS.map((p) => cells[p]?.glyph ?? "").join("");
  assert.equal(stitched, "ALEXANDRA", "every character of the name must appear somewhere");
});

test("hints appear only when asked, and never as real thread", () => {
  const withHints = buildLayoutCells({ letters: LETTERS, layout: LAYOUT, showHints: true });
  const hint = withHints.find((c) => c?.placeholder);
  assert.ok(hint, "the form preview should show where text will go");
  const without = buildLayoutCells({ letters: LETTERS, layout: LAYOUT, showHints: false });
  assert.ok(!without.some((c) => c?.placeholder), "the 3D must not stitch the word 'name'");
});

test("splitAcrossCells fills one per cell, then distributes", () => {
  assert.deepEqual(splitAcrossCells("AB", 4), ["A", "B", "", ""]);
  assert.deepEqual(splitAcrossCells("", 3), ["", "", ""]);
  assert.equal(splitAcrossCells("ABCDEFGH", 4).join(""), "ABCDEFGH");
});

test("every cell index is inside the grid", () => {
  for (const list of [YEAR_CELLS, NAME_CELLS, POMEGRANATE_CELLS, LAYOUT.preview]) {
    for (const pos of list) {
      assert.ok(pos >= 0 && pos < GRID * GRID, `${pos} is off the blanket`);
    }
  }
});

test("the text diagonals do not collide with each other", () => {
  const overlap = YEAR_CELLS.filter((p) => NAME_CELLS.includes(p));
  assert.deepEqual(overlap, [], "the name and year would overwrite each other");
});

test("an empty design still returns a full grid", () => {
  const cells = buildLayoutCells({ letters: [], layout: { preview: [] } });
  assert.equal(cells.length, GRID * GRID);
  assert.ok(cells.some((c) => c?.kind === "pomegranate"));
});
