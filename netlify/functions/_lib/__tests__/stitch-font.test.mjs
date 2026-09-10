// ============================================================
// THE FACE EVERY STITCH IS CHARTED FROM
// ============================================================
// The Loom rasterises a glyph into a 13x15 grid and keeps the cells whose
// coverage clears a threshold. Which font draws that glyph is therefore
// not a styling choice — it decides the shape of every letter this shop
// stitches onto a blanket.
//
// Two things went wrong there, and this gate is written against both.
//
// 1. **Fraunces has no Armenian coverage at all.** Its unicode-ranges
//    stop at latin-ext and vietnamese. So the shape of Ա came from
//    whatever the visitor's operating system fell back to: one letterform
//    on a Mac, another on Windows, another on Android, and on a machine
//    with no Armenian font, empty boxes charted as stitches.
//
// 2. **Fraunces is a display cut, and its hairlines vanish on the grid.**
//    "A" charted as a bare diagonal with no crossbar and no left leg;
//    the digits came out in fragments. That one is not visible in code at
//    all — only in the render.
//
// This test cannot rasterise (Node has no canvas), so it gates the thing
// it can prove from the files: that the family the shipped code charts
// from is actually self-hosted here, with both scripts, and that every
// face the stylesheet promises has a file behind it.
// `tests/e2e/loom-glyphs.spec.mjs` checks the pixels.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = (p) => resolve(here, "../../../../", p);

const FONTS_CSS = readFileSync(root("src/styles/fonts.css"), "utf8");
const RASTERIZE = readFileSync(root("src/loom/stitch/rasterize.js"), "utf8");

/** Every @font-face in the stylesheet, as { family, src, ranges }. */
function faces(css) {
  const out = [];
  for (const [, body] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const family = body.match(/font-family:\s*['"]?([^;'"]+)['"]?\s*;/)?.[1]?.trim();
    const src = body.match(/url\(([^)]+)\)/)?.[1]?.replace(/['"]/g, "").trim();
    const range = body.match(/unicode-range:\s*([^;]+);/)?.[1] ?? "";
    if (family && src) out.push({ family, src, ranges: parseRanges(range) });
  }
  return out;
}

/** "U+0530-058F, U+FB13-FB17" -> [[0x530, 0x58f], [0xfb13, 0xfb17]] */
function parseRanges(text) {
  const out = [];
  for (const [, from, to] of text.matchAll(/U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?/g)) {
    const lo = parseInt(from, 16);
    out.push([lo, to ? parseInt(to, 16) : lo]);
  }
  // No unicode-range means the face covers everything.
  return out.length ? out : [[0, 0x10ffff]];
}

const ALL = faces(FONTS_CSS);

const covers = (family, codePoint) => ALL.some(
  (f) => f.family === family && f.ranges.some(([lo, hi]) => codePoint >= lo && codePoint <= hi),
);

/** The first family named in a CSS font stack, unquoted. */
function firstFamily(stack) {
  return stack.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
}

/** The literal assigned to an exported const in a source file. */
function exportedString(source, name) {
  const m = source.match(new RegExp(`export const ${name}\\s*=\\s*(['"])([\\s\\S]*?)\\1`));
  assert.ok(m, `${name} is not an exported string literal any more`);
  return m[2];
}

test("the charting stack leads with a family this repo self-hosts", () => {
  const family = firstFamily(exportedString(RASTERIZE, "STITCH_FONT_STACK"));
  assert.ok(
    ALL.some((f) => f.family === family),
    `STITCH_FONT_STACK charts from "${family}", which has no @font-face in src/styles/fonts.css. `
    + "A family the site does not ship is a family the browser substitutes, and the "
    + "substitute decides the shape of every stitched letter.",
  );
});

test("the charting face covers Armenian, Latin and digits", () => {
  const family = firstFamily(exportedString(RASTERIZE, "STITCH_FONT_STACK"));
  // Ա U+0531 and Ֆ U+0556 are the ends of the alphabet the shop stitches.
  for (const [name, cp] of [["Ա", 0x531], ["Ֆ", 0x556], ["A", 0x41], ["z", 0x7a], ["2", 0x32]]) {
    assert.ok(
      covers(family, cp),
      `"${family}" has no self-hosted face covering ${name} (U+${cp.toString(16).toUpperCase()}). `
      + "Without it the browser substitutes a system font for that character and the chart "
      + "stops being reproducible between devices.",
    );
  }
});

test("Fraunces is not what charts a stitch", () => {
  // Not a style opinion: at 13x15 cells the display cut's hairlines never
  // reach the sampler's threshold, so "A" lost its crossbar and its left
  // leg. If someone puts it back at the front of the stack, say why here.
  const family = firstFamily(exportedString(RASTERIZE, "STITCH_FONT_STACK"));
  assert.notEqual(
    family, "Fraunces",
    "Fraunces charts an unreadable A at 13x15 cells and has no Armenian coverage at all.",
  );
});

test("every self-hosted face has a file behind it", () => {
  const missing = ALL
    .filter((f) => f.src.startsWith("/fonts/"))
    .filter((f) => !existsSync(root(`public${f.src}`)))
    .map((f) => `${f.family} -> ${f.src}`);
  assert.deepEqual(missing, [], `@font-face rules pointing at files that are not in public/fonts:\n${missing.join("\n")}`);
});

test("the display and body tokens can reach Armenian", () => {
  // The page's own text, not the charts: the hy translations, the product
  // names, and the alphabet marquee on the home page all render through
  // these two tokens.
  const INDEX = readFileSync(root("src/styles/index.css"), "utf8");
  for (const token of ["--font-display", "--font-body"]) {
    const stack = INDEX.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1];
    assert.ok(stack, `${token} is not defined in src/styles/index.css`);
    const named = stack.split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
    assert.ok(
      named.some((family) => covers(family, 0x531)),
      `${token} names no family with a self-hosted Armenian face: ${stack.trim()}. `
      + "Armenian text then falls back to whatever the visitor's device happens to have.",
    );
  }
});

test("the CSS comments do not contain a nested close-comment", () => {
  // A `*/` inside a comment ends it early, and the parser then eats the
  // rule that follows with no error anywhere. That is exactly how the
  // Armenian serif face went missing here once: the stylesheet parsed,
  // the site looked fine in English, and every Armenian letter quietly
  // came from the system fallback again.
  const stripped = FONTS_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(
    !stripped.includes("*/"),
    "src/styles/fonts.css has an unbalanced */ — a comment closes early and the CSS after it is being dropped.",
  );
});
