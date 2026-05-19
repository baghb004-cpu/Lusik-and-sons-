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
        // Catalog key kept stable across the pricing flip so the
        // cart-id / Stripe trusted-products map don't get broken
        // when the product goes live. The "bernat" suffix is a
        // legacy artifact -- the customer-facing copy below no
        // longer mentions any yarn brand.
        key: "blanket-cotton-bernat",
        slug: "cotton-yarn-blanket",
        name: "Cotton Yarn Blanket",
        status: "placeholder",         // ⚠️ TODO_LUSIK: need final pricing before flipping to "live"
        priceFrom: null,               // ⚠️ TODO_LUSIK
        tagline: "A breathable cotton crib blanket, stitched by hand.",
        // Voice echoes the homepage body copy ("From her home in
        // Cypress, California, Lusik cross-stitches...") and the
        // H1 ("Made to last") so the cotton blanket reads as
        // another piece in the same Lusik & Sons line rather than
        // a separate product with its own pitch.
        description: "Lusik cross-stitches each cotton crib blanket by hand from her home in Cypress, California. Lighter and more breathable than the acrylic alphabet blanket — meant for warmer months and warmer climates. Every piece is finished with a satin backing matched to the body color. Made to order, made to last.",
        // Cover image — used by the category-grid card as a static
        // thumbnail. Center-cropped to 4:5 at 1200×1500.
        coverImage: "/img/cotton-yarn/cover.jpg",
        // Full gallery — 61 photos, ordered by curatorial arc.
        // The /img/cotton-yarn/NN.jpg files are flat-numbered;
        // the colorways array below indexes into this list.
        images: Array.from({ length: 61 }, (_, i) =>
          `/img/cotton-yarn/${String(i + 1).padStart(2, "0")}.jpg`,
        ),
        // Color picker — every entry is a button under the gallery
        // thumbnail strip. Clicking it filters the gallery to just
        // the photos identified as that color, and jumps to the
        // first photo of that color. Clicking the active swatch
        // again deselects (returns to all photos).
        //
        // Only ACTUAL COLORWAYS appear here. The previous "All",
        // "The family", and "In the studio" entries were removed
        // because the customer isn't buying "the family" — they're
        // buying one specific color. Those photos still live in
        // the gallery (browseable via thumbnails) but no longer
        // get a dedicated swatch button.
        //
        // Indices are 0-based into `images` above.
        colorways: [
          { label: "Blue",            indices: [5, 6, 7, 8, 9, 10, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 56], swatch: { color: "#93B7D5" } },
          { label: "Pink",            indices: [11, 12, 13, 14, 32, 47, 48, 49],                                swatch: { color: "#E8B5C7" } },
          { label: "Lavender",        indices: [15, 16, 17, 18, 30, 53, 54, 55],                                swatch: { color: "#BBA8D6" } },
          { label: "Mint",            indices: [19, 20, 21, 31, 45, 46],                                        swatch: { color: "#B5D9BC" } },
          { label: "Yellow",          indices: [22, 44],                                                        swatch: { color: "#E8D89B" } },
          { label: "Dusty rose",      indices: [23, 33, 50, 51, 52],                                            swatch: { color: "#D8AFA3" } },
          { label: "Pink + espresso", indices: [24, 25],                                                        swatch: { dual: ["#E8B5C7", "#3A2418"] } },
          { label: "Two-color name",  indices: [26, 27, 28, 29],                                                swatch: { dual: ["#BBA8D6", "#E8B5C7"] } },
        ],
        // Details panel content for the right column. Surfaces
        // materials / size / care up front so the customer doesn't
        // have to ask. TODO_LUSIK markers flag values that still
        // need her confirmation before flipping the product live.
        details: [
          { label: "Materials", value: "100% cotton yarn body, cotton crochet edging, satin backing." },
          { label: "Size",      value: "Approx. 30 × 36 in (76 × 91 cm). ⚠️ TODO_LUSIK: confirm." },
          { label: "Backing",   value: "Every blanket is finished with a satin backing, matched to the body color (white, lavender, pink, blue, or mint). Not optional — included on every piece." },
          // Care field carries both Lusik & Sons' recommendation
          // AND the yarn manufacturer's literal label so the
          // customer has full information. The two technically
          // conflict (the yarn says "do not dry clean", we say
          // "dry clean") because the finished piece -- with
          // crochet edging and satin backing -- is more delicate
          // than the raw yarn alone. The "we can't guarantee
          // against machine-wash wear" line below puts the
          // responsibility on the customer's chosen method.
          { label: "Care",      value: "Professional dry cleaning recommended to preserve the hand cross-stitch, satin backing, and crochet edging — the dry cleaner gives consistent gentle treatment that a washing machine can't. If you'd rather launder at home, the cotton yarn label reads: machine wash in cool water, do not bleach, do not iron, tumble dry on low / delicate. We can't guarantee against wear from washing-machine cycles." },
          { label: "Made",      value: "By Lusik herself, in Cypress, California. Made to order — 5–10 business days." },
        ],
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
