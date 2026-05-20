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
  // the browser cart-id encode the variant suffix. The cotton
  // blanket has a worked example of that split in the comment
  // block below.
  // ============================================================

  // ----- BLANKETS -----

  // The Cotton Alphabet Crib Blanket
  // catalog key: blanket-cotton-bernat  (legacy "bernat" suffix
  //   preserved so an in-flight cart isn't broken; customer never
  //   sees this string)
  //
  // If pricing diverges per colorway (e.g. the two-color
  // personalized variant costs more), split this single key
  // into per-color rows:
  //   "blanket-cotton-blue":     { ..., priceCents: 6500 },
  //   "blanket-cotton-pink":     { ..., priceCents: 6500 },
  //   ...
  //   "blanket-cotton-twocolor": { ..., priceCents: 7500 },
  // and update CheckoutView's mapLegacyId() to emit the
  // colorway suffix on the cart-id.
  // "blanket-cotton-cotton": {
  //   name:        "The Cotton Alphabet Crib Blanket",
  //   variant:     "Full Armenian alphabet, cotton yarn, satin-backed",
  //   priceCents:  6500,   // ⚠️ TODO_LUSIK: confirm
  // },

  // ----- BIBS -----

  // The Armenian Days-of-the-Week Bib Set (7 bibs, Mon–Sun in Armenian)
  // catalog key: bib-days-of-week
  // Single price across all colorways (Pink, Lavender, Blue, Gold,
  // Boy pastel, Rainbow, Green) per current product strategy. Split
  // if Lusik wants premium pricing for the multi-color Rainbow set.
  // "bib-days-of-week": {
  //   name:        "The Armenian Days-of-the-Week Bib Set",
  //   variant:     "Seven bibs, Armenian day names",
  //   priceCents:  9900,   // ⚠️ TODO_LUSIK: confirm (placeholder)
  // },

  // The Mama & Papa's Anushig Bib Set (pair: Mama's + Papa's "sweetheart")
  // catalog key: bib-anushig-pair
  // Sold as a pair only (no half-set variant). Single price across
  // all four colorways (pink / blue / mint / yellow).
  // "bib-anushig-pair": {
  //   name:        "The Mama & Papa's Anushig Bib Set",
  //   variant:     "Pair of matched bibs — Mama's + Papa's",
  //   priceCents:  4500,   // ⚠️ TODO_LUSIK: confirm
  // },

  // The Bari Akhorzhak Bib & Burp Cloth Set
  // catalog key: bib-bari-akhorzhak-set
  // Two variants -- the set alone, or the set + matching cap. Customer
  // picks at checkout; CheckoutView's mapLegacyId() emits the matching
  // key. Single price across all colorways within each variant.
  // "bib-bari-akhorzhak-set":          {
  //   name:        "The Bari Akhorzhak Bib & Burp Cloth Set",
  //   variant:     "Bib + burp cloth",
  //   priceCents:  4800,   // ⚠️ TODO_LUSIK: confirm
  // },
  // "bib-bari-akhorzhak-set-with-cap": {
  //   name:        "The Bari Akhorzhak Bib & Burp Cloth Set",
  //   variant:     "Bib + burp cloth + matching cap",
  //   priceCents:  6500,   // ⚠️ TODO_LUSIK: confirm
  // },

  // The Hye Em Yes Bib ("I am Armenian")
  // catalog key: bib-hy-em
  // Sold either as a bib alone OR a bib + matching cap. Two cart-id
  // variants below -- the customer picks one at checkout, the
  // CheckoutView's mapLegacyId() emits the matching key. Per-
  // colorway pricing is intentionally NOT split (flag tricolor and
  // pink+purple should cost the same).
  // "bib-hy-em":         {
  //   name:        "The Hye Em Yes Bib",
  //   variant:     "Bib alone",
  //   priceCents:  2800,   // ⚠️ TODO_LUSIK: confirm
  // },
  // "bib-hy-em-with-cap": {
  //   name:        "The Hye Em Yes Bib",
  //   variant:     "Bib + matching baby cap",
  //   priceCents:  4500,   // ⚠️ TODO_LUSIK: confirm (placeholder)
  // },

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
  //   variant:     "Cotton swaddle",
  //   priceCents:  4500,   // ⚠️ TODO_LUSIK: confirm
  // },

  // Baby Bathrobe
  // catalog key: baby-bathrobe
  // "baby-bathrobe": {
  //   name:        "Baby Bathrobe",
  //   variant:     "Cotton terry bathrobe",
  //   priceCents:  5500,   // ⚠️ TODO_LUSIK: confirm
  // },

};
