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
//   - status "live" is intentionally REJECTED for now: a CMS-entered price must
//     NOT become a trusted checkout price. The server-side price source of
//     truth stays netlify/functions/_lib/trusted-products.mjs. Promoting a CMS
//     product to "live" is a later, deliberate phase (see TODO below).
//
// TODO (Stripe reconciliation phase): when CMS products become buyable, add a
// `stripePriceId` reconciliation step that verifies each live CMS product has a
// matching trusted-products.mjs entry BEFORE allowing status "live". Until then
// `priceFrom` / `stripePriceId` here are DISPLAY-ONLY metadata.
// ============================================================

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_DIR = join(__dirname, "..", "content", "products");
const OUT_FILE = join(__dirname, "..", "src", "data", "cmsProductsData.generated.js");

// Statuses the storefront understands today. "live" is deliberately excluded
// (see SAFETY note above) — a CMS file can't make a product buyable yet.
const ALLOWED_STATUS = new Set(["draft", "placeholder"]);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(file, msg) {
  throw new Error(`[gen-products] ${file}: ${msg}`);
}

function validate(file, p) {
  const str = (k) => {
    if (typeof p[k] !== "string" || p[k].trim() === "") fail(file, `"${k}" is required and must be a non-empty string`);
  };
  str("category");
  str("key");
  str("slug");
  str("name");
  str("tagline");
  str("description");

  if (!SLUG_RE.test(p.slug)) fail(file, `"slug" must be lowercase kebab-case (got "${p.slug}")`);

  if (typeof p.status !== "string" || !ALLOWED_STATUS.has(p.status)) {
    if (p.status === "live") {
      fail(file, `status "live" is not supported via the CMS yet — a CMS price must not become a checkout price. Keep it "placeholder" until the trusted-products.mjs reconciliation phase lands.`);
    }
    fail(file, `"status" must be one of: ${[...ALLOWED_STATUS].join(", ")} (got "${p.status}")`);
  }

  // priceFrom: null (price coming soon) OR a positive number. DISPLAY-ONLY.
  if (!(p.priceFrom === null || (typeof p.priceFrom === "number" && Number.isFinite(p.priceFrom) && p.priceFrom > 0))) {
    fail(file, `"priceFrom" must be null or a positive number (got ${JSON.stringify(p.priceFrom)})`);
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
    description: p.description,
  };
  if (p.coverImage !== undefined) out.coverImage = p.coverImage;
  if (p.images !== undefined) out.images = p.images;
  if (p.stripePriceId !== undefined) out.stripePriceId = p.stripePriceId;
  // displayOrder is intentionally NOT copied onto the product — it's sort-only
  // metadata (see the sort in main()), so a migrated product stays shape-clean.
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
    validate(file, data);

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

main();
