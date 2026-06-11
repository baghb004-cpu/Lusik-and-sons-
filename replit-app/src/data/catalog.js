// ============================================================
// Catalog — the JS mirror of ios/LusikSons/Data/Catalog.swift +
// ShopCategories.swift (which mirror the website's catalog).
// ============================================================
// DISPLAY ONLY: the server reprices every checkout from its own
// trusted map. `checkoutKey` raw values MUST equal the keys in
// netlify/functions/_lib/trusted-products.mjs — checkout rejects
// anything else. Never invent a key on the client.
//
// Photos load from production (`/img/...` folders, numbered
// 01.jpg…NN.jpg with a cover.jpg) — no asset duplication.

const BASE = "https://lusikandsons.com";

const photos = (folder, count) => [
  `${BASE}/img/${folder}/cover.jpg`,
  ...Array.from({ length: count }, (_, i) => `${BASE}/img/${folder}/${String(i + 1).padStart(2, "0")}.jpg`),
];

// presentation: "immersiveSheet" (photo-led, Chunk 2's pill sheet) or
// "classicConfigurator" (configurator-led, the classic scroll page) —
// parity with the website's CONFIG.SHEET.EXCLUDE_KEYS rule.
export const PRODUCTS = [
  {
    id: "blanket-alphabet",
    checkoutKey: "blanket-double_diag_br",
    capVariantKey: null,
    name: "The Armenian Alphabet Blanket",
    tagline: "Ա Բ Գ, hand cross-stitched corner to corner.",
    priceDollars: 65,
    capPriceDollars: null,
    categorySlug: "blankets",
    productSlug: "armenian-alphabet-blanket",
    presentation: "classicConfigurator",
    photoURLs: [`${BASE}/img/abc-blanket/cover.jpg`],
  },
  {
    id: "blanket-full-alphabet",
    checkoutKey: "blanket-full-alphabet",
    capVariantKey: null,
    name: "The Full Alphabet Crib Blanket",
    tagline: "Every letter of the Armenian alphabet — all thirty-six, hand-knit by Lusik.",
    priceDollars: 245,
    capPriceDollars: null,
    categorySlug: "blankets",
    productSlug: "full-alphabet-crib-blanket",
    presentation: "immersiveSheet",
    photoURLs: photos("full-alphabet", 61),
  },
  {
    id: "bib-single",
    checkoutKey: "bib",
    capVariantKey: null,
    name: "The Custom Name Bib",
    tagline: "Your child's name, embroidered by Lusik — in Armenian or English.",
    priceDollars: 22,
    capPriceDollars: null,
    categorySlug: "bibs",
    productSlug: "baby-bib",
    presentation: "classicConfigurator",
    photoURLs: Array.from({ length: 4 }, (_, i) => `${BASE}/img/bib-examples/${String(i + 1).padStart(2, "0")}.jpg`),
  },
  {
    id: "bib-days-of-week",
    checkoutKey: "bib-days-of-week",
    capVariantKey: null,
    name: "The Armenian Days-of-the-Week Bib Set",
    tagline: "Seven bibs for seven days — Monday through Sunday in Armenian.",
    priceDollars: 60,
    capPriceDollars: null,
    categorySlug: "bibs",
    productSlug: "days-of-the-week-bib-set",
    presentation: "immersiveSheet",
    photoURLs: photos("days-bib", 22),
  },
  {
    id: "bib-hy-em",
    checkoutKey: "bib-hy-em",
    capVariantKey: "bib-hy-em-with-cap",
    name: "The Hye Em Yes Bib",
    tagline: "“I am Armenian” — the flag is the design.",
    priceDollars: 20,
    capPriceDollars: 38,
    categorySlug: "bibs",
    productSlug: "hy-em-armenian-bib",
    presentation: "immersiveSheet",
    photoURLs: photos("hye-em-bib", 3),
  },
  {
    id: "bib-anushig-pair",
    checkoutKey: "bib-anushig-pair",
    capVariantKey: null,
    name: "The Mama & Papa's Anushig Bib Set",
    tagline: "One says Mama's sweetheart, the other Papa's — stitched as a pair.",
    priceDollars: 40,
    capPriceDollars: null,
    categorySlug: "bibs",
    productSlug: "anushig-bib-set",
    presentation: "immersiveSheet",
    photoURLs: photos("anushig-bib", 9),
  },
  {
    id: "bib-bari-akhorzhak-set",
    checkoutKey: "bib-bari-akhorzhak-set",
    capVariantKey: "bib-bari-akhorzhak-set-with-cap",
    name: "The Bari Akhorzhak Bib & Burp Cloth Set",
    tagline: "Two Armenian meal blessings, one matched set.",
    priceDollars: 40,
    capPriceDollars: 58,
    categorySlug: "bibs",
    productSlug: "bari-akhorzhak-bib-burp-cloth-set",
    presentation: "immersiveSheet",
    photoURLs: photos("bari-akhorzhak-set", 26),
  },
];

export const CATEGORIES = [
  {
    slug: "blankets",
    label: "Blankets",
    blurb: "The hand cross-stitched alphabet, and the full thirty-six letters hand-knit.",
    comingSoon: false,
  },
  {
    slug: "bibs",
    label: "Bibs",
    blurb: "Names, blessings, and the days of the week — stitched to be kept.",
    comingSoon: false,
  },
  {
    slug: "towels",
    label: "Towels",
    blurb: "Embroidered hand towels and baptism towels.",
    comingSoon: true,
  },
  {
    slug: "baby",
    label: "For Baby",
    blurb: "Swaddles and bathrobes, on Lusik's worktable.",
    comingSoon: true,
  },
];

export const productsInCategory = (slug) => PRODUCTS.filter((p) => p.categorySlug === slug);
export const findProduct = (categorySlug, productSlug) =>
  PRODUCTS.find((p) => p.categorySlug === categorySlug && p.productSlug === productSlug) ?? null;
export const categoryCover = (category) => productsInCategory(category.slug)[0]?.photoURLs[0] ?? null;
