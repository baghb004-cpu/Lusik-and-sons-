// ============================================================
// CATALOG — full product catalog with status flags
// ============================================================
// Drives the shop mega-menu and the catalog page. Each entry's
// `status` is either:
//   - "live"        : fully buyable; the customer can configure
//                     and pay for it today
//   - "placeholder" : renders a coming-soon card with a "Notify
//                     me" link to the waitlist function
//
// Most items are currently `placeholder` pending Lusik's photos
// and pricing. DO NOT promote one to `live` without:
//   1. Real photos (uploaded to /img/, removed from
//      CONFIG.ROTATED_GALLERY_INDEXES if it had been there)
//   2. A real `priceFrom`
//   3. A real `description` (the placeholder copy mentions
//      TODO_LUSIK items that need her sign-off)
//   4. For configurable products: the matching entry in
//      PRODUCT (blanket) or CUSTOM_PRODUCTS (bib)
//
// The category structure (blankets / bibs / towels / baby)
// drives the mega-menu's column layout. Adding a category
// requires also updating the header nav component.
//
// MIRRORED FROM index.html (~line 1499).
// ============================================================

export const CATALOG = {
  blankets: {
    label: "Blankets",
    description: "Hand cross-stitched baby blankets",
    products: [
      {
        key: "blanket-alphabet",
        name: "The Armenian Alphabet Blanket",
        status: "live",                // points to PRODUCT — fully buyable
        priceFrom: 89,
        tagline: "Lusik's signature blanket. Three letters, stitched diagonally.",
        // No placeholder image needed — uses PRODUCT.gallery
      },
      {
        key: "blanket-cotton-bernat",
        name: "Cotton Yarn Blanket",
        status: "placeholder",         // ⚠️ TODO_LUSIK: need photos, specs, price
        priceFrom: null,               // ⚠️ TODO_LUSIK
        tagline: "Made entirely from Bernat cotton yarn.",
        description: "Lusik's blanket made from 100% Bernat-brand cotton yarn. Softer hand than the acrylic blanket, breathable, ideal for warmer climates and warmer months. ⚠️ TODO_LUSIK: confirm dimensions, color options, and price before enabling.",
        // ⚠️ TODO_LUSIK: photograph this blanket and add gallery images
      },
    ],
  },
  bibs: {
    label: "Bibs",
    description: "Machine-embroidered personalized bibs",
    products: [
      {
        key: "bib-single",
        name: "Baby Bib",
        status: "live",                // points to CUSTOM_PRODUCTS.bib
        priceFrom: 22,
        tagline: "Machine-embroidered with a personalized name.",
      },
      {
        key: "bib-days-of-week",
        name: "Days of the Week Bib Set",
        status: "placeholder",         // ⚠️ TODO_LUSIK
        priceFrom: null,               // ⚠️ TODO_LUSIK: 7-bib set, likely $80-120 range
        tagline: "Seven bibs, one for each day of the week.",
        description: "A set of seven bibs, each embroidered with a different day of the week (Monday through Sunday). ⚠️ TODO_LUSIK: confirm whether the days are spelled in Armenian (Երկուշաբթի, Երեքշաբթի, etc.) or English, photograph the full set together, set price.",
      },
      {
        key: "bib-hy-em",
        name: "Hy Em — I Am Armenian Bib",
        status: "placeholder",         // ⚠️ TODO_LUSIK
        priceFrom: null,               // ⚠️ TODO_LUSIK
        tagline: "\"Հայ եմ\" — I am Armenian, with Mount Ararat.",
        description: "Bib embroidered with \"Հայ եմ\" (Hy em — 'I am Armenian') and the outline of Mount Ararat in the background. A statement of heritage from the smallest age. ⚠️ TODO_LUSIK: photograph, confirm exact text, set price.",
      },
    ],
  },
  towels: {
    label: "Towels",
    description: "Embroidered hand and ceremonial towels",
    products: [
      {
        key: "towel-hand",
        name: "Embroidered Hand Towel",
        status: "placeholder",         // ⚠️ TODO_LUSIK
        priceFrom: null,               // ⚠️ TODO_LUSIK
        tagline: "Hand-towel size with Armenian embroidery.",
        description: "Hand-sized cotton towel (~16\" × 28\") with Lusik's hand or machine embroidery. ⚠️ TODO_LUSIK: confirm which designs/letters/text she offers, set price and customization options.",
      },
      {
        key: "towel-baptism",
        name: "Armenian Baptism Towel",
        status: "placeholder",         // ⚠️ TODO_LUSIK
        priceFrom: null,               // ⚠️ TODO_LUSIK
        tagline: "Large white ceremonial towel for Armenian Apostolic baptisms.",
        // Real research notes below — kept in code for when we build the product page
        description: "Traditional ceremonial towel for the Armenian Apostolic baptism rite. Per Armenian Church canon, godparents bring one large new white towel — single-use, kept afterward as a keepsake. Typical size in industry: 30\"×60\" plush, or 90×50cm / 140×90cm (made-in-Armenia sizes). Embroidered with the child's name in Armenian, baptism date, and an Armenian-style cross (not crucifix style — the Armenian Church specifies Armenian crosses only). ⚠️ TODO_LUSIK: confirm which sizes she offers, which cross styles she stitches, whether she uses gold/silver/champagne thread for the embroidery (industry standard), set price.",
      },
    ],
  },
  baby: {
    label: "For Baby",
    description: "Swaddles, bathrobes, and other early-infant items",
    products: [
      {
        key: "baby-swaddle",
        name: "Baby Swaddle",
        status: "placeholder",         // ⚠️ TODO_LUSIK
        priceFrom: null,               // ⚠️ TODO_LUSIK
        tagline: "Soft swaddle blanket for newborns.",
        description: "⚠️ TODO_LUSIK: confirm material (muslin? cotton? bamboo?), dimensions (typical swaddles are 47\"×47\"), embroidery options (initial? name? alphabet?), photograph and set price.",
      },
      {
        key: "baby-bathrobe",
        name: "Baby Bathrobe",
        status: "placeholder",         // ⚠️ TODO_LUSIK
        priceFrom: null,               // ⚠️ TODO_LUSIK
        tagline: "Hooded bathrobe for after the bath.",
        description: "⚠️ TODO_LUSIK: confirm sizes (0-6mo, 6-12mo, 1-2yr typically), material (terry cloth? cotton waffle weave?), embroidery options, photograph and set price.",
      },
    ],
  },
};
