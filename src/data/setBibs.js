// ============================================================
// THE SET BIBS — what each piece in a set actually says
// ============================================================
// Three products are sets of pieces, each carrying fixed Armenian words:
// the seven Days-of-the-Week bibs, the Mama-and-Papa Anushig pair, and
// the Bari Akhorzhak bib with its burp cloth. Nobody types these; they
// are the product.
//
// The words are also written out in prose in each product's JSON, in the
// description and in a "Reads" detail row, because a customer needs to
// know what they are buying. Those are the copy Lusik reviewed. So the
// strings here are checked against that JSON by a drift test rather than
// trusted: getting an Armenian word wrong on a baby's bib is not a bug
// anyone would catch by reading this file, and the 3D piece and the page
// describing it must not be able to disagree.
//
// Plain JavaScript rather than TypeScript, the same reason as
// blanketLayout.js and hyeEmYes.js: CI runs the unit suite on Node 20,
// which cannot import TypeScript, and a drift test has to compare against
// the REAL values rather than a transcription of them.
//
// Line breaks and motif placement are rendering decisions, read off the
// photographs named beside each entry; the WORDS are the JSON's.
// ============================================================

/** @typedef {{ lines: string[], label: string }} StitchedPiece */

/**
 * Monday through Sunday, one word per bib, in the order a week runs.
 * Reference: public/img/days-bib/02.jpg, which shows all seven together —
 * one line of text each, low on the bib, and a different cloth colour per
 * day in the Rainbow colourway.
 */
export const DAYS_OF_WEEK = Object.freeze([
  { lines: ["Երկուշաբթի"], label: "Monday" },
  { lines: ["Երեքշաբթի"], label: "Tuesday" },
  { lines: ["Չորեքշաբթի"], label: "Wednesday" },
  { lines: ["Հինգշաբթի"], label: "Thursday" },
  { lines: ["Ուրբաթ"], label: "Friday" },
  { lines: ["Շաբաթ"], label: "Saturday" },
  { lines: ["Կիրակի"], label: "Sunday" },
]);

/**
 * The pair. Two lines each with a small motif worked between them.
 * Reference: public/img/anushig-bib/cover.jpg.
 */
export const ANUSHIG_PAIR = Object.freeze([
  { lines: ["Մայրիկիս", "Անոյշիկը"], label: "Mama's sweetheart" },
  { lines: ["Պապայիս", "Անոյշիկը"], label: "Papa's sweetheart" },
]);

/**
 * The blessing, split across the two pieces: the bib is said before the
 * baby eats, the burp cloth answers afterwards.
 * Reference: public/img/bari-akhorzhak-set/cover.jpg.
 */
export const BARI_AKHORZHAK = Object.freeze({
  bib: { lines: ["Բարի", "ախորժակ"], label: "Bon appétit" },
  burpCloth: { lines: ["Անույշ", "ըլլայ"], label: "May it be sweet" },
});

/**
 * Every Armenian phrase this module claims, as one flat list, so the
 * drift test can check them all without knowing each product's shape.
 *
 * @returns {{ product: string, phrase: string }[]}
 */
export function statedPhrases() {
  const out = [];
  for (const day of DAYS_OF_WEEK) {
    out.push({ product: "days-of-the-week-bib-set", phrase: day.lines.join(" ") });
  }
  for (const bib of ANUSHIG_PAIR) {
    out.push({ product: "anushig-bib-set", phrase: bib.lines.join(" ") });
  }
  for (const piece of [BARI_AKHORZHAK.bib, BARI_AKHORZHAK.burpCloth]) {
    out.push({ product: "bari-akhorzhak-bib-burp-cloth-set", phrase: piece.lines.join(" ") });
  }
  return out;
}

/**
 * Pick the thread (and, where a colourway names one, the cloth) for a
 * piece from the colourway the customer chose in the gallery.
 *
 * A colourway swatch comes in three shapes, and each means something
 * different about the piece: `color` is one thread across the whole set,
 * `dual` is [cloth, thread] for the pieces that pair a body colour with a
 * contrasting stitch, and `gradient` is a colour PER PIECE — which is
 * what the Rainbow days set is, and why this takes an index.
 *
 * @param {{ color?: string, dual?: string[], gradient?: string[] } | null | undefined} swatch
 * @param {number} index  which piece in the set
 * @param {{ thread: string, cloth: string }} fallback
 * @returns {{ thread: string, cloth: string }}
 */
export function pieceColors(swatch, index, fallback) {
  if (!swatch) return fallback;
  if (Array.isArray(swatch.gradient) && swatch.gradient.length > 0) {
    // A colour per piece: the cloth changes down the set and the thread
    // stays readable against it, which is how the photographed rainbow
    // set is made — pastel cloth, a deeper shade of the same family on top.
    const cloth = swatch.gradient[index % swatch.gradient.length];
    return { cloth, thread: readableOn(cloth, cloth) };
  }
  if (Array.isArray(swatch.dual) && swatch.dual.length >= 2) {
    return { cloth: swatch.dual[0], thread: swatch.dual[1] };
  }
  if (typeof swatch.color === "string") {
    // One thread across a set of white pieces.
    return { cloth: fallback.cloth, thread: readableOn(swatch.color, fallback.cloth) };
  }
  return fallback;
}

/**
 * The customer's colour, in a shade that will actually read as stitching
 * on the cloth it is worked into.
 *
 * The swatches in the product JSON are photographed pastels — they sit
 * next to cloth tones, not floss tones. `#E8B5C7` stitched onto white
 * terry is not a subtle piece, it is a piece nobody can see; and in the
 * Rainbow days set the cloth and the thread start out as the SAME colour.
 * Meanwhile the real pieces plainly carry a strong rose, a navy, a green.
 *
 * Hue is preserved, because hue is what the customer chose. Only
 * lightness (and, for a washed-out pastel, saturation) moves, and only as
 * far as it must. Snapping to a fixed thread palette was the other option
 * and was worse: nearest-in-RGB turns a gold swatch into wine red, and
 * Lusik's eight-colour drawer has no gold in it at all.
 *
 * @param {string} hex     the colour the customer picked
 * @param {string} clothHex the cloth it is worked into
 * @returns {string}
 */
export function readableOn(hex, clothHex) {
  const c = toHsl(hex);
  if (!c) return "#4A4A4A";
  const cloth = toHsl(clothHex) ?? { h: 0, s: 0, l: 1 };

  // Pastels are washed out as well as pale; lifting saturation is what
  // keeps a deepened pink from turning into mauve.
  const s = Math.max(c.s, MIN_SATURATION);
  let l = c.l;
  if (Math.abs(l - cloth.l) < MIN_LIGHTNESS_GAP) {
    l = cloth.l > 0.5 ? cloth.l - MIN_LIGHTNESS_GAP : cloth.l + MIN_LIGHTNESS_GAP;
  }
  return fromHsl(c.h, s, Math.max(0.08, Math.min(0.92, l)));
}

/** How far a thread's lightness must sit from the cloth's to read as stitching. */
const MIN_LIGHTNESS_GAP = 0.4;
/** Below this, a colour reads as grey once it is darkened. */
const MIN_SATURATION = 0.45;

/**
 * @param {string} hex
 * @returns {{ h: number, s: number, l: number } | null}
 */
function toHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ""));
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

/**
 * @param {number} h
 * @param {number} s
 * @param {number} l
 * @returns {string}
 */
function fromHsl(h, s, l) {
  const hue = (p, q, t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  let r; let g; let b;
  if (s === 0) {
    r = l; g = l; b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue(p, q, h + 1 / 3);
    g = hue(p, q, h);
    b = hue(p, q, h - 1 / 3);
  }
  const byte = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return `#${((1 << 24) | (byte(r) << 16) | (byte(g) << 8) | byte(b)).toString(16).slice(1).toUpperCase()}`;
}

/**
 * A darker, more saturated version of a pastel, for thread on cloth of
 * the same family.
 *
 * The pastels in the colourways are light enough that stitching them onto
 * their own cloth would be invisible — which is a product photograph
 * nobody can read, not a subtle one. Halving the lightness keeps the hue.
 *
 * @param {string} hex
 * @returns {string}
 */
export function deepen(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ""));
  if (!m) return "#4A4A4A";
  const n = parseInt(m[1], 16);
  const scale = (v) => Math.max(0, Math.min(255, Math.round(v * 0.52)));
  const r = scale((n >> 16) & 255);
  const g = scale((n >> 8) & 255);
  const b = scale(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}
