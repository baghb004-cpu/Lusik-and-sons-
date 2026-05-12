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

  // Hand-stitched bib has been removed from the catalog but the
  // mapping still accepts it so any in-flight carts complete.
  // Delete this entry once you're confident no carts predate the
  // removal.
  "bib-hand": {
    name:        "Baby Bib (hand-stitched)",
    variant:     "Hand-stitched single letter",
    priceCents:  3500,
  },

  // Custom-image embroidered towel — currently inactive on the
  // site but the mapping is here so reactivating the towel is a
  // one-line index.html change.
  "towel": {
    name:        "Custom Embroidered Towel",
    variant:     "Your design",
    priceCents:  3500,
  },
};
