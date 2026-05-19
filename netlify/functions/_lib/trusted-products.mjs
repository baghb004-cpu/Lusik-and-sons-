// ============================================================
// TRUSTED_PRODUCTS — server-side source of truth for pricing
// ============================================================
// The browser sends `productKey` strings for each line item; this
// map is the ONLY place prices are trusted. Anything not in this
// map is rejected. Anything in this map ignores client-sent prices.
//
// Keys MUST match the productKey shape produced by mapLegacyId()
// in the browser (CheckoutView's pre-flight). Keep this list in
// sync with PRODUCT.layouts and CUSTOM_PRODUCTS in index.html.
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

  // ============================================================
  // THE COTTON ALPHABET CRIB BLANKET — staged, NOT live
  // ============================================================
  // Currently `status: "placeholder"` in src/data/catalog.js
  // (catalog key "blanket-cotton-bernat" — that suffix is a
  // legacy artifact, the customer-facing name is "The Cotton
  // Alphabet Crib Blanket"). When it's flipped to "live",
  // uncomment the entry below and set priceCents to match the
  // agreed price (catalog priceFrom × 100). The cart-id shape
  // produced by the browser will be "blanket-cotton-cotton" — a
  // single product key across all colorways; the chosen color
  // is metadata in the line item, not a separate entry here.
  //
  // If pricing ends up diverging per colorway (e.g. the two-color
  // name variant costs more), split into one entry per cart-id:
  //   "blanket-cotton-blue":     { ..., priceCents: 6500 },
  //   "blanket-cotton-pink":     { ..., priceCents: 6500 },
  //   ...
  //   "blanket-cotton-twocolor": { ..., priceCents: 7500 },
  // and have the browser cart-id encode the colorway suffix.
  // ============================================================
  // "blanket-cotton-cotton": {
  //   name:        "The Cotton Alphabet Crib Blanket",
  //   variant:     "Full Armenian alphabet, cotton yarn, satin-backed",
  //   priceCents:  6500,   // ⚠️ TODO_LUSIK: confirm before uncommenting
  // },

};
