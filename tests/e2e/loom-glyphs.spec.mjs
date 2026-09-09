// ============================================================
// GLYPH RASTERISER — real ink, in a real browser
// ============================================================
// The Loom derives its stitch charts from the actual font rather than
// from 74 hand-drawn grids, so a customer's Armenian name is stitched in
// the real letterforms. That only works if the canvas actually draws.
//
// This test exists because it did not, once. The font shorthand was
// composed as `${size}px ${family}` with the weight already inside
// `family`, producing `104px 600 "Fraunces"` — invalid CSS. A canvas does
// not throw on an invalid font; it silently keeps 10px sans-serif. Every
// chart came out blank, and nothing in the unit suite could have noticed,
// because the unit suite feeds the sampler directly.
//
// It imports the real modules from source (which is why stitch/*.js are
// plain JavaScript) rather than re-implementing the rasteriser, so it
// cannot pass while the shipped code is broken.
// ============================================================

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(here, "../../src/loom/stitch", p), "utf8");

// Armenian capitals Ա (U+0531) through Ֆ (U+0556).
const ARMENIAN = Array.from({ length: 38 }, (_, i) => String.fromCodePoint(0x0531 + i));
const LATIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const DIGITS = "0123456789".split("");

// Serve src/loom/stitch/*.js over a routed same-origin path so the browser
// imports the SHIPPED source. A data: URL would be simpler but the site's
// CSP does not allow data: scripts, and a relative "./chart.js" import
// cannot resolve from inside one — over a real path it just works.
async function loadStitchModules(page) {
  await page.route("**/__loomtest/*.js", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop();
    try {
      await route.fulfill({
        status: 200,
        contentType: "text/javascript; charset=utf-8",
        body: read(name),
      });
    } catch {
      await route.fulfill({ status: 404, body: "" });
    }
  });

  await page.evaluate(async () => {
    const mod = await import("/__loomtest/rasterize.js");
    try {
      await document.fonts.load('600 40px "Fraunces"');
      await document.fonts.ready;
    } catch { /* falls back to the serif stack; the test still asserts ink */ }
    window.__loomRaster = mod;
  });
}

test.describe("Loom glyph rasteriser", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
      "the throttled tier projects do not exercise the engine");
  });

  test("every character the site can stitch produces real ink", async ({ page }) => {
    test.setTimeout(120_000);
    // A real page so the site's own @font-face rules are in play.
    await page.goto("/");
    await loadStitchModules(page);

    const result = await page.evaluate(({ chars }) => {
      const { chartForChar } = window.__loomRaster;
      const blank = [];
      const counts = [];
      for (const ch of chars) {
        const chart = chartForChar(ch);
        if (!chart) { blank.push(ch); continue; }
        const n = chart.rows.reduce((sum, row) => sum + (row.split("X").length - 1), 0);
        if (n === 0) blank.push(ch);
        counts.push(n);
      }
      return { blank, min: Math.min(...counts), max: Math.max(...counts) };
    }, { chars: [...ARMENIAN, ...LATIN, ...DIGITS] });

    expect(result.blank, `characters that rasterised to nothing: ${result.blank.join(" ")}`).toEqual([]);
    // A glyph reduced to two or three stitches is not a letter any more —
    // that is the signature of the font silently falling back to 10px.
    expect(result.min, "a character rasterised to almost no stitches").toBeGreaterThan(10);
  });

  test("charts fit their grid and stay centred", async ({ page }) => {
    await page.goto("/");
    await loadStitchModules(page);

    const bad = await page.evaluate(({ chars }) => {
      const { chartForChar } = window.__loomRaster;
      const problems = [];
      for (const ch of chars) {
        const chart = chartForChar(ch);
        if (!chart) continue;
        if (chart.w !== 13 || chart.h !== 15) problems.push(`${ch}: ${chart.w}x${chart.h}`);
        if (chart.rows.some((r) => r.length !== chart.w)) problems.push(`${ch}: ragged`);
      }
      return problems;
    }, { chars: [...ARMENIAN.slice(0, 10), ...LATIN.slice(0, 5)] });

    expect(bad).toEqual([]);
  });

  test("an unstitchable character is reported, not silently skipped", async ({ page }) => {
    await page.goto("/");
    await loadStitchModules(page);

    const out = await page.evaluate(() => {
      const { chartForChar } = window.__loomRaster;
      return {
        space: chartForChar(" "),
        empty: chartForChar(""),
      };
    });
    // The planner treats null as "cannot be stitched" and surfaces it, so a
    // name never quietly loses a letter between the form and the cloth.
    expect(out.space).toBeNull();
    expect(out.empty).toBeNull();
  });
});
