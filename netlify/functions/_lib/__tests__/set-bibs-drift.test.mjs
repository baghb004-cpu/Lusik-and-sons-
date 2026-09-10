// ============================================================
// THE SET BIBS vs WHAT THEIR PRODUCT PAGES SAY
// ============================================================
// The Days-of-the-Week, Anushig and Bari Akhorzhak rigs stitch fixed
// Armenian words. The same words are written out in each product's JSON,
// in the description and the "Reads" detail row, because a customer has
// to know what they are buying — and that copy is what Lusik reviewed.
//
// Nobody reviewing a diff of src/data/setBibs.js would catch a wrong
// Armenian word, and the failure is not a broken build: it is a bib with
// a misspelling on it, hand-stitched, in a box, in the post. So the
// strings are checked against the JSON rather than trusted, in both
// directions — a word missing from the rig is as wrong as an invented one.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  ANUSHIG_PAIR, BARI_AKHORZHAK, DAYS_OF_WEEK,
  deepen, pieceColors, readableOn, statedPhrases,
} from "../../../../src/data/setBibs.js";

/** Rough perceived lightness, 0 to 1. */
function lightness(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

/** Hue in turns, 0 to 1. */
function hue(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  if (max === r) return (((g - b) / d + (g < b ? 6 : 0)) / 6) % 1;
  if (max === g) return ((b - r) / d + 2) / 6;
  return ((r - g) / d + 4) / 6;
}

/** Shortest distance between two hues on the circle. */
function hueGap(a, b) {
  const d = Math.abs(hue(a) - hue(b));
  return Math.min(d, 1 - d);
}

const here = dirname(fileURLToPath(import.meta.url));
const readJson = (slug) =>
  JSON.parse(readFileSync(resolve(here, "../../../../content/products", `${slug}.json`), "utf8"));

/** Everything a product page says, as one searchable string. */
function productProse(slug) {
  const p = readJson(slug);
  const parts = [p.name_hy ?? "", p.tagline ?? "", p.description ?? ""];
  for (const row of p.details ?? []) parts.push(row.value ?? "");
  return parts.join("\n");
}

test("every phrase the rigs stitch appears verbatim on the product page", () => {
  const missing = [];
  for (const { product, phrase } of statedPhrases()) {
    if (!productProse(product).includes(phrase)) missing.push(`${product}: ${phrase}`);
  }
  assert.deepEqual(missing, [],
    `these phrases are in src/data/setBibs.js but not in the product JSON:\n  ${missing.join("\n  ")}`);
});

test("the seven day names on the page are the seven the rig stitches", () => {
  // The other direction. A day dropped from the rig would ship a set of
  // six bibs and a gap, and the phrase check above would still pass.
  const prose = productProse("days-of-the-week-bib-set");
  // The JSON lists them comma-separated in the "Set size" row.
  const listed = (prose.match(/[԰-֏]+/g) ?? []).filter((w) => w.length > 3);
  for (const day of DAYS_OF_WEEK) {
    assert.ok(listed.includes(day.lines[0]), `${day.lines[0]} (${day.label}) is not on the page`);
  }
  assert.equal(DAYS_OF_WEEK.length, 7, "a week has seven days");
  assert.equal(new Set(DAYS_OF_WEEK.map((d) => d.lines[0])).size, 7, "two bibs carry the same day");
});

test("the pair is Mama's and Papa's, and they differ", () => {
  assert.equal(ANUSHIG_PAIR.length, 2);
  const [mama, papa] = ANUSHIG_PAIR;
  assert.notEqual(mama.lines[0], papa.lines[0], "both bibs say the same thing");
  // The second line is shared — that is what makes them a matched pair.
  assert.equal(mama.lines[1], papa.lines[1]);
});

test("the blessing is split across the two pieces, not repeated", () => {
  const bib = BARI_AKHORZHAK.bib.lines.join(" ");
  const burp = BARI_AKHORZHAK.burpCloth.lines.join(" ");
  assert.notEqual(bib, burp);
  assert.ok(bib.length > 0 && burp.length > 0);
});

test("no phrase carries a TODO marker into the stitching", () => {
  for (const { phrase } of statedPhrases()) {
    assert.ok(!/TODO/i.test(phrase), `"${phrase}" carries a TODO marker`);
  }
});

// ── colour selection ────────────────────────────────────────

test("a single-colour swatch is a thread colour, not a cloth colour", () => {
  const out = pieceColors({ color: "#E8B5C7" }, 0, { thread: "#000", cloth: "#FFFFFF" });
  assert.equal(out.cloth, "#FFFFFF", "a thread colourway must not repaint the cloth");
  // The colour the customer picked is a pastel swatch, and stitched onto
  // white terry at that lightness it is invisible. It is darkened to read,
  // but it stays the pink they chose.
  assert.ok(hueGap(out.thread, "#E8B5C7") < 0.05,
    `${out.thread} is not the same hue as the swatch #E8B5C7`);
  assert.ok(lightness(out.thread) < lightness("#E8B5C7"),
    "the thread was not darkened at all");
});

test("every colourway keeps its own hue rather than snapping to a palette", () => {
  // Nearest-in-palette was the other option, and it turns the gold
  // colourway into wine red, because Lusik's eight-colour drawer has no
  // gold in it. The customer picked gold.
  for (const swatch of ["#E8B5C7", "#93B7D5", "#B5D9BC", "#E8D89B", "#BBA8D6"]) {
    const thread = readableOn(swatch, "#FFFFFF");
    assert.ok(hueGap(thread, swatch) < 0.05, `${swatch} became ${thread}, a different colour`);
    assert.ok(lightness("#FFFFFF") - lightness(thread) > 0.2,
      `${thread} does not read on white cloth`);
  }
});

test("a colour already dark enough is left where it is", () => {
  // Only the pieces that cannot be seen get moved; a navy on white is
  // already stitching.
  const navy = readableOn("#2B4C73", "#FFFFFF");
  assert.ok(lightness(navy) < 0.4);
  assert.ok(hueGap(navy, "#2B4C73") < 0.05);
});

test("a near-grey is not turned into a colour", () => {
  const grey = readableOn("#8A8A8A", "#FFFFFF");
  assert.ok(Math.abs(lightness(grey) - lightness("#8A8A8A")) < 0.25,
    `charcoal moved to ${grey}`);
});

test("a dual swatch is [cloth, thread], in that order", () => {
  const out = pieceColors({ dual: ["#EFE7D6", "#5B6F47"] }, 0, { thread: "#000", cloth: "#FFF" });
  assert.equal(out.cloth, "#EFE7D6");
  assert.equal(out.thread, "#5B6F47");
});

test("a gradient gives each piece its own cloth and cycles", () => {
  const swatch = { gradient: ["#E8B5C7", "#BBA8D6", "#93B7D5"] };
  const fallback = { thread: "#000", cloth: "#FFF" };
  assert.equal(pieceColors(swatch, 0, fallback).cloth, "#E8B5C7");
  assert.equal(pieceColors(swatch, 1, fallback).cloth, "#BBA8D6");
  // Seven bibs, five colours: the set has to keep going rather than run out.
  assert.equal(pieceColors(swatch, 3, fallback).cloth, "#E8B5C7");
});

test("thread on same-family cloth is deepened enough to read", () => {
  // The Rainbow days set is the hard case: the cloth colour and the thread
  // colour start out as literally the same value.
  for (const pastel of ["#E8B5C7", "#BBA8D6", "#93B7D5", "#B5D9BC", "#E8D89B"]) {
    const { cloth, thread } = pieceColors({ gradient: [pastel] }, 0, { thread: "#000", cloth: "#FFF" });
    assert.equal(cloth, pastel, "the cloth is not the colour the gradient names");
    assert.notEqual(thread, cloth, "the stitching is the same colour as the cloth it is on");
    assert.ok(lightness(thread) < lightness(cloth) * 0.72,
      `thread ${thread} is not much darker than cloth ${cloth}`);
    assert.ok(hueGap(thread, cloth) < 0.05, "the thread is a different colour from the cloth");
  }
});

test("a missing or malformed swatch falls back rather than throwing", () => {
  const fallback = { thread: "#8B2C2C", cloth: "#FFFFFF" };
  assert.deepEqual(pieceColors(null, 0, fallback), fallback);
  assert.deepEqual(pieceColors(undefined, 3, fallback), fallback);
  assert.deepEqual(pieceColors({}, 0, fallback), fallback);
  assert.equal(deepen("not a colour"), "#4A4A4A");
  assert.equal(deepen(undefined), "#4A4A4A");
  assert.equal(readableOn("not a colour", "#FFFFFF"), "#4A4A4A");
});
