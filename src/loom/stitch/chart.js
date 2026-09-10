// ============================================================
// STITCH CHARTS — the grid a letter is worked on
// ============================================================
// A chart is what a cross-stitch pattern actually is: a small grid where
// each cell says what to work there. Charts here are arrays of strings,
// one character per cell, which is both how printed patterns look and
// something a person can read in a diff:
//
//   "."  nothing
//   "X"  a full cross stitch
//   "/"  half stitch, low-left to high-right
//   "\"  half stitch, high-left to low-right
//   "-"  backstitch along the cell's TOP edge
//   "|"  backstitch along the cell's LEFT edge
//
// Backstitch is an edge, not a cell fill: it is the outline worked around
// a shape after the crosses are done, which is how the isometric cube on
// the alphabet blanket is drawn (see public/img/abc-blanket/08.jpg).
//
// Plain JavaScript with JSDoc, for the reason in ../tier.js: CI runs the
// unit suite on Node 20, which cannot import TypeScript, and this is
// exactly the logic that must be tested rather than eyeballed.
// ============================================================

/** Capitals are worked 13 wide by 15 tall — the size the photos show inside a cube. */
export const CAPITAL_W = 13;
export const CAPITAL_H = 15;

// ── Lowercase ────────────────────────────────────────────────
// Lowercase Armenian cannot use the capital box. Capitals all occupy the
// same band, so centring each one in its own cube lines them up; every
// letter on the alphabet blanket is worked that way. Lowercase does not
// work like that. հ, լ and թ rise above the x-height; ղ, ք, փ, ց and ջ
// drop below the baseline; ա and ո sit entirely between. Centring each
// glyph in its own box would put every one of those in the middle of the
// band, and the word would read as a row of letters bobbing up and down
// instead of a word sitting on a line.
//
// So a lowercase chart is a TALLER box with a fixed baseline row, and
// every glyph is drawn against that shared baseline rather than centred.
// LOWER_BASELINE is the row the letters sit ON: rows above it hold the
// x-height and the ascenders, the rows below it hold the descenders.
// Because all lowercase charts share one height and one baseline row,
// the planner can go on centring the BOX vertically in a slot and the
// letters still line up — the alignment lives in the chart, not the
// layout.
//
// The box is deliberately generous on width and each glyph is trimmed
// back to its own ink (trimChartX), so ի does not occupy the same width
// as ղ. Generous matters: the size is chosen to fit the box VERTICALLY,
// so a wide letter can still overrun it sideways and be clipped. ա came
// out exactly 13 cells wide against a 13-cell box, which is what a
// clipped letter looks like from the outside.
export const LOWER_W = 20;
export const LOWER_H = 19;
export const LOWER_BASELINE = 13;

export const SYMBOLS = Object.freeze({
  EMPTY: ".",
  FULL: "X",
  HALF_UP: "/",
  HALF_DOWN: "\\",
  BACK_TOP: "-",
  BACK_LEFT: "|",
});

const LEGAL = new Set(Object.values(SYMBOLS));

/** @typedef {{ w: number, h: number, rows: string[] }} Chart */
/** @typedef {{ x: number, y: number, sym: string }} Cell */

/**
 * Validate and wrap raw chart rows.
 *
 * Throws rather than repairing: a ragged chart means a letter would be
 * stitched wrong on a real blanket, and silently padding it would hide
 * that until someone opened the box.
 *
 * @param {string[]} rows
 * @returns {Chart}
 */
export function parseChart(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("parseChart: chart has no rows");
  }
  const w = rows[0].length;
  if (w === 0) throw new Error("parseChart: chart rows are empty");
  rows.forEach((row, y) => {
    if (typeof row !== "string") throw new Error(`parseChart: row ${y} is not a string`);
    if (row.length !== w) {
      throw new Error(`parseChart: row ${y} is ${row.length} wide, expected ${w} (chart rows must be equal length)`);
    }
    for (let x = 0; x < row.length; x += 1) {
      if (!LEGAL.has(row[x])) {
        throw new Error(`parseChart: row ${y} column ${x} has "${row[x]}", which is not a chart symbol`);
      }
    }
  });
  return { w, h: rows.length, rows: rows.slice() };
}

/**
 * Every non-empty cell of a chart, in the order a person would work it:
 * across each row, top to bottom. The stitch-in animation replays this
 * order, so it reads like stitching rather than like pixels appearing.
 *
 * @param {Chart} chart
 * @returns {Cell[]}
 */
export function chartCells(chart) {
  const out = [];
  for (let y = 0; y < chart.h; y += 1) {
    const row = chart.rows[y];
    for (let x = 0; x < chart.w; x += 1) {
      const sym = row[x];
      if (sym !== SYMBOLS.EMPTY) out.push({ x, y, sym });
    }
  }
  return out;
}

/**
 * Build a chart by sampling a shape — used to turn a real font glyph into
 * a chart so the Armenian letterforms are the actual letterforms rather
 * than something invented cell by cell.
 *
 * `sample(x, y)` returns coverage 0..1 for the cell at that grid position.
 * The browser passes a canvas-backed sampler (see rasterize.ts); the test
 * passes a plain function, which is the whole point of the split.
 *
 * @param {(x: number, y: number) => number} sample
 * @param {object} [opts]
 * @param {number} [opts.w] grid width
 * @param {number} [opts.h] grid height
 * @param {number} [opts.threshold] coverage at or above which a cell is stitched
 * @returns {Chart}
 */
export function chartFromSampler(sample, opts = {}) {
  const w = opts.w ?? CAPITAL_W;
  const h = opts.h ?? CAPITAL_H;
  const threshold = opts.threshold ?? 0.5;
  const rows = [];
  for (let y = 0; y < h; y += 1) {
    let row = "";
    for (let x = 0; x < w; x += 1) {
      const coverage = sample(x, y);
      row += Number.isFinite(coverage) && coverage >= threshold ? SYMBOLS.FULL : SYMBOLS.EMPTY;
    }
    rows.push(row);
  }
  return parseChart(rows);
}

/**
 * Trim fully empty rows and columns, then re-centre in a w by h grid.
 *
 * A rasterised glyph lands wherever the font's metrics put it, which for
 * Armenian is not where Latin lands — the alphabet has descenders and
 * different optical centres. Every letter on the blanket sits centred in
 * its own cube, so this is what makes them line up.
 *
 * @param {Chart} chart
 * @param {object} [opts]
 * @param {number} [opts.w]
 * @param {number} [opts.h]
 * @returns {Chart}
 */
export function centerChart(chart, opts = {}) {
  const w = opts.w ?? chart.w;
  const h = opts.h ?? chart.h;
  const cells = chartCells(chart);
  if (cells.length === 0) {
    return parseChart(Array.from({ length: h }, () => SYMBOLS.EMPTY.repeat(w)));
  }
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  const glyphW = maxX - minX + 1;
  const glyphH = maxY - minY + 1;
  // A glyph wider or taller than the target is clipped from its far edge
  // rather than squashed: a squashed letter is a wrong letter.
  const offsetX = Math.floor((w - glyphW) / 2);
  const offsetY = Math.floor((h - glyphH) / 2);

  const grid = Array.from({ length: h }, () => Array.from({ length: w }, () => SYMBOLS.EMPTY));
  for (const c of cells) {
    const nx = c.x - minX + offsetX;
    const ny = c.y - minY + offsetY;
    if (nx >= 0 && nx < w && ny >= 0 && ny < h) grid[ny][nx] = c.sym;
  }
  return parseChart(grid.map((row) => row.join("")));
}

/**
 * Crop a chart to the columns that actually carry ink, leaving the rows
 * untouched.
 *
 * Vertical position is meaning in a lowercase chart — it is what puts the
 * letter on the baseline — so only the horizontal axis may be trimmed.
 * That is the whole difference between this and centerChart, and it is
 * why they are two functions rather than one with a flag.
 *
 * An empty chart trims to a single empty column rather than to nothing:
 * a zero-width chart would make the planner's spacing arithmetic divide
 * a slot into infinitely many characters.
 *
 * @param {Chart} chart
 * @param {object} [opts]
 * @param {number} [opts.pad] blank columns to keep on each side
 * @returns {Chart}
 */
export function trimChartX(chart, opts = {}) {
  const pad = Math.max(0, opts.pad ?? 0);
  const cells = chartCells(chart);
  if (cells.length === 0) {
    return parseChart(chart.rows.map(() => SYMBOLS.EMPTY));
  }
  let minX = Infinity;
  let maxX = -Infinity;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
  }
  const w = maxX - minX + 1 + pad * 2;
  const grid = Array.from({ length: chart.h }, () => Array.from({ length: w }, () => SYMBOLS.EMPTY));
  for (const c of cells) grid[c.y][c.x - minX + pad] = c.sym;
  return parseChart(grid.map((row) => row.join("")));
}

/**
 * The isometric box backstitched around every letter on the alphabet
 * blanket: a front face plus the top and right faces suggested by two
 * short offsets. Drawn in backstitch, so it is edges, not filled cells.
 *
 * Hand-authored because it is not a font glyph — it is Lusik's motif.
 * Reference: public/img/abc-blanket/08.jpg.
 */
export const CUBE_OUTLINE = parseChart([
  "...----------",
  "..|.........|",
  ".|.---------|",
  ".|.|........|",
  ".|.|........|",
  ".|.|........|",
  ".|.|........|",
  ".|.|........|",
  ".|.|........|",
  ".|.|........|",
  ".|.|........|",
  ".|.|........|",
  ".|.---------|",
  ".|..........|",
  ".------------",
]);

/** Small motifs the sets and bibs use. Hand-authored for the same reason. */
/**
 * The Armenian flag Lusik cross-stitches on the brim of the Hye Em Yes
 * cap. Reference: public/img/hye-em-bib/02.jpg.
 *
 * Four charts rather than one, because a chart cell says WHAT to work
 * there and not in which colour, and this motif is three colours plus a
 * pole. The caller stitches all four into the same origin; the bands
 * are cut so that, column by column, each one sits directly under the
 * last — the flag waves as a whole rather than as three loose ribbons.
 *
 * The pole runs the full height and past the bottom band, which is what
 * the photo shows: the flag is flying, not floating.
 */
export const ARMENIAN_FLAG = Object.freeze({
  pole: parseChart([
    "X............",
    "X............",
    "X............",
    "X............",
    "X............",
    "X............",
    "X............",
    "X............",
    "X............",
    "X............",
    "X............",
    "X............",
    "X............",
    "X............",
    "X............",
  ]),
  red: parseChart([
    ".XX.......XXX",
    ".XXXX...XXXXX",
    ".XXXXXXXXXXXX",
    "...XXXXXXX...",
    ".....XXX.....",
    ".............",
    ".............",
    ".............",
    ".............",
    ".............",
    ".............",
    ".............",
    ".............",
    ".............",
    ".............",
  ]),
  blue: parseChart([
    ".............",
    ".............",
    ".............",
    ".XX.......XXX",
    ".XXXX...XXXXX",
    ".XXXXXXXXXXXX",
    "...XXXXXXX...",
    ".....XXX.....",
    ".............",
    ".............",
    ".............",
    ".............",
    ".............",
    ".............",
    ".............",
  ]),
  orange: parseChart([
    ".............",
    ".............",
    ".............",
    ".............",
    ".............",
    ".............",
    ".XX.......XXX",
    ".XXXX...XXXXX",
    ".XXXXXXXXXXXX",
    "...XXXXXXX...",
    ".....XXX.....",
    ".............",
    ".............",
    ".............",
    ".............",
  ]),
});

/**
 * The strawberry Lusik works between the words of the Bari Akhorzhak
 * blessing. Reference: public/img/bari-akhorzhak-set/cover.jpg, where the
 * same berry appears on the bib and again on the burp cloth.
 *
 * Two charts, sharing an origin, for the same reason ARMENIAN_FLAG is
 * four: a chart cell says what to work there, not in which colour, and a
 * strawberry is a red body under a green crown. The product's own copy
 * says the motif varies by piece — a bottle, a strawberry, a grape, a
 * carrot — so this is one of Lusik's, not the only one.
 */
export const STRAWBERRY = Object.freeze({
  leaves: parseChart([
    ".....X.....",
    "..X..X..X..",
    ".XXXXXXXXX.",
    "..XXXXXXX..",
    "...........",
    "...........",
    "...........",
    "...........",
    "...........",
    "...........",
    "...........",
    "...........",
    "...........",
  ]),
  body: parseChart([
    "...........",
    "...........",
    "...........",
    "...........",
    "..XXXXXXX..",
    ".XXXXXXXXX.",
    "XXXXXXXXXXX",
    "XXXXXXXXXXX",
    ".XXXXXXXXX.",
    ".XXXXXXXXX.",
    "..XXXXXXX..",
    "...XXXXX...",
    "....XXX....",
  ]),
});

export const MOTIFS = Object.freeze({
  heart: parseChart([
    ".XX...XX.",
    "XXXX.XXXX",
    "XXXXXXXXX",
    "XXXXXXXXX",
    ".XXXXXXX.",
    "..XXXXX..",
    "...XXX...",
    "....X....",
    ".........",
  ]),
  // The pomegranate is the medallion embossed into the waffle weave and
  // the motif Lusik returns to; the journal has a whole post on it.
  pomegranate: parseChart([
    "....|....",
    "...XXX...",
    "..XXXXX..",
    ".XXXXXXX.",
    "XXXXXXXXX",
    "XXXXXXXXX",
    "XXXXXXXXX",
    ".XXXXXXX.",
    "..XXXXX..",
  ]),
  cross: parseChart([
    "...XXX...",
    "...XXX...",
    "XXXXXXXXX",
    "XXXXXXXXX",
    "XXXXXXXXX",
    "...XXX...",
    "...XXX...",
    "...XXX...",
    "...XXX...",
  ]),
});
