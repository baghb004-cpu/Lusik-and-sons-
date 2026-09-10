// ============================================================
// LOWERCASE CHARTS, PROPORTIONAL LAYOUT, AND THE FLAG
// ============================================================
// The pure half of the Hye Em Yes bib. What the rasteriser does with a
// real font is a browser question and is covered in
// tests/e2e/loom-glyphs.spec.mjs; what is testable in Node is the box
// the letters are drawn into, the trim that gives each one its own
// width, the layout that spaces them, and the motif on the cap.
//
// These import the REAL modules. The whole reason chart.js, planner.js
// and hyeEmYes.js are plain JavaScript is that a test comparing against
// a transcription passes while the shipped code is wrong — which has
// already happened twice in this repo.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  ARMENIAN_FLAG, LOWER_BASELINE, LOWER_H, LOWER_W,
  chartCells, parseChart, trimChartX,
} from "../../../../src/loom/stitch/chart.js";
import { layoutText, measureLine } from "../../../../src/loom/stitch/planner.js";
import {
  ARMENIAN_FLAG_COLORS, HYE_EM_YES_TEXT, HYE_EM_YES_WORDS,
} from "../../../../src/data/hyeEmYes.js";

const here = dirname(fileURLToPath(import.meta.url));
const readJson = (p) => JSON.parse(readFileSync(resolve(here, "../../../../", p), "utf8"));

// ── The lowercase box ───────────────────────────────────────

test("the lowercase box leaves room above the baseline and below it", () => {
  assert.ok(LOWER_BASELINE > 0, "no room for an ascender");
  assert.ok(LOWER_H > LOWER_BASELINE, "no room for a descender");
  // A descender band of one cell would be a chart that cannot tell ա from
  // ղ, which is the whole reason this box exists.
  assert.ok(LOWER_H - LOWER_BASELINE >= 3,
    `only ${LOWER_H - LOWER_BASELINE} cells below the baseline`);
  assert.ok(LOWER_W > 0);
});

test("the lowercase box is taller than the capital box", async () => {
  const { CAPITAL_H } = await import("../../../../src/loom/stitch/chart.js");
  // Capitals occupy one band; lowercase spans ascender to descender. A box
  // that did not grow would be clipping one end or the other.
  assert.ok(LOWER_H > CAPITAL_H, `lowercase box ${LOWER_H} is not taller than ${CAPITAL_H}`);
});

// ── trimChartX ──────────────────────────────────────────────

test("trimChartX crops empty columns and leaves the rows alone", () => {
  const chart = parseChart([
    ".....",
    "..X..",
    "..X..",
    ".....",
  ]);
  const trimmed = trimChartX(chart);
  assert.equal(trimmed.w, 1);
  assert.equal(trimmed.h, 4, "trimming must not move a letter off its baseline");
  assert.deepEqual(trimmed.rows, [".", "X", "X", "."]);
});

test("trimChartX keeps the vertical position of the ink exactly", () => {
  // A descender: ink only in the bottom rows. If trimming touched rows,
  // the letter would rise onto the baseline and the word would bob.
  const chart = parseChart([
    "....",
    "....",
    ".XX.",
    ".XX.",
  ]);
  const trimmed = trimChartX(chart);
  const ys = chartCells(trimmed).map((c) => c.y);
  assert.deepEqual([...new Set(ys)].sort(), [2, 3]);
});

test("trimChartX pads when asked, symmetrically", () => {
  const trimmed = trimChartX(parseChart(["..X..", "..X.."]), { pad: 2 });
  assert.equal(trimmed.w, 5);
  assert.deepEqual(trimmed.rows, ["..X..", "..X.."]);
});

test("trimChartX of an empty chart is one empty column, not zero", () => {
  // A zero-width chart makes the planner's "how many fit" arithmetic
  // divide a slot into infinitely many characters.
  const trimmed = trimChartX(parseChart(["...", "..."]));
  assert.equal(trimmed.w, 1);
  assert.equal(trimmed.h, 2);
  assert.equal(chartCells(trimmed).length, 0);
});

// ── proportional layout ─────────────────────────────────────

test("uniform layout is unchanged when no widths are given", () => {
  const out = layoutText({ text: "ԱԲԳ", slotW: 41, charW: 13, gap: 1 });
  assert.equal(out.placements.length, 3);
  assert.deepEqual(out.placements.map((p) => p.originX), [0, 14, 28]);
  assert.equal(out.dropped, 0);
  assert.equal(out.usedW, 41);
});

test("proportional layout advances by each character's own width", () => {
  const out = layoutText({ text: "abc", slotW: 40, widths: [3, 8, 5], gap: 1 });
  assert.deepEqual(out.placements.map((p) => p.originX).map((x) => x - out.placements[0].originX),
    [0, 4, 13]);
  assert.equal(out.usedW, 3 + 8 + 5 + 2);
});

test("proportional layout truncates on the real running width", () => {
  // Three narrow letters fit where three wide ones would not: the answer
  // has to depend on which letters came before, not on a count.
  // Three narrow letters need 3+1+3+1+3 = 11 cells; three wide ones need 29.
  const narrow = layoutText({ text: "iii", slotW: 11, widths: [3, 3, 3], gap: 1 });
  assert.equal(narrow.placements.length, 3);
  assert.equal(narrow.dropped, 0);

  const wide = layoutText({ text: "mmm", slotW: 11, widths: [9, 9, 9], gap: 1 });
  assert.equal(wide.placements.length, 1);
  assert.equal(wide.dropped, 2);
});

test("proportional layout centres the run it kept", () => {
  const out = layoutText({ text: "ab", slotW: 20, widths: [4, 4], gap: 1, align: "center" });
  assert.equal(out.usedW, 9);
  // Centre of the run sits on the centre of the slot, to within the
  // half-cell that integer cells allow.
  const centre = out.placements[0].originX + out.usedW / 2;
  assert.ok(Math.abs(centre - 10) <= 0.5, `run centred at ${centre}, not 10`);
});

test("left alignment starts at the slot edge in both modes", () => {
  assert.equal(layoutText({ text: "ab", slotW: 20, widths: [4, 4], align: "left" }).placements[0].originX, 0);
  assert.equal(layoutText({ text: "ab", slotW: 20, charW: 4, align: "left" }).placements[0].originX, 0);
});

test("a zero-width slot places nothing rather than throwing", () => {
  assert.deepEqual(layoutText({ text: "ab", slotW: 0, widths: [4, 4] }).placements, []);
  assert.deepEqual(layoutText({ text: "ab", slotW: 10, charW: 0 }).placements, []);
});

// ── measureLine ─────────────────────────────────────────────

test("measureLine sums the charts the planner would actually use", () => {
  const chartFor = (ch) => ({ a: parseChart(["XX"]), b: parseChart(["XXXX"]) }[ch] ?? null);
  assert.equal(measureLine({ text: "ab", chartFor, gap: 1 }), 2 + 4 + 1);
});

test("measureLine ignores characters the font cannot draw", () => {
  // Counting a missing glyph's width would leave a hole in the middle of
  // a word, and would push the last letter out of the slot.
  const chartFor = (ch) => (ch === "a" ? parseChart(["XX"]) : null);
  assert.equal(measureLine({ text: "a?a", chartFor, gap: 1 }), 2 + 2 + 1);
  assert.equal(measureLine({ text: "???", chartFor, gap: 1 }), 0);
  assert.equal(measureLine({ text: "", chartFor }), 0);
});

// ── the flag on the cap ─────────────────────────────────────

test("the flag's four charts are the same size", () => {
  const parts = Object.values(ARMENIAN_FLAG);
  for (const chart of parts) {
    assert.equal(chart.w, parts[0].w);
    assert.equal(chart.h, parts[0].h);
  }
});

test("every column of the flag carries all three bands, stacked in order", () => {
  const { red, blue, orange } = ARMENIAN_FLAG;
  const byColumn = (chart) => {
    const cols = new Map();
    for (const c of chartCells(chart)) {
      if (!cols.has(c.x)) cols.set(c.x, []);
      cols.get(c.x).push(c.y);
    }
    return cols;
  };
  const r = byColumn(red);
  const b = byColumn(blue);
  const o = byColumn(orange);
  assert.ok(r.size > 0, "the red band is empty");
  assert.deepEqual([...b.keys()].sort(), [...r.keys()].sort(), "blue covers different columns than red");
  assert.deepEqual([...o.keys()].sort(), [...r.keys()].sort(), "orange covers different columns than red");

  for (const x of r.keys()) {
    const rows = { red: r.get(x).sort((a, z) => a - z), blue: b.get(x).sort((a, z) => a - z), orange: o.get(x).sort((a, z) => a - z) };
    // Three cells of each colour in every column, and red directly above
    // blue directly above orange with no gap. A band that drifted would
    // make the flag come apart as it waves.
    assert.equal(rows.red.length, 3, `column ${x} has ${rows.red.length} red cells`);
    assert.equal(rows.blue[0], rows.red[2] + 1, `column ${x}: blue does not follow red`);
    assert.equal(rows.orange[0], rows.blue[2] + 1, `column ${x}: orange does not follow blue`);
  }
});

test("the flag waves — its bands are not a straight line", () => {
  const tops = new Map();
  for (const c of chartCells(ARMENIAN_FLAG.red)) {
    if (!tops.has(c.x) || c.y < tops.get(c.x)) tops.set(c.x, c.y);
  }
  const distinct = new Set(tops.values());
  assert.ok(distinct.size > 1, "every column starts on the same row — the flag is a rectangle");
});

test("the pole runs past the bottom of the flag", () => {
  const poleMax = Math.max(...chartCells(ARMENIAN_FLAG.pole).map((c) => c.y));
  const flagMax = Math.max(...chartCells(ARMENIAN_FLAG.orange).map((c) => c.y));
  assert.ok(poleMax > flagMax, "the flag floats — the pole stops at or above its bottom edge");
});

test("the pole is to the left of every band", () => {
  const poleX = new Set(chartCells(ARMENIAN_FLAG.pole).map((c) => c.x));
  const bandMinX = Math.min(...chartCells(ARMENIAN_FLAG.red).map((c) => c.x));
  for (const x of poleX) assert.ok(x < bandMinX, `pole column ${x} is inside the flag`);
});

// ── the words, and their colours ────────────────────────────

test("the three words are the sentence on the photographed piece", () => {
  assert.equal(HYE_EM_YES_TEXT, "հայ եմ ես");
  assert.equal(HYE_EM_YES_WORDS.length, 3);
});

test("the words are lowercase, as the piece is stitched", () => {
  for (const word of HYE_EM_YES_WORDS) {
    assert.equal(word.text, word.text.toLowerCase(),
      `"${word.text}" is capitalised; public/img/hye-em-bib/01.jpg is not`);
  }
});

test("the thread colours match the product's colorway to the digit", () => {
  // The Studio can edit that JSON. If someone changes the swatch there and
  // the stitched piece keeps the old hexes, the customer picks a colour
  // from a gradient the 3D piece is not wearing.
  const product = readJson("content/products/hy-em-armenian-bib.json");
  const gradient = product.colorways?.[0]?.swatch?.gradient;
  assert.ok(Array.isArray(gradient), "the Hye Em Yes colorway has no gradient");
  assert.deepEqual(
    HYE_EM_YES_WORDS.map((w) => w.color.toUpperCase()),
    gradient.map((c) => String(c).toUpperCase()),
    "the flag colours in src/data/hyeEmYes.js and content/products/hy-em-armenian-bib.json disagree",
  );
});

test("the flag's band colours are the same three as the words", () => {
  assert.deepEqual(
    [ARMENIAN_FLAG_COLORS.red, ARMENIAN_FLAG_COLORS.blue, ARMENIAN_FLAG_COLORS.orange],
    HYE_EM_YES_WORDS.map((w) => w.color),
  );
  // The pole is thread, not flag: it must not be one of the three, or the
  // cap would fly a four-colour flag.
  assert.ok(!HYE_EM_YES_WORDS.some((w) => w.color === ARMENIAN_FLAG_COLORS.pole));
});
