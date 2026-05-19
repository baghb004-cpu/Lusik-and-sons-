// ============================================================
// CATALOG — full product catalog with status flags + routing slugs
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

export const CATALOG = {
  blankets: {
    slug: "blankets",
    label: "Blankets",
    description: "Hand cross-stitched baby blankets",
    eyebrow: "Lusik's signature work",
    products: [
      {
        key: "blanket-alphabet",
        slug: "armenian-alphabet-blanket",
        name: "The Armenian Alphabet Blanket",
        status: "live",                // points to PRODUCT — fully buyable
        priceFrom: 89,
        tagline: "Lusik's signature blanket. Three letters, stitched diagonally.",
        // No placeholder image needed — uses PRODUCT.gallery
      },
      {
        key: "blanket-cotton-bernat",
        slug: "cotton-yarn-blanket",
        name: "Cotton Yarn Blanket",
        status: "placeholder",         // ⚠️ TODO_LUSIK: need final pricing before flipping to "live"
        priceFrom: null,               // ⚠️ TODO_LUSIK
        tagline: "Made entirely from Bernat cotton yarn.",
        description: "Lusik's blanket made from 100% Bernat-brand cotton yarn. Softer hand than the acrylic blanket, breathable, ideal for warmer climates and warmer months.",
        // Cover image — used by the category-grid card as a static
        // thumbnail. Center-cropped to 4:5 at 1200×1500.
        coverImage: "/img/cotton-yarn/cover.jpg",
        // Full slideshow gallery — 61 photos, ordered by a deliberate
        // curatorial arc:
        //   1     — hero/cover (editorial stack of 5 colorways)
        //   2–5   — multi-color shots (the family of colorways)
        //   6–11  — blues, full views
        //   12–15 — pinks, full views
        //   16–19 — lavenders, full views
        //   20–24 — mint, yellow, dusty rose
        //   25–26 — pink + espresso brown (the bold modern colorway)
        //   27–30 — two-color personalized name showcase
        //   31–37 — folded shots showing the satin lining
        //   38–54 — crochet + cell + letter detail close-ups
        //   55–57 — older / alternate angles
        //   58–61 — staged / market context
        images: Array.from({ length: 61 }, (_, i) =>
          `/img/cotton-yarn/${String(i + 1).padStart(2, "0")}.jpg`,
        ),
      },
    ],
  },
  bibs: {
    slug: "bibs",
    label: "Bibs",
    description: "Machine-embroidered personalized bibs",
    eyebrow: "Small piece, big heart",
    products: [
      {
        key: "bib-single",
        slug: "baby-bib",
        name: "Baby Bib",
        status: "live",                // points to CUSTOM_PRODUCTS.bib
        priceFrom: 22,
        tagline: "Machine-embroidered with a personalized name.",
      },
      {
        key: "bib-days-of-week",
        slug: "days-of-the-week-bib-set",
        name: "Days of the Week Bib Set",
        status: "placeholder",         // ⚠️ TODO_LUSIK
        priceFrom: null,
        tagline: "Seven bibs, one for each day of the week.",
        description: "A set of seven bibs, each embroidered with a different day of the week — Monday through Sunday.",
      },
      {
        key: "bib-hy-em",
        slug: "hy-em-armenian-bib",
        name: "Hy Em — I Am Armenian Bib",
        status: "placeholder",         // ⚠️ TODO_LUSIK
        priceFrom: null,
        tagline: "\"Հայ եմ\" — I am Armenian, with Mount Ararat.",
        description: "Bib embroidered with \"Հայ եմ\" (Hy em — \"I am Armenian\") and the outline of Mount Ararat in the background. A statement of heritage from the smallest age.",
      },
    ],
  },
  towels: {
    slug: "towels",
    label: "Towels",
    description: "Embroidered hand and ceremonial towels",
    eyebrow: "For the milestone moments",
    products: [
      {
        key: "towel-hand",
        slug: "embroidered-hand-towel",
        name: "Embroidered Hand Towel",
        status: "placeholder",
        priceFrom: null,
        tagline: "Hand-towel size with Armenian embroidery.",
        description: "Hand-sized cotton towel with Lusik's hand or machine embroidery. A small, lasting gift for a guest room, a powder bath, or a christening.",
      },
      {
        key: "towel-baptism",
        slug: "armenian-baptism-towel",
        name: "Armenian Baptism Towel",
        status: "placeholder",
        priceFrom: null,
        tagline: "Large white ceremonial towel for Armenian Apostolic baptisms.",
        description: "Traditional ceremonial towel for the Armenian Apostolic baptism rite. Per Armenian Church canon, godparents bring one large new white towel — single-use, kept afterward as a keepsake. Embroidered with the child's name in Armenian, baptism date, and an Armenian-style cross.",
      },
    ],
  },
  baby: {
    slug: "baby",
    label: "For Baby",
    description: "Swaddles, bathrobes, and other early-infant items",
    eyebrow: "From the very first day",
    products: [
      {
        key: "baby-swaddle",
        slug: "baby-swaddle",
        name: "Baby Swaddle",
        status: "placeholder",
        priceFrom: null,
        tagline: "Soft swaddle blanket for newborns.",
        description: "A soft swaddle blanket for the early weeks. Made to wrap, hold, and grow with the baby.",
      },
      {
        key: "baby-bathrobe",
        slug: "baby-bathrobe",
        name: "Baby Bathrobe",
        status: "placeholder",
        priceFrom: null,
        tagline: "Hooded bathrobe for after the bath.",
        description: "Hooded bathrobe for the after-bath ritual. Personalize with name embroidery — a keepsake gift that gets used every night for years.",
      },
    ],
  },
};

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
