// ============================================================
// GLYPH RASTERISER — a real letterform becomes a stitch chart
// ============================================================
// The alternative was hand-authoring 38 Armenian capitals, 26 Latin
// capitals and 10 digits as cell grids. That is 74 charts drawn by
// someone who does not read Armenian, and every one of them would be a
// chance to ship a subtly wrong letter on a blanket with a child's name
// on it.
//
// Instead: draw the actual glyph, in the site's actual display font, onto
// a small offscreen canvas, and sample coverage per cell. The letterforms
// are then correct by construction, and adding a language is adding a
// string of characters rather than drawing a grid.
//
// Browser-only, and plain JavaScript with JSDoc rather than TypeScript.
// The hand-off plan says src/loom/ is TypeScript; the reason to deviate
// here is the same one that governs chart.js and planner.js — a test has
// to be able to import THIS file, not a transcription of it. The e2e
// contrast and drift work in this repo has already shown what happens
// when a test checks a copy of the logic: it passes while the real code
// is broken. The browser test imports this module directly.
//
// The thresholding and centring live in chart.js, which is pure and tested
// in Node; this file only supplies the pixels.
// ============================================================

import {
  CAPITAL_H, CAPITAL_W, LOWER_BASELINE, LOWER_H, LOWER_W,
  centerChart, chartFromSampler, trimChartX,
} from "./chart.js";

/** @typedef {import("./chart.js").Chart} Chart */

/** Supersampling factor: pixels per chart cell before we average. */
const SS = 8;

/**
 * How much of the font's em box to fill. Cross stitch charts leave a cell
 * of air around a capital so the backstitched cube does not touch it.
 */
const FILL = 0.86;

/** @type {Map<string, Chart>} */
const cache = new Map();

let canvas = null;
let ctx = null;

function surface(w, h) {
  if (!canvas) {
    canvas = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : document.createElement("canvas");
    // `willReadFrequently` matters: we call getImageData once per glyph and
    // without it Chrome keeps the canvas on the GPU and each read stalls.
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return ctx;
}

/**
 * @typedef {object} RasterOptions
 * @property {number} [w] chart width in cells
 * @property {number} [h] chart height in cells
 * @property {string} [fontFamily] family list, e.g. `"Fraunces", Georgia, serif`. No weight, no size.
 * @property {number|string} [fontWeight] font weight, kept SEPARATE from the family.
 *   CSS font shorthand is `<weight> <size> <family>`. Folding the weight into the
 *   family string yields `104px 600 "Fraunces"`, which is invalid — and a canvas
 *   does not throw on an invalid font, it silently keeps the previous value
 *   (10px sans-serif). Every chart then came out blank. That bug is why this is
 *   two fields and why there is a browser test below asserting real ink.
 * @property {number} [threshold] coverage at or above which a cell becomes a stitch
 * @property {number} [baseline] lowercase only: the chart row the letters sit on
 */

/**
 * Rasterise one character into a stitch chart.
 *
 * Returns null when the character produced no ink at all — an unsupported
 * glyph, or whitespace. The planner treats null as "cannot be stitched"
 * and reports it rather than leaving a hole in the middle of a name.
 */
/**
 * @param {string} char
 * @param {RasterOptions} [opts]
 * @returns {Chart | null}
 */
export function chartForChar(char, opts = {}) {
  const w = opts.w ?? CAPITAL_W;
  const h = opts.h ?? CAPITAL_H;
  const family = opts.fontFamily ?? '"Fraunces", Georgia, serif';
  const weight = opts.fontWeight ?? 600;
  const key = `${char}|${w}x${h}|${weight} ${family}|${opts.threshold ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;

  if (!char || char.trim() === "") return null;

  const pxW = w * SS;
  const pxH = h * SS;
  const c = surface(pxW, pxH);
  if (!c) return null;

  c.clearRect(0, 0, pxW, pxH);
  c.fillStyle = "#000";
  c.textAlign = "center";
  c.textBaseline = "middle";

  // Size the glyph to the cell box rather than trusting the font's own
  // metrics: Armenian capitals and Latin capitals do not share a cap
  // height, and both have to fill the same cube.
  let size = Math.floor(pxH * FILL);
  c.font = `${weight} ${size}px ${family}`;
  const measured = c.measureText(char);
  const glyphW = measured.width;
  const maxW = pxW * FILL;
  if (glyphW > maxW && glyphW > 0) {
    size = Math.max(4, Math.floor(size * (maxW / glyphW)));
    c.font = `${weight} ${size}px ${family}`;
  }
  c.fillText(char, pxW / 2, pxH / 2);

  let data;
  try {
    data = c.getImageData(0, 0, pxW, pxH).data;
  } catch {
    // A tainted or zero-sized canvas. Better no chart than a wrong one.
    return null;
  }

  // Average alpha over each cell's SS x SS block.
  const sample = (cx, cy) => {
    let total = 0;
    for (let y = 0; y < SS; y += 1) {
      const row = (cy * SS + y) * pxW;
      for (let x = 0; x < SS; x += 1) {
        total += data[(row + cx * SS + x) * 4 + 3];
      }
    }
    return total / (SS * SS * 255);
  };

  const raw = chartFromSampler(sample, { w, h, threshold: opts.threshold ?? 0.35 });
  const chart = centerChart(raw, { w, h });

  // An all-empty chart means the font had no glyph for this character.
  // Caching that would be caching a failure, and the font may not have
  // finished loading yet — so leave it uncached and let a later call retry.
  const hasInk = chart.rows.some((row) => row.includes("X"));
  if (!hasInk) return null;

  cache.set(key, chart);
  return chart;
}

// ============================================================
// LOWERCASE
// ============================================================
// Capitals get one treatment because they all occupy the same band:
// draw the glyph as large as its box allows, then centre it. Lowercase
// cannot be done that way twice over.
//
// First, the size has to be shared. Fitting each glyph to its own box
// would draw ա as tall as հ, and a word would come out with its letters
// all the same height — which is the one thing lowercase is not. So the
// size is measured ONCE per font from a probe carrying the extremes of
// the script, and every letter is then drawn at that size.
//
// Second, the vertical position has to be shared. centerChart is exactly
// wrong here: it would lift ք out of its descender and drop հ out of its
// ascender, and the word would bob. Each glyph is drawn against the
// chart's fixed baseline row instead, and only the horizontal axis is
// trimmed.
//
// The probe is deliberately explicit. "Հհղ" is a capital, an ascender
// and a descender: whatever the font does with Armenian, the tallest and
// deepest things we will draw are in that string, so nothing later
// overflows the box it was sized for.
const LOWER_PROBE = "Հհղ";

/** Blank cells kept above the tallest ascender and below the deepest descender. */
const LOWER_MARGIN = 0.94;

/** @type {Map<string, number>} */
const sizeCache = new Map();

/**
 * The one font size every lowercase glyph in a family is drawn at.
 *
 * Returns 0 when the probe measures nothing, which means the font has no
 * Armenian and there is no honest size to pick. Callers treat that the
 * same as a missing glyph rather than guessing.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {string} family
 * @param {number|string} weight
 * @param {number} ascentCells
 * @param {number} descentCells
 * @returns {number}
 */
function lowercaseSize(c, family, weight, ascentCells, descentCells) {
  const key = `${weight} ${family}|${ascentCells}/${descentCells}`;
  const hit = sizeCache.get(key);
  if (hit !== undefined) return hit;

  // Measure at a nominal size and scale from there. Font metrics are
  // linear in size, so one measurement is enough.
  const NOMINAL = 100;
  c.font = `${weight} ${NOMINAL}px ${family}`;
  const m = c.measureText(LOWER_PROBE);
  const ascent = m.actualBoundingBoxAscent;
  const descent = m.actualBoundingBoxDescent;
  if (!(ascent > 0)) {
    sizeCache.set(key, 0);
    return 0;
  }

  const ascentBudget = ascentCells * SS * LOWER_MARGIN;
  const descentBudget = descentCells * SS * LOWER_MARGIN;
  let scale = ascentBudget / ascent;
  // A font with no descender in the probe would divide by zero; there is
  // nothing hanging below the line to constrain, so ascent alone decides.
  if (descent > 0) scale = Math.min(scale, descentBudget / descent);

  const size = Math.max(4, Math.floor(NOMINAL * scale));
  sizeCache.set(key, size);
  return size;
}

/**
 * Rasterise one lowercase character into a baseline-aligned chart.
 *
 * The returned chart is always LOWER_H tall (so the planner can go on
 * centring the box in a slot and have the letters still line up) and as
 * wide as the letter's own ink (so ի does not take the same room as ղ).
 *
 * Null means no ink — an unsupported glyph, or whitespace. A space is
 * the caller's business: word gaps are laid out, not stitched.
 */
/**
 * @param {string} char
 * @param {RasterOptions} [opts]
 * @returns {Chart | null}
 */
export function lowercaseChartForChar(char, opts = {}) {
  const w = opts.w ?? LOWER_W;
  const h = opts.h ?? LOWER_H;
  const baseline = opts.baseline ?? LOWER_BASELINE;
  const family = opts.fontFamily ?? '"Fraunces", Georgia, serif';
  const weight = opts.fontWeight ?? 600;
  const key = `lower|${char}|${w}x${h}@${baseline}|${weight} ${family}|${opts.threshold ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;

  if (!char || char.trim() === "") return null;

  const pxW = w * SS;
  const pxH = h * SS;
  const c = surface(pxW, pxH);
  if (!c) return null;

  const size = lowercaseSize(c, family, weight, baseline, h - baseline);
  if (size === 0) return null;

  c.clearRect(0, 0, pxW, pxH);
  c.fillStyle = "#000";
  c.textAlign = "center";
  // "alphabetic" is the whole point: it is the baseline, so every glyph
  // is positioned by where it SITS rather than by where its middle is.
  c.textBaseline = "alphabetic";
  c.font = `${weight} ${size}px ${family}`;
  c.fillText(char, pxW / 2, baseline * SS);

  let data;
  try {
    data = c.getImageData(0, 0, pxW, pxH).data;
  } catch {
    return null;
  }

  const sample = (cx, cy) => {
    let total = 0;
    for (let y = 0; y < SS; y += 1) {
      const row = (cy * SS + y) * pxW;
      for (let x = 0; x < SS; x += 1) {
        total += data[(row + cx * SS + x) * 4 + 3];
      }
    }
    return total / (SS * SS * 255);
  };

  const raw = chartFromSampler(sample, { w, h, threshold: opts.threshold ?? 0.3 });
  const hasInk = raw.rows.some((row) => row.includes("X"));
  // Uncached, same as the capital path: the webfont may still be loading
  // and caching this would cache the fallback face forever.
  if (!hasInk) return null;

  const chart = trimChartX(raw);
  cache.set(key, chart);
  return chart;
}

/**
 * Build a `chartFor` function for the planner, bound to one font and size.
 * Motif and outline charts are hand-authored and passed in as overrides.
 */
/**
 * @param {Record<string, Chart>} [overrides]
 * @param {RasterOptions} [opts]
 * @returns {(char: string) => Chart | null}
 */
export function makeChartResolver(overrides = {}, opts = {}) {
  return (char) => overrides[char] ?? chartForChar(char, opts);
}

/**
 * Drop the caches — call when the display font finishes loading.
 *
 * The measured lowercase size goes too. Keeping it would redraw every
 * letter in the real face at the fallback face's metrics, which is a
 * subtler wrong than a blank chart and would survive a screenshot.
 */
export function clearChartCache() {
  cache.clear();
  sizeCache.clear();
}
