// ============================================================
// TRUSTED_PRODUCTS — server-side source of truth for pricing
// ============================================================
// The browser sends `productKey` strings for each line item; this
// map is the ONLY place prices are trusted. Anything not in this
// map is rejected. Anything in this map ignores client-sent prices.
//
// Keys MUST match the productKey shape produced by mapLegacyId()
// in the browser (CheckoutView's pre-flight). Keep this list in
// sync with PRODUCT.layouts (~line 800) and CUSTOM_PRODUCTS
// (~line 870) in index.html.
//
// When you add a blanket layout or a new bib variant:
//   1. Add an entry here with name, priceCents, productKey suffix.
//   2. Update mapLegacyId in index.html if the cart-id shape
//      changes.
//   3. Redeploy. No DB change.
// ============================================================

export const TRUSTED_PRODUCTS = {
  // The Armenian Alphabet Blanket — keyed by layout, because the
  // cart distinguishes by layout (different layout = different
  // line item, never a quantity stack).
  "blanket-double_diag_br": {
    name:        "Armenian Alphabet Blanket",
    variant:     "Two parallel diagonals",
    priceCents:  6500,
  },

  // Machine-embroidered baby bib with a typed name.
  "bib": {
    name:        "Baby Bib",
    variant:     "Machine-embroidered name",
    priceCents:  2200,
  },

};
