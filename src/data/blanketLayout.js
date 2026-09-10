// ============================================================
// BLANKET LAYOUT — which cell of the 7x7 grid holds what
// ============================================================
// The canonical answer to "where does each letter, the name, the year
// and the pomegranate motifs sit on the blanket". Pure, no React, no
// three, so both previews and the tests can use it.
//
// It exists because there are now TWO renderers: the 2D
// BlanketLayoutPreview and the 3D Loom. If each computed placement its
// own way they would eventually disagree, and a customer would see one
// arrangement while configuring and a different one on the stage beside
// it — or worse, be shipped a blanket matching neither. Sharing the
// function makes that impossible rather than merely tested for.
//
// Plain JavaScript with JSDoc, like the other pure modules here, so the
// Node 20 unit runner can import it.
// ============================================================

/** The blanket is a 7 by 7 grid of squares. */
export const GRID = 7;

/**
 * Year runs beside the upper alphabet diagonal, one column to the LEFT:
 * cells (0,3) (1,4) (2,5) (3,6). Four cells fit a four-digit year.
 */
export const YEAR_CELLS = [3, 11, 19, 27];

/**
 * Name runs beside the lower alphabet diagonal, one column to the RIGHT:
 * cells (3,0) (4,1) (5,2) (6,3).
 */
export const NAME_CELLS = [21, 29, 37, 45];

/**
 * Woven pomegranate motifs in the empty squares — a heritage motif that
 * is part of Lusik's design language. Curated by hand for balance:
 * denser through the middle where the eye goes, sparser at the corners.
 */
export const POMEGRANATE_CELLS = [
  0, 2, 6,
  8, 10,
  14, 16, 18,
  22, 24, 26,
  30, 32, 34,
  38, 40,
  42, 46, 48,
];

/**
 * Split a text string across n cells. Up to n characters go one per
 * cell; longer text is distributed as evenly as possible.
 *
 * @param {string} text
 * @param {number} n
 * @returns {string[]} length n, "" for blank cells
 */
export function splitAcrossCells(text, n) {
  if (!text) return Array(n).fill("");
  if (text.length <= n) return Array.from({ length: n }, (_, i) => text[i] ?? "");
  const perCell = Math.ceil(text.length / n);
  return Array.from({ length: n }, (_, i) => text.slice(i * perCell, (i + 1) * perCell));
}

/**
 * @typedef {object} LayoutCell
 * @property {"alphabet"|"text"|"pomegranate"} kind
 * @property {string} [glyph]
 * @property {number} [idx] position in the stitched sequence
 * @property {number} [letterIdx] index into the alphabet's letters
 * @property {boolean} [placeholder] a "where your text goes" hint, not real text
 */

/**
 * Assign every cell of the grid.
 *
 * Order matters and is deliberate: alphabet cubes are placed first and
 * own their cells, then the text diagonals fill only cells still empty,
 * then the motifs fill what is left. So personalisation can never
 * displace a letter, and a motif can never displace either.
 *
 * @param {object} input
 * @param {string[]} input.letters the alphabet, cycled if the layout wants more
 * @param {{ preview: number[] }} input.layout
 * @param {string} [input.line1] the name
 * @param {string} [input.line2] the year
 * @param {boolean} [input.showHints] show a single "name"/"year" placeholder
 * @returns {(LayoutCell|null)[]} length GRID*GRID
 */
export function buildLayoutCells({ letters, layout, line1, line2, showHints = false }) {
  const cells = Array(GRID * GRID).fill(null);
  const glyphs = letters ?? [];

  (layout?.preview ?? []).forEach((pos, i) => {
    if (pos < 0 || pos >= cells.length || glyphs.length === 0) return;
    cells[pos] = {
      kind: "alphabet",
      glyph: glyphs[i % glyphs.length],
      idx: i,
      letterIdx: i % glyphs.length,
    };
  });

  const placeText = (positions, text, placeholderLabel) => {
    const trimmed = (text ?? "").trim();
    if (trimmed.length > 0) {
      const pieces = splitAcrossCells(trimmed, positions.length);
      positions.forEach((pos, i) => {
        if (pieces[i] && cells[pos] === null) cells[pos] = { kind: "text", glyph: pieces[i] };
      });
    } else if (showHints) {
      // A single hint at the middle of the diagonal shows WHERE the text
      // will go without filling four cells with a fake sample.
      const hintPos = positions[Math.floor(positions.length / 2)];
      if (cells[hintPos] === null) {
        cells[hintPos] = { kind: "text", glyph: placeholderLabel, placeholder: true };
      }
    }
  };
  placeText(YEAR_CELLS, line2, "year");
  placeText(NAME_CELLS, line1, "name");

  for (const pos of POMEGRANATE_CELLS) {
    if (cells[pos] === null) cells[pos] = { kind: "pomegranate" };
  }

  return cells;
}
