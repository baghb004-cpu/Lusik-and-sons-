// ============================================================
// TRUSTED_PRODUCTS — server-side source of truth for pricing
// ============================================================
// The browser sends `productKey` strings for each line item; this
// map is the ONLY place prices are trusted. Anything not in this
// map is rejected. Anything in this map ignores client-sent prices.
//
// Keys MUST match the productKey shape produced by mapLegacyId()
// in the browser (src/lib/cartId.ts, used by CheckoutView's
// pre-flight). Keep this list in sync with PRODUCT.layouts
// (src/data/product.js) and CUSTOM_PRODUCTS (src/data/customProducts.js).
//
// When you add a blanket layout or a new bib variant:
//   1. Add an entry here with name, priceCents, productKey suffix.
//   2. Update mapLegacyId in src/lib/cartId.ts if the cart-id shape
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
  // STAGED PLACEHOLDER PRODUCTS — uncomment + price when going live
  // ============================================================
  // Every catalog entry with status: "placeholder" gets a matching
  // commented-out trusted-products row below. Flipping any one of
  // these to live is a 30-second job:
  //
  //   1. Uncomment the row here, set priceCents (= catalog
  //      priceFrom × 100).
  //   2. In src/data/catalog.js, change `status: "placeholder"`
  //      → `status: "live"` and set `priceFrom: <dollars>`.
  //   3. In src/components/shop/ProductView.jsx, add a branch
  //      that renders a live product surface for the catalog key
  //      (or extend ProductPlaceholderView to handle live mode
  //      with an Add-to-Cart button).
  //
  // The single-key-per-product pattern below assumes flat pricing
  // across all colorways/variants of a given product. If pricing
  // ends up diverging (e.g. the bib+cap bundle costs more than
  // the bib alone), split that key into multiple rows and have
  // the browser cart-id encode the variant suffix. The full-
  // alphabet blanket has a worked example of that split in the
  // comment block below.
  // ============================================================

  // ----- BLANKETS -----

  // The Full Alphabet Crib Blanket — hand-knit by Lusik (body) with a
  // crochet edge and satin backing. All 36 Armenian letters. Single
  // price across all body colorways; the chosen body color + optional
  // name ride in the line-item description + order metadata, not the
  // price. catalog key: blanket-full-alphabet
  "blanket-full-alphabet": {
    name:        "The Full Alphabet Crib Blanket",
    variant:     "Full Armenian alphabet · hand-knit, satin-backed",
    priceCents:  24500,
  },

  // ----- BIBS -----

  // The Armenian Days-of-the-Week Bib Set (7 bibs, Mon–Sun in Armenian).
  // Hand cross-stitched. Single price across all thread colors; the
  // chosen color rides in metadata. catalog key: bib-days-of-week
  "bib-days-of-week": {
    name:        "The Armenian Days-of-the-Week Bib Set",
    variant:     "Seven hand cross-stitched bibs, Armenian day names",
    priceCents:  12900,
  },

  // The Mama & Papa's Anushig Bib Set (pair: Mama's + Papa's "sweetheart").
  // Hand cross-stitched. Sold as a pair only. catalog key: bib-anushig-pair
  "bib-anushig-pair": {
    name:        "The Mama & Papa's Anushig Bib Set",
    variant:     "Pair of hand cross-stitched bibs — Mama's + Papa's",
    priceCents:  4500,
  },

  // The Bari Akhorzhak Bib & Burp Cloth Set. Hand cross-stitched. Two
  // variants -- the set alone, or the set + matching cap (cap carries the
  // baby's name/initial). The browser sets the matching productKey
  // directly on the cart item. catalog key: bib-bari-akhorzhak-set
  "bib-bari-akhorzhak-set": {
    name:        "The Bari Akhorzhak Bib & Burp Cloth Set",
    variant:     "Bib + burp cloth",
    priceCents:  4800,
  },
  "bib-bari-akhorzhak-set-with-cap": {
    name:        "The Bari Akhorzhak Bib & Burp Cloth Set",
    variant:     "Bib + burp cloth + matching cap (with name)",
    priceCents:  6500,
  },

  // The Hye Em Yes Bib ("I am Armenian"). Hand cross-stitched in the three
  // colors of the Armenian flag — the flag is the design, so there is no
  // color choice; the only option is bib alone vs. bib + matching cap.
  // catalog key: bib-hy-em
  "bib-hy-em": {
    name:        "The Hye Em Yes Bib",
    variant:     "Bib alone",
    priceCents:  3400,
  },
  "bib-hy-em-with-cap": {
    name:        "The Hye Em Yes Bib",
    variant:     "Bib + matching baby cap",
    priceCents:  5200,
  },

  // ----- TOWELS -----

  // Embroidered Hand Towel
  // catalog key: towel-hand
  // "towel-hand": {
  //   name:        "Embroidered Hand Towel",
  //   variant:     "Hand-embroidered Armenian motif",
  //   priceCents:  3500,   // ⚠️ TODO_LUSIK: confirm
  // },

  // Armenian Baptism Towel
  // catalog key: towel-baptism
  // "towel-baptism": {
  //   name:        "Armenian Baptism Towel",
  //   variant:     "Hand-embroidered ceremonial towel",
  //   priceCents:  7500,   // ⚠️ TODO_LUSIK: confirm
  // },

  // ----- BABY (small items) -----

  // Baby Swaddle
  // catalog key: baby-swaddle
  // "baby-swaddle": {
  //   name:        "Baby Swaddle",
  //   variant:     "Baby swaddle",
  //   priceCents:  4500,   // ⚠️ TODO_LUSIK: confirm
  // },

  // Baby Bathrobe
  // catalog key: baby-bathrobe
  // "baby-bathrobe": {
  //   name:        "Baby Bathrobe",
  //   variant:     "Hooded terry bathrobe",
  //   priceCents:  5500,   // ⚠️ TODO_LUSIK: confirm
  // },

};
