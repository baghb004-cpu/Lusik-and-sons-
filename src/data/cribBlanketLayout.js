// ============================================================
// THE FULL ALPHABET CRIB BLANKET — what goes in which square
// ============================================================
// Six squares across, seven down, each outlined in the same thread as
// its contents. Read off two photographs of real blankets:
// public/img/full-alphabet/12.jpg (pink, straight on) and 55.jpg
// (lavender). Both put a cross in the two top corners and a heart in the
// bottom right; the alphabet fills everything between in reading order.
//
// The two blankets do NOT agree on the bottom-left square. The pink one
// has a small framed medallion there; the lavender one has a letter. That
// is not a contradiction to resolve — these are made by hand, one at a
// time, over years, and the product page says so ("the exact fabric,
// trim, closure style, colors, and details may vary"). The pink blanket
// is the clearer photograph and is what this follows, which also gives
// the "optional name set into a free square" of the product copy
// somewhere to go.
//
// The letters are NOT read off the photograph. Stitched Armenian
// capitals in this script are not something to transcribe by eye, and
// getting one wrong on a christening blanket is the kind of mistake that
// arrives in a box. They come from the Unicode block instead — Ա U+0531
// through Ֆ U+0556 is the modern alphabet in its own order, and it is the
// same range tests/e2e/loom-glyphs.spec.mjs already checks the rasteriser
// against.
//
// Plain JavaScript with JSDoc, so the Node unit suite can import the real
// module rather than a copy of it.
// ============================================================

export const CRIB_COLS = 6;
export const CRIB_ROWS = 7;

/**
 * The modern Armenian alphabet, Ա to Ֆ, in order. Thirty-eight letters.
 *
 * The product description says "every letter from Ա to Ք", which is the
 * thirty-six of the classical alphabet; Օ and Ֆ were added later. The
 * photographs appear to include them, and thirty-eight letters is exactly
 * what fills this grid once the four corner squares are spoken for. Worth
 * Lusik confirming which she works.
 */
export const ARMENIAN_ALPHABET = Object.freeze(
  Array.from({ length: 38 }, (_, i) => String.fromCodePoint(0x0531 + i)),
);

/** @typedef {{ kind: "letter", glyph: string } | { kind: "motif", motif: string } | { kind: "name" }} CribCell */

/**
 * The forty-two squares, in reading order.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.hasName] whether the customer gave a name for the free square
 * @returns {CribCell[]}
 */
export function cribCells(opts = {}) {
  const cells = [];
  const letters = [...ARMENIAN_ALPHABET];

  const total = CRIB_COLS * CRIB_ROWS;
  const lastRowStart = total - CRIB_COLS;

  for (let i = 0; i < total; i += 1) {
    if (i === 0 || i === CRIB_COLS - 1) {
      // A cross in each top corner.
      cells.push({ kind: "motif", motif: "cross" });
    } else if (i === total - 1) {
      // A heart to finish.
      cells.push({ kind: "motif", motif: "heart" });
    } else if (i === lastRowStart) {
      // The free square: a framed medallion, or the baby's name when one
      // is given.
      cells.push(opts.hasName ? { kind: "name" } : { kind: "motif", motif: "pomegranate" });
    } else {
      const glyph = letters.shift();
      // Runs out only if the grid grows or the alphabet shrinks; an empty
      // square is better than a repeated letter.
      cells.push(glyph ? { kind: "letter", glyph } : { kind: "motif", motif: "empty" });
    }
  }
  return cells;
}

/**
 * Every letter the grid holds, for a text alternative.
 *
 * @returns {string}
 */
export function cribAlphabetText() {
  return ARMENIAN_ALPHABET.join(" ");
}
