// ============================================================
// CATALOG — full product catalog with status flags + routing slugs
// ============================================================
//
// CMS-managed products (edited in the Content Studio at /studio) are compiled
// from content/products/*.json into cmsProductsData.generated.js by
// scripts/gen-products.mjs (a prebuild step) and merged into CATALOG at the
// bottom of this file. The storefront therefore reads ONE shape and stays fully
// static — no runtime database. The live, configurable products (the blanket +
// bib) stay hardcoded here for now.
//
import { CMS_PRODUCTS } from "./cmsProductsData.generated.js";
import { CMS_CATEGORIES } from "./cmsCategoriesData.generated.js";
//
// ============================================================
// Drives the shop mega-menu and the entire /shop/* route hierarchy:
//   /shop                                 → ShopIndexView (4 category cards)
//   /shop/<categorySlug>                  → CategoryView
//   /shop/<categorySlug>/<productSlug>    → ProductView
//
// Each entry's `status` is either:
//   - "live"        : fully buyable; the customer can configure
//                     and pay for it today
//   - "placeholder" : renders a ProductPlaceholderView with the
//                     "image goes here / text goes here" template
//                     and a "Notify me" hook into WaitlistModal
//
// `slug` is the URL fragment and is LOAD-BEARING:
//   - It's saved in inbound shared links + search engine indexes
//   - It must remain stable once a product has been on a public URL
//   - Lowercase, hyphen-separated, ASCII only (no Armenian glyphs)
//
// To add a new product:
//   1. Pick a category (existing or new)
//   2. Give it a `key` (cart-id-shape unchanged from before),
//      a `slug` (URL fragment), `name`, `status`, `tagline`
//   3. For status: "live" — also add the matching entry in
//      PRODUCT (blanket) or CUSTOM_PRODUCTS (bib) AND in
//      netlify/functions/_lib/trusted-products.mjs
//   4. For status: "placeholder" — just the catalog entry is
//      enough. The placeholder page renders automatically.
//
// Most items are currently `placeholder` pending Lusik's photos
// and pricing. DO NOT promote one to `live` without:
//   1. Real photos (uploaded to /img/, removed from
//      CONFIG.ROTATED_GALLERY_INDEXES if it had been there)
//   2. A real `priceFrom`
//   3. A real `description`
//   4. For configurable products: the matching PRODUCT or
//      CUSTOM_PRODUCTS data + trusted-products.mjs entry
// ============================================================

// The CATALOG skeleton is CMS-managed too (Content Studio /studio →
// "Categories"): content/categories/*.json → cmsCategoriesData.generated.js
// (an ordered array; gen-categories.mjs validates and sorts it). Rebuilt
// here as the slug-keyed object the rest of the site reads. Products are
// merged in below from the products generator. Category slugs are
// LOAD-BEARING — URLs, product files, and the sitemap reference them.
export const CATALOG = Object.fromEntries(
  CMS_CATEGORIES.map((category) => [
    category.slug,
    { ...category, products: /** @type {any[]} */ ([]) },
  ]),
);

// ============================================================
// CMS MERGE — fold Content-Studio products into CATALOG
// ============================================================
// content/products/*.json → cmsProductsData.generated.js (built by
// scripts/gen-products.mjs, which validates every field and rejects bad data,
// so a broken CMS file fails the build instead of shipping). Drafts are already
// excluded by the generator. A CMS product overrides a hardcoded entry with the
// same slug, otherwise it's appended to the category.
//
// IMPORTANT: priceFrom / stripePriceId on CMS products are DISPLAY-ONLY. The
// trusted checkout price stays server-side in
// netlify/functions/_lib/trusted-products.mjs — nothing here can change what a
// customer is charged.
for (const [categorySlug, products] of Object.entries(CMS_PRODUCTS)) {
  const category = CATALOG[categorySlug];
  if (!category) {
    // Fails the build (this module is imported during next:build) rather than
    // silently dropping a product the editor thinks they published.
    throw new Error(
      `[catalog] CMS product references unknown category "${categorySlug}". ` +
      `Known categories: ${Object.keys(CATALOG).join(", ")}`,
    );
  }
  for (const product of products) {
    const existing = category.products.findIndex((p) => p.slug === product.slug);
    if (existing >= 0) category.products[existing] = product;
    else category.products.push(product);
  }
}

// ============================================================
// CATALOG LOOKUP HELPERS
// ============================================================
// Used by the router in App.jsx (to resolve /shop/<cat>/<slug>
// into a category + product pair) and by ShopMegaMenu / footer
// nav (to render category labels without re-iterating the
// CATALOG object). Centralized here so the slug format only
// has to be agreed on in one place.
// ============================================================

/** Returns an array of [categorySlug, category] pairs. */
export function listCategories() {
  return Object.entries(CATALOG).map(([_, category]) => category);
}

/** Resolve a category by its URL slug, or null if not found. */
export function getCategoryBySlug(slug) {
  if (!slug) return null;
  for (const [_, category] of Object.entries(CATALOG)) {
    if (category.slug === slug) return category;
  }
  return null;
}

/** Resolve a product by category slug + product slug, or null. */
export function getProductBySlugs(categorySlug, productSlug) {
  const category = getCategoryBySlug(categorySlug);
  if (!category) return null;
  const product = category.products.find((p) => p.slug === productSlug);
  if (!product) return null;
  return { category, product };
}

/** Build the canonical pathname for a product. */
export function productPath(category, product) {
  return `/shop/${category.slug}/${product.slug}`;
}

/** Build the canonical pathname for a category. */
export function categoryPath(category) {
  return `/shop/${category.slug}`;
}
