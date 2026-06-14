// ============================================================
// gen-products.mjs — build-time product CMS codegen
// ============================================================
// Reads content/products/*.json (edited via the Content Studio / Decap CMS at
// /studio) and writes src/data/cmsProductsData.generated.js as a plain
// CMS_PRODUCTS object, grouped by category slug. src/data/catalog.js imports
// that and merges it into CATALOG, so the storefront reads ONE shape and stays
// fully static/SSG — no runtime database, no extra JS for shoppers.
//
// Mirrors gen-journal-posts.mjs: runs as a prebuild step (prenext:dev /
// prenext:build / pretypecheck) so a CMS edit is reflected on the next deploy.
//
// SAFETY — this generator is the gate that makes it impossible for bad CMS data
// to silently break the build:
//   - invalid JSON, missing/empty required fields, bad slug, bad status, or a
//     bad price all THROW, which fails the prebuild and therefore the deploy.
//   - status "live" is allowed ONLY through the TRUSTED-PRODUCTS
//     RECONCILIATION below: the file must name a `trustedKey` that exists in
//     netlify/functions/_lib/trusted-products.mjs AND its displayed
//     `priceFrom` must equal that entry's priceCents exactly. A CMS edit can
//     therefore never invent a buyable product or display a price that
//     drifts from what Stripe charges — the server-side map stays the only
//     price source of truth, and this gate just proves the display matches it.
// ============================================================

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
// The server's price contract — pure data, safe to import at build time.
// Used ONLY to validate live products; nothing from here is emitted.
import { TRUSTED_PRODUCTS } from "../netlify/functions/_lib/trusted-products.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_DIR = join(__dirname, "..", "content", "products");
const OUT_FILE = join(__dirname, "..", "src", "data", "cmsProductsData.generated.js");

// Statuses the storefront understands. "live" passes ONLY with a valid
// trusted-products reconciliation (see validate below).
const ALLOWED_STATUS = new Set(["draft", "placeholder", "live"]);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(file, msg) {
  throw new Error(`[gen-products] ${file}: ${msg}`);
}

export function validateProduct(file, p) {
  const str = (k) => {
    if (typeof p[k] !== "string" || p[k].trim() === "") fail(file, `"${k}" is required and must be a non-empty string`);
  };
  str("category");
  str("key");
  str("slug");
  str("name");
  str("tagline");
  // description: the placeholder page renders it, so coming-soon products
  // must have one. Live products render their own PDP (and page metadata
  // prefers the tagline), so for them it's optional.
  if (p.status !== "live" || p.description !== undefined) str("description");

  if (!SLUG_RE.test(p.slug)) fail(file, `"slug" must be lowercase kebab-case (got "${p.slug}")`);

  if (typeof p.status !== "string" || !ALLOWED_STATUS.has(p.status)) {
    fail(file, `"status" must be one of: ${[...ALLOWED_STATUS].join(", ")} (got "${p.status}")`);
  }

  // priceFrom: null (price coming soon) OR a positive number. DISPLAY-ONLY.
  if (!(p.priceFrom === null || (typeof p.priceFrom === "number" && Number.isFinite(p.priceFrom) && p.priceFrom > 0))) {
    fail(file, `"priceFrom" must be null or a positive number (got ${JSON.stringify(p.priceFrom)})`);
  }

  // ── TRUSTED-PRODUCTS RECONCILIATION — the gate that makes "live" safe ──
  // A live product must point at the server-side price entry that vouches
  // for it, and the display price must match that entry to the cent. The
  // checkout price NEVER comes from this file either way — this only
  // guarantees the customer is shown the same number Stripe will charge.
  if (p.status === "live") {
    if (typeof p.trustedKey !== "string" || p.trustedKey.trim() === "") {
      fail(file, `status "live" requires "trustedKey" — the netlify/functions/_lib/trusted-products.mjs key that vouches for this product's price (e.g. "bib" for the name bib, "blanket-double_diag_br" for the alphabet blanket).`);
    }
    const trusted = TRUSTED_PRODUCTS[p.trustedKey];
    if (!trusted) {
      fail(file, `"trustedKey" "${p.trustedKey}" has no entry in trusted-products.mjs — a live product must be priced server-side FIRST. Known keys: ${Object.keys(TRUSTED_PRODUCTS).join(", ")}`);
    }
    if (typeof p.priceFrom !== "number") {
      fail(file, `a live product must show a price — set "priceFrom" to match trusted-products.mjs (${p.trustedKey}: ${trusted.priceCents} cents).`);
    }
    if (Math.round(p.priceFrom * 100) !== trusted.priceCents) {
      fail(file, `"priceFrom" ($${p.priceFrom}) does not match trusted-products.mjs ${p.trustedKey}.priceCents (${trusted.priceCents}) — the displayed price must equal what Stripe charges. Update BOTH together.`);
    }
  } else if (p.trustedKey !== undefined && typeof p.trustedKey !== "string") {
    fail(file, `"trustedKey", if set, must be a string`);
  }

  // Optional Armenian translations (rendered via the i18n loc() helper).
  for (const k of ["name_hy", "tagline_hy", "description_hy"]) {
    if (p[k] !== undefined && (typeof p[k] !== "string" || p[k].trim() === "")) {
      fail(file, `"${k}", if set, must be a non-empty string`);
    }
  }

  // Optional colorways — the gallery color filter (label + photo indices +
  // a swatch that is one of: solid color / dual split / gradient / neutral).
  if (p.colorways !== undefined) {
    if (!Array.isArray(p.colorways)) fail(file, `"colorways", if set, must be an array`);
    for (const cw of p.colorways) {
      if (!cw || typeof cw.label !== "string" || cw.label.trim() === "") fail(file, `every colorway needs a non-empty "label"`);
      if (!Array.isArray(cw.indices) || !cw.indices.every((i) => Number.isInteger(i) && i >= 0)) {
        fail(file, `colorway "${cw.label}": "indices" must be an array of non-negative integers`);
      }
      if (Array.isArray(p.images)) {
        const bad = cw.indices.find((i) => i >= p.images.length);
        if (bad !== undefined) fail(file, `colorway "${cw.label}" references photo index ${bad}, but "images" has only ${p.images.length} entries`);
      }
      if (!cw.swatch || typeof cw.swatch !== "object") fail(file, `colorway "${cw.label}" needs a "swatch" object`);
    }
  }

  // Optional details — the label/value rows on the product page.
  if (p.details !== undefined) {
    if (!Array.isArray(p.details)) fail(file, `"details", if set, must be an array`);
    for (const d of p.details) {
      if (!d || typeof d.label !== "string" || d.label.trim() === "" || typeof d.value !== "string" || d.value.trim() === "") {
        fail(file, `every details row needs non-empty "label" and "value" strings`);
      }
    }
  }

  // Optional fields — only type-checked when present.
  if (p.coverImage !== undefined && (typeof p.coverImage !== "string" || !p.coverImage.startsWith("/"))) {
    fail(file, `"coverImage", if set, must be an absolute path string starting with "/"`);
  }
  if (p.images !== undefined && !(Array.isArray(p.images) && p.images.every((s) => typeof s === "string"))) {
    fail(file, `"images", if set, must be an array of path strings`);
  }
  if (p.stripePriceId !== undefined && typeof p.stripePriceId !== "string") {
    fail(file, `"stripePriceId", if set, must be a string (reserved; NOT used for checkout yet)`);
  }
  if (p.displayOrder !== undefined && typeof p.displayOrder !== "number") {
    fail(file, `"displayOrder", if set, must be a number`);
  }
}

// Build the product object the storefront/catalog expects (category stripped —
// it's the grouping key, not a product field). Optional fields included only
// when present, so a migrated entry matches its old hardcoded shape.
function toProduct(p) {
  const out = {
    key: p.key,
    slug: p.slug,
    name: p.name,
    status: p.status,
    priceFrom: p.priceFrom ?? null,
    tagline: p.tagline,
  };
  if (p.description !== undefined) out.description = p.description;
  if (p.name_hy !== undefined) out.name_hy = p.name_hy;
  if (p.tagline_hy !== undefined) out.tagline_hy = p.tagline_hy;
  if (p.description_hy !== undefined) out.description_hy = p.description_hy;
  if (p.coverImage !== undefined) out.coverImage = p.coverImage;
  if (p.images !== undefined) out.images = p.images;
  if (p.colorways !== undefined) out.colorways = p.colorways;
  if (p.details !== undefined) out.details = p.details;
  if (p.stripePriceId !== undefined) out.stripePriceId = p.stripePriceId;
  // displayOrder and trustedKey are intentionally NOT copied onto the
  // product — sort-only / validation-only metadata, so a migrated product
  // stays shape-clean and nothing client-side can mistake trustedKey for
  // a checkout credential.
  return out;
}

function main() {
  const files = existsSync(PRODUCTS_DIR)
    ? readdirSync(PRODUCTS_DIR).filter((f) => f.endsWith(".json")).sort()
    : [];

  const rawByCategory = {};
  const seen = new Set(); // `${category}/${slug}` uniqueness

  for (const file of files) {
    const raw = readFileSync(join(PRODUCTS_DIR, file), "utf8");
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      fail(file, `invalid JSON — ${e.message}`);
    }
    validateProduct(file, data);

    // Drafts never reach the storefront build.
    if (data.status === "draft") continue;

    const uniq = `${data.category}/${data.slug}`;
    if (seen.has(uniq)) fail(file, `duplicate product ${uniq} (already defined in another file)`);
    seen.add(uniq);

    (rawByCategory[data.category] ||= []).push(data);
  }

  // Deterministic order within each category: by displayOrder (ascending;
  // missing = last), tie-broken by slug. Then strip to the storefront shape.
  const byCategory = {};
  for (const [category, items] of Object.entries(rawByCategory)) {
    items.sort((a, b) => {
      const ao = a.displayOrder ?? Infinity;
      const bo = b.displayOrder ?? Infinity;
      return ao - bo || a.slug.localeCompare(b.slug);
    });
    byCategory[category] = items.map(toProduct);
  }

  const banner =
    "// ============================================================\n" +
    "// AUTO-GENERATED by scripts/gen-products.mjs — DO NOT EDIT.\n" +
    "// Source of truth: content/products/*.json (Content Studio / Decap).\n" +
    "// Regenerate: `npm run gen:products` (runs automatically prebuild).\n" +
    "// Merged into CATALOG by src/data/catalog.js. Drafts are excluded.\n" +
    "// ============================================================\n";

  writeFileSync(OUT_FILE, `${banner}export const CMS_PRODUCTS = ${JSON.stringify(byCategory, null, 2)};\n`);

  const count = Object.values(byCategory).reduce((n, a) => n + a.length, 0);
  console.log(`gen-products: wrote ${count} published product(s) across ${Object.keys(byCategory).length} category(ies) → src/data/cmsProductsData.generated.js`);
}


// Run only when invoked directly (`node scripts/gen-X.mjs`) — the exported
// validator above is also imported by the builder's save gate
// (src/builder/server/validateDoc.ts), and importing must never regenerate.
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
