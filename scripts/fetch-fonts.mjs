#!/usr/bin/env node
// ============================================================
// fetch-fonts.mjs — one-time download of the offline font set
// ============================================================
// Pulls the four Noto woff2 subsets the builder's offline i18n
// references (public/fonts/README.md) from Google Fonts, ONCE,
// so every later build/export runs fully offline with identical
// text rendering on every device. All four are SIL OFL — free to
// bundle and redistribute.
//
//   node scripts/fetch-fonts.mjs
//
// Already-present files are kept (delete one to re-fetch it).
// ============================================================

import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "public", "fonts");

// css2 endpoints per target file; the subset comment in Google's CSS
// tells us which unicode-range block to take.
const WANTED = [
  { file: "latin.woff2", family: "Noto+Sans", subset: "latin" },
  { file: "cyrillic.woff2", family: "Noto+Sans", subset: "cyrillic" },
  { file: "armenian.woff2", family: "Noto+Sans+Armenian", subset: "armenian" },
  { file: "arabic.woff2", family: "Noto+Sans+Arabic", subset: "arabic" },
];

// A modern-browser UA makes Google serve woff2 (default UA gets ttf).
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

async function fontUrlFor(family, subset) {
  const css = await (
    await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@400&display=swap`, {
      headers: { "User-Agent": UA },
    })
  ).text();
  // blocks look like: /* armenian */ @font-face { ... url(...woff2) ... }
  const re = new RegExp(`/\\* ${subset} \\*/[^}]*url\\((https://fonts\\.gstatic\\.com/[^)]+\\.woff2)\\)`, "m");
  const m = css.match(re) ?? css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/m);
  if (!m) throw new Error(`no woff2 URL found for ${family} (${subset})`);
  return m[1];
}

await mkdir(OUT, { recursive: true });
let fetched = 0;
for (const { file, family, subset } of WANTED) {
  const dest = join(OUT, file);
  if (existsSync(dest)) {
    console.log(`✓ ${file} already present — skipping`);
    continue;
  }
  try {
    const url = await fontUrlFor(family, subset);
    const bytes = Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA } })).arrayBuffer());
    if (bytes.length < 1000 || bytes.subarray(0, 4).toString("ascii") !== "wOF2") {
      throw new Error("download didn't look like a woff2 file");
    }
    await writeFile(dest, bytes);
    console.log(`↓ ${file}  (${Math.round(bytes.length / 1024)} KB)  ← ${family} ${subset}`);
    fetched++;
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`);
    console.error("  (no internet right now? run this again later — everything works meanwhile via OS-font fallbacks)");
    process.exitCode = 1;
  }
}
console.log(fetched ? `\nDone — ${fetched} font(s) saved to public/fonts/. They ship with every export from now on.` : "\nNothing to do.");
