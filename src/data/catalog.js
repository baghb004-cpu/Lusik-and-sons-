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

export const CATALOG = {
  blankets: {
    slug: "blankets",
    label: "Blankets",
    label_hy: "Ծածկոցներ",
    // Rewritten to recap WHAT'S inside the category (two distinct
    // pieces, not one) and lead with the heritage angle. Same
    // 2026-voice as the homepage rewrite -- maker + heirloom +
    // search-friendly hooks ("Armenian alphabet", "heritage",
    // "christening", "passed down").
    description: "Lusik's signature work — the pieces she sits with on her kitchen table for thirty hours at a time. Two crib blankets, both Armenian by heritage: a personalized one cross-stitched with the first three letters a child will ever learn, and a full-alphabet one that carries every letter from Ա to Ք. Each one stitched by hand, picked up and checked by Lusik before it ships. Made to order. Made to last for the next baby in the family, and the one after that.",
    description_hy: "Լուսիկի ստորագիր գործը՝ այն կտորները, որոնց հետ նա ժամերով նստում է իր խոհանոցի սեղանի մոտ։ Երկու օրորոցի ծածկոց, երկուսն էլ՝ հայկական ժառանգությամբ. մեկը՝ անհատականացված, խաչաձև կարկատված այն առաջին երեք տառերով, որ երեխան սովորում է, և մյուսը՝ ամբողջ այբուբենով՝ Ա-ից մինչև Ք։ Յուրաքանչյուրը ձեռքով կարկատված, Լուսիկի կողմից ստուգված նախքան առաքելը։ Պատվերով։ Պատրաստված տևելու՝ ընտանիքի հաջորդ մանկան և նրանից հետո եկողի համար։",
    eyebrow: "Lusik's signature work",
    eyebrow_hy: "Լուսիկի ստորագիր գործը",
    // CMS-managed (Content Studio /studio): both blankets live in
    // content/products/{armenian-alphabet-blanket,full-alphabet-crib-blanket}
    // .json and are merged into this category at build (see the CMS merge
    // below). They are LIVE products: the generator's trusted-products
    // reconciliation guarantees each one's displayed priceFrom matches the
    // server-side checkout price to the cent. displayOrder keeps the
    // signature alphabet blanket first.
    products: /** @type {any[]} */ ([]),
  },
  bibs: {
    slug: "bibs",
    label: "Bibs",
    label_hy: "Թքակալներ",
    // Recap-the-category copy. Three products, three different gift
    // moments. Names them all in one line so customers landing here
    // from a search ("Armenian baby bib", "personalized name bib",
    // "Hye em yes bib") see all three options.
    description: "The small pieces that hold the biggest hours of a baby's day — first food, first words, first photographs. Five bibs in Lusik's hand: a custom-name bib for the everyday, a seven-day Armenian set for the baby shower, the Հայ եմ ես (\"I am Armenian\") heritage bib stitched in the colors of the flag, a Mama-and-Papa pair that says sweetheart twice in Armenian, and the Bari Akhorzhak meal-time set that carries a grandmother's table blessing on the bib and answers it on the matching burp cloth.",
    eyebrow: "Small pieces, biggest hours",
    eyebrow_hy: "Փոքր կտորներ, ամենաերկար ժամեր",
    // CMS-managed (Content Studio /studio): all five bib products live in
    // content/products/*.json and are merged into this category at build —
    // baby-bib, days-of-the-week-bib-set, hy-em-armenian-bib,
    // anushig-bib-set, bari-akhorzhak-bib-burp-cloth-set. All LIVE, all
    // price-reconciled against trusted-products.mjs by the generator.
    // displayOrder preserves the original order (name bib first).
    products: /** @type {any[]} */ ([]),
  },
  towels: {
    slug: "towels",
    label: "Towels",
    label_hy: "Սրբիչներ",
    description: "The Armenian textiles a family pulls out for the days that count. A hand towel for the guest bath, a powder room, the table set for a holiday meal. And the white baptism towel — the one canon asks the godparents to bring, the one the priest lifts the child onto, the one the family keeps folded in a chest for the rest of their lives.",
    description_hy: "Հայկական գործվածքները, որ ընտանիքը հանում է կարևոր օրերի համար։ Ձեռքի սրբիչ՝ հյուրասենյակի լոգարանի, սանհանգույցի կամ տոնական սեղանի համար։ Եվ սպիտակ մկրտության սրբիչը՝ այն, որ կանոնը խնդրում է կնքահայրերին բերել, այն, որի վրա քահանան բարձրացնում է մանկանը, այն, որ ընտանիքը պահում է ծալած՝ ողջ կյանքի ընթացքում։",
    eyebrow: "For the days that count",
    eyebrow_hy: "Կարևոր օրերի համար",
    // CMS-managed (Content Studio /studio): both towels live in
    // content/products/{embroidered-hand-towel,armenian-baptism-towel}.json
    // and are merged into this category at build (see the CMS merge below).
    products: /** @type {any[]} */ ([]),
  },
  baby: {
    slug: "baby",
    label: "For Baby",
    label_hy: "Մանուկի համար",
    // Reframed -- "Swaddles, bathrobes, and other early-infant items"
    // is descriptive but doesn't sell. The new line names the
    // emotional buying context (the first weeks home from the
    // hospital, the bath ritual that becomes the day's anchor).
    description: "Soft pieces for the days before the rest of the world meets a new baby. A swaddle for the going-home photograph from the hospital. A hooded bathrobe for the bath ritual that becomes the day's anchor. Small fabric objects that are around for the first weeks of a life, and that — if they're made the right way, by the right hands — get folded into a drawer to wait for the next one.",
    description_hy: "Փափուկ կտորներ՝ այն օրերի համար, երբ աշխարհը դեռ չի ծանոթացել նոր մանկան հետ։ Փաթաթան՝ հիվանդանոցից տուն վերադարձի լուսանկարի համար, գլխարկով լոգարոբ՝ լողանալու ծեսի համար, որ դառնում է օրվա խարիսխը։ Մանր գործվածքե իրեր, որ ուղեկցում են կյանքի առաջին շաբաթներին և, եթե ճիշտ ձեռքերով են պատրաստված, ծալվում ու պահվում են հաջորդի համար։",
    eyebrow: "From the very first day",
    eyebrow_hy: "Առաջին իսկ օրվանից",
    // CMS-managed (Content Studio /studio): both baby items live in
    // content/products/{baby-swaddle,baby-bathrobe}.json and are merged into
    // this category at build (see the CMS merge below). displayOrder in those
    // files keeps swaddle before bathrobe.
    products: /** @type {any[]} */ ([]),
  },
};

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
