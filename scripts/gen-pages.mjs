// ============================================================
// gen-pages.mjs — build-time CMS codegen for editable page content
// ============================================================
// Reads content/pages/*.json (edited via the Content Studio at /studio →
// "Site Content") and writes src/data/pagesData.generated.js as CMS_PAGES.
// src/components/HomeView.jsx reads CMS_PAGES for the sections that have been
// moved to the CMS (currently the FAQ). The storefront stays fully static.
//
// Mirrors gen-products.mjs: a prebuild step (via gen:data), and it THROWS —
// failing the build — on invalid data, so bad CMS content can never silently
// ship.
//
// Scope today: ENGLISH FAQ only. The Shipping section is interactive UI (carrier
// links + tracking form), not pure prose, so it stays in the component. The
// bilingual FAQ/shipping copy in src/i18n/translations.js is unrelated (and was
// already dead — nothing reads it via t()); cleaning it up is a separate chore.
// ============================================================

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = join(__dirname, "..", "content", "pages");
const OUT_FILE = join(__dirname, "..", "src", "data", "pagesData.generated.js");

function fail(file, msg) {
  throw new Error(`[gen-pages] ${file}: ${msg}`);
}
function reqStr(file, obj, k, where) {
  if (typeof obj[k] !== "string" || obj[k].trim() === "") fail(file, `${where}"${k}" is required and must be a non-empty string`);
}

// Per-page-type validators (keyed by filename without .json).
const VALIDATORS = {
  faq(file, data) {
    reqStr(file, data, "eyebrow");
    reqStr(file, data, "title");
    if (!Array.isArray(data.items) || data.items.length === 0) fail(file, `"items" must be a non-empty array`);
    data.items.forEach((it, i) => {
      if (!it || typeof it !== "object") fail(file, `items[${i}] must be an object`);
      reqStr(file, it, "q", `items[${i}] `);
      reqStr(file, it, "a", `items[${i}] `);
    });
  },

  // The sitewide announcement strip. Off by default; when enabled the
  // message is required (an empty banner would render a blank bar).
  announcement(file, data) {
    if (typeof data.enabled !== "boolean") fail(file, `"enabled" must be true or false`);
    if (data.enabled) reqStr(file, data, "message");
    for (const k of ["message", "link", "linkLabel"]) {
      if (data[k] !== undefined && typeof data[k] !== "string") fail(file, `"${k}" must be a string`);
    }
    if (data.link && !data.link.startsWith("/") && !data.link.startsWith("https://")) {
      fail(file, `"link" must be a site path ("/shop/...") or an https:// URL`);
    }
    if (data.link && data.enabled) reqStr(file, data, "linkLabel");
  },

  // Home editorial: which product the "We think you'll love" card
  // features. Resolved against the REAL catalog at build time, so a typo
  // or a product that was unpublished fails the build, never the page.
  async home(file, data) {
    if (!data.featured || typeof data.featured !== "object") fail(file, `"featured" object is required`);
    reqStr(file, data.featured, "category", `featured `);
    reqStr(file, data.featured, "slug", `featured `);
    const { CATALOG } = await import("../src/data/catalog.js");
    const category = CATALOG[data.featured.category];
    const product = category?.products.find((p) => p.slug === data.featured.slug);
    if (!product) {
      fail(file, `featured product "${data.featured.category}/${data.featured.slug}" does not exist in the catalog`);
    }
    if (product.status !== "live") {
      fail(file, `featured product "${data.featured.slug}" is not live (status: ${product.status}) — the For You card must feature something buyable`);
    }
  },

  // The Our Story page prose. The component auto-accents the literal
  // letter triads ("Ա, Բ, Գ" / "A, B, C") wherever they appear.
  story(file, data) {
    reqStr(file, data, "eyebrow");
    reqStr(file, data, "heading");
    if (!Array.isArray(data.paragraphs) || data.paragraphs.length === 0) fail(file, `"paragraphs" must be a non-empty array`);
    data.paragraphs.forEach((p, i) => {
      if (typeof p !== "string" || p.trim() === "") fail(file, `paragraphs[${i}] must be a non-empty string`);
    });
    reqStr(file, data, "signature");
    reqStr(file, data, "signatureSub");
  },

  // Customer quotes. The section shows the FIRST THREE — reorder the
  // list in the Studio to choose which three appear.
  testimonials(file, data) {
    reqStr(file, data, "eyebrow");
    reqStr(file, data, "titlePre");
    reqStr(file, data, "titleEm");
    if (!Array.isArray(data.quotes) || data.quotes.length < 3) fail(file, `"quotes" must be an array of at least 3 (the section displays three)`);
    data.quotes.forEach((q, i) => {
      if (!q || typeof q !== "object") fail(file, `quotes[${i}] must be an object`);
      reqStr(file, q, "quote", `quotes[${i}] `);
      reqStr(file, q, "name", `quotes[${i}] `);
      if (q.place !== undefined && typeof q.place !== "string") fail(file, `quotes[${i}] "place" must be a string`);
    });
  },
};

async function main() {
  const files = existsSync(PAGES_DIR)
    ? readdirSync(PAGES_DIR).filter((f) => f.endsWith(".json")).sort()
    : [];

  const pages = {};
  for (const file of files) {
    const name = file.replace(/\.json$/, "");
    let data;
    try {
      data = JSON.parse(readFileSync(join(PAGES_DIR, file), "utf8"));
    } catch (e) {
      fail(file, `invalid JSON — ${e.message}`);
    }
    const validate = VALIDATORS[name];
    if (!validate) fail(file, `no validator for page "${name}" — add one in scripts/gen-pages.mjs before shipping this content`);
    await validate(file, data);
    pages[name] = data;
  }

  const banner =
    "// ============================================================\n" +
    "// AUTO-GENERATED by scripts/gen-pages.mjs — DO NOT EDIT.\n" +
    "// Source of truth: content/pages/*.json (Content Studio / Decap).\n" +
    "// Regenerate: `npm run gen:pages` (runs automatically prebuild).\n" +
    "// ============================================================\n";

  writeFileSync(OUT_FILE, `${banner}export const CMS_PAGES = ${JSON.stringify(pages, null, 2)};\n`);
  console.log(`gen-pages: wrote ${Object.keys(pages).length} page(s) → src/data/pagesData.generated.js`);
}

await main();
