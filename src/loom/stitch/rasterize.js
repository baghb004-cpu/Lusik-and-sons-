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

import { CAPITAL_H, CAPITAL_W, centerChart, chartFromSampler } from "./chart.js";

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

/** Drop the cache — call when the display font finishes loading. */
export function clearChartCache() {
  cache.clear();
}
