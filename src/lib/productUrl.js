// ============================================================
// productUrl — cart item → canonical product-page path
// ============================================================
// Tapping an item in the bag jumps back to its full product page
// (/shop/<category>/<product>) so the customer can re-read the
// description and see the gallery. The mapping is DERIVED from
// CATALOG (the same data that builds the shop routes), so a new
// product is tappable the moment it's in the catalog — plus two
// translations where checkout productKeys differ from catalog keys:
//
//   - "bib"              → catalog key "bib-single" (the name bib)
//   - "<key>-with-cap"   → the base product's page (the cap is a
//                          variant, not its own page)
//   - "blanket-<layout>" → the main Armenian Alphabet Blanket page
//                          (cart keys encode the stitch layout;
//                          catalog key is "blanket-alphabet")
//
// Anything unrecognized falls back to /shop — a tap can land on the
// shop index, never a dead click or a 404.
// ============================================================

import { CATALOG } from "../data/catalog.js";

// catalog key -> "/shop/<categorySlug>/<productSlug>", built once.
let _paths = null;
function catalogPaths() {
  if (_paths) return _paths;
  const map = {};
  const categories = Array.isArray(CATALOG) ? CATALOG : Object.values(CATALOG || {});
  for (const cat of categories) {
    const catSlug = cat?.slug;
    for (const p of cat?.products || []) {
      if (catSlug && p?.key && p?.slug) map[p.key] = `/shop/${catSlug}/${p.slug}`;
    }
  }
  _paths = map;
  return map;
}

/**
 * Canonical product-page path for a cart item, or "/shop" when the
 * item can't be resolved. Accepts the same item shape the cart holds
 * ({ productKey?, id? }).
 */
export function productPathForCartItem(item) {
  const paths = catalogPaths();
  // Prefer the explicit productKey (heritage bibs, full-alphabet
  // blanket); fall back to the id prefix for legacy blanket/bib rows
  // whose key is derived at checkout time (mapLegacyId's job — its
  // only outputs are "bib" and "blanket-<layout>", both handled below).
  let key = typeof item?.productKey === "string" && item.productKey
    ? item.productKey
    : null;
  if (!key && typeof item?.id === "string") {
    if (item.id.startsWith("bib-") || item.id === "bib") key = "bib";
    else if (item.id.startsWith("blanket-")) key = "blanket-alphabet";
  }
  if (!key) return "/shop";

  key = key.replace(/-with-cap$/, "");
  if (key === "bib") key = "bib-single";

  if (paths[key]) return paths[key];
  // Any unrecognized blanket-* key is a stitch-layout variant of the
  // main Armenian Alphabet Blanket.
  if (key.startsWith("blanket-") && paths["blanket-alphabet"]) {
    return paths["blanket-alphabet"];
  }
  return "/shop";
}
