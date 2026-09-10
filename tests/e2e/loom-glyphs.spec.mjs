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
// Armenian lowercase ա (U+0561) through ֆ (U+0586).
const ARMENIAN_LOWER = Array.from({ length: 38 }, (_, i) => String.fromCodePoint(0x0561 + i));
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
    // The real thing the shipped code waits for, asked for by name in
    // both scripts — the family is split into subset files by
    // unicode-range, so a load with no text argument fetches the Latin
    // one and leaves the Armenian one on the server.
    try { await mod.loadStitchFont(); } catch { /* asserted below */ }
    try { await document.fonts.load('600 40px "Fraunces"', "ANI"); } catch { /* only used by the comparison test */ }
    try { await document.fonts.ready; } catch { /* nothing to wait for */ }
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

  // ── lowercase ──────────────────────────────────────────
  // Lowercase is a different problem from capitals, and its failure looks
  // different too: not a blank chart but a word whose letters bob, because
  // each one was centred in its own box instead of set on a shared line.

  test("every Armenian lowercase letter produces real ink", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await loadStitchModules(page);

    const result = await page.evaluate(({ chars }) => {
      const { lowercaseChartForChar } = window.__loomRaster;
      const blank = [];
      const counts = [];
      for (const ch of chars) {
        const chart = lowercaseChartForChar(ch);
        if (!chart) { blank.push(ch); continue; }
        const n = chart.rows.reduce((sum, row) => sum + (row.split("X").length - 1), 0);
        if (n === 0) blank.push(ch);
        counts.push(n);
      }
      return { blank, min: Math.min(...counts) };
    }, { chars: ARMENIAN_LOWER });

    expect(result.blank, `lowercase letters that rasterised to nothing: ${result.blank.join(" ")}`).toEqual([]);
    expect(result.min, "a lowercase letter rasterised to almost no stitches").toBeGreaterThan(4);
  });

  test("lowercase letters sit on one baseline and keep their own widths", async ({ page }) => {
    await page.goto("/");
    await loadStitchModules(page);

    const out = await page.evaluate(() => {
      const { lowercaseChartForChar } = window.__loomRaster;
      const inspect = (ch) => {
        const chart = lowercaseChartForChar(ch);
        if (!chart) return null;
        let top = Infinity;
        let bottom = -Infinity;
        chart.rows.forEach((row, y) => {
          if (!row.includes("X")) return;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        });
        return { w: chart.w, h: chart.h, top, bottom };
      };
      return {
        // ա sits between the lines, հ rises above them, ղ drops below.
        mid: inspect("ա"),
        ascender: inspect("հ"),
        descender: inspect("ղ"),
        narrow: inspect("ի"),
        wide: inspect("ղ"),
      };
    });

    for (const [name, g] of Object.entries(out)) {
      expect(g, `${name} produced no chart`).not.toBeNull();
    }

    // Every chart is the same height: that is what lets the planner centre
    // the BOX in a slot and still have the letters line up.
    expect(out.ascender.h).toBe(out.mid.h);
    expect(out.descender.h).toBe(out.mid.h);

    // The ascender starts higher than the x-height letter, and the
    // descender ends lower. If either failed, every glyph had been
    // vertically centred in its own box and the word would bob.
    expect(out.ascender.top, "հ does not rise above ա").toBeLessThan(out.mid.top);
    expect(out.descender.bottom, "ղ does not drop below ա").toBeGreaterThan(out.mid.bottom);

    // ...and they share the line they sit ON. ա and հ both rest on the
    // baseline, so their bottoms agree to within a cell of rounding.
    expect(Math.abs(out.ascender.bottom - out.mid.bottom),
      "ա and հ do not share a baseline").toBeLessThanOrEqual(1);

    // Charts are trimmed to their own ink, so a narrow letter is narrower.
    expect(out.narrow.w, "ի is not narrower than ղ").toBeLessThan(out.wide.w);
  });

  test("an unstitchable character is reported, not silently skipped", async ({ page }) => {
    await page.goto("/");
    await loadStitchModules(page);

    const out = await page.evaluate(() => {
      const { chartForChar } = window.__loomRaster;
      const { lowercaseChartForChar } = window.__loomRaster;
      return {
        space: chartForChar(" "),
        empty: chartForChar(""),
        lowerSpace: lowercaseChartForChar(" "),
      };
    });
    // The planner treats null as "cannot be stitched" and surfaces it, so a
    // name never quietly loses a letter between the form and the cloth.
    expect(out.space).toBeNull();
    expect(out.empty).toBeNull();
    // Word gaps on the Hye Em Yes bib are laid out, never stitched.
    expect(out.lowerSpace).toBeNull();
  });
});

// ── the face the charts actually come from ─────────────────
// Two separate failures live here, and neither is visible by reading the
// rasteriser.
//
// The first is coverage: Fraunces has NO Armenian glyphs — its
// unicode-ranges stop at latin-ext — so for the whole of this shop's
// alphabet the browser substituted whatever the device had. Different
// letterforms on a Mac, on Windows and on Android; empty boxes on a
// machine with no Armenian font at all.
//
// The second is weight. Fraunces is a high-contrast display cut. A chart
// keeps a cell whose average coverage clears 0.35 over a 13x15 grid, and
// its hairlines never get there: "A" charted as a bare diagonal with no
// crossbar and no left leg, and the digits came out in fragments. Every
// existing test above passed the whole time — the glyph had plenty of
// ink, it just was not the letter any more.

test.describe("Loom charting face", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
      "the throttled tier projects do not exercise the engine");
  });

  test("letters with a horizontal stroke keep it", async ({ page }) => {
    await page.goto("/");
    await loadStitchModules(page);

    const runs = await page.evaluate(({ chars }) => {
      const { chartForChar } = window.__loomRaster;
      const widest = (rows) => Math.max(...rows.map((row) =>
        Math.max(0, ...row.split(".").map((run) => run.length))));
      const out = {};
      for (const ch of chars) {
        const chart = chartForChar(ch);
        out[ch] = chart ? widest(chart.rows) : 0;
      }
      return out;
      // "A" crossbar, "E"/"Z"/"2" bars, "H" bar, "T" arm. Under the
      // pinned face each of these runs 5 cells or more; under Fraunces
      // the widest run in an "A" is three, which is the stem, not a bar.
    }, { chars: ["A", "E", "H", "T", "Z", "2"] });

    for (const [ch, run] of Object.entries(runs)) {
      expect(run, `"${ch}" has no horizontal stroke wider than ${run} cells — the chart is a skeleton, not a letter`)
        .toBeGreaterThanOrEqual(5);
    }
  });

  test("the shipped stack charts from the pinned face, not the display face", async ({ page }) => {
    await page.goto("/");
    await loadStitchModules(page);

    const same = await page.evaluate(({ chars }) => {
      const { chartForChar, STITCH_FONT_STACK } = window.__loomRaster;
      const rows = (ch, fontFamily) => (chartForChar(ch, fontFamily ? { fontFamily } : {})?.rows ?? []).join("|");
      const out = { stack: STITCH_FONT_STACK, matchesPinned: [], matchesFraunces: [] };
      for (const ch of chars) {
        const shipped = rows(ch);
        if (shipped === rows(ch, '"Noto Serif Armenian", Georgia, serif')) out.matchesPinned.push(ch);
        if (shipped === rows(ch, '"Fraunces", Georgia, serif')) out.matchesFraunces.push(ch);
      }
      return out;
    }, { chars: ["A", "N", "2", "Ա", "Բ"] });

    expect(same.matchesPinned, `the default stack (${same.stack}) did not chart these the way the pinned face does`)
      .toEqual(["A", "N", "2", "Ա", "Բ"]);
    // Armenian is allowed to coincide — Fraunces has none, so both stacks
    // reach the same next face for it. Latin coinciding would mean the
    // display cut is back in front.
    expect(same.matchesFraunces.filter((ch) => /[A-Z0-9]/.test(ch)),
      "Latin charts came out identical to Fraunces, so the display face is charting stitches again")
      .toEqual([]);
  });
});
