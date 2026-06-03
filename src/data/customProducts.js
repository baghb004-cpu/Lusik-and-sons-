// ============================================================
// CUSTOM_PRODUCTS — configurable items added via addCustomToCart
// ============================================================
// Every product here is added to the bag through the same
// `addCustomToCart(payload)` path (src/state/SiteProvider.jsx →
// buildCustomCartItem), which stamps a unique cart id, carries the
// `productKey` straight through to Stripe, and threads the chosen
// options into the line-item description + order metadata.
//
// Each key MUST equal a TRUSTED_PRODUCTS key (server price source of
// truth) at the same price — the `pricing-drift.test.mjs` guard fails
// loudly otherwise, so the customer can never see one price and be
// charged another.
//
// Entries:
//   bib                              — the live machine name bib ($22)
//   blanket-full-alphabet            — hand-knit full-alphabet crib blanket
//   bib-days-of-week                 — 7 hand cross-stitched day bibs
//   bib-anushig-pair                 — Mama's + Papa's matched pair
//   bib-bari-akhorzhak-set[-with-cap]— bib + burp cloth (+ optional cap)
//   bib-hy-em[-with-cap]             — "I am Armenian" flag bib (+ optional cap)
//
// The two `*-with-cap` keys are SKU/price records for the cap variant;
// they're never routed as standalone catalog products. The base entry's
// `buy.cap.withKey` points at them, and the configurator emits that key
// when the customer ticks "add the cap."
//
// MIRRORED ORIGIN: index.html (~line 1391), pre-Next migration.
// ============================================================

// ============================================================
// SHARED BIB COLOR SYSTEM
// ============================================================
// Extracted so every bib — the live machine name bib AND the hand
// cross-stitched heritage sets — picks thread color through the exact
// same mechanic and palette. One source of truth keeps the experience
// identical across products and keeps BibColorPicker in sync everywhere.
export const BIB_THREAD_COLORS = [
  { dmc: "311", name: "Medium Navy Blue",   hex: "#2B4C73", category: "blue"   },
  { dmc: "775", name: "Baby Blue",          hex: "#B5CEDE", category: "blue"   },
  { dmc: "604", name: "Light Pink",         hex: "#F4A6C4", category: "pink"   },
  { dmc: "718", name: "Magenta Pink",       hex: "#C92E7E", category: "pink"   },
  { dmc: "905", name: "Bright Green",       hex: "#67923A", category: "green"  },
  { dmc: "550", name: "Very Dark Violet",   hex: "#5C2D6E", category: "purple" },
  { dmc: "815", name: "Wine Red",           hex: "#8B2C2C", category: "red"    },
  { dmc: "844", name: "Charcoal",           hex: "#3C3934", category: "neutral"},
];

export const BIB_COLOR_PRESETS = [
  { key: "lusik_boys",   label: "Boys",   letter: "311", description: "Semi-dark blue — Lusik's classic boys choice." },
  { key: "lusik_girls",  label: "Girls",  letter: "718", description: "Magenta pink. A coral variant is also available — email to request." },
  { key: "lusik_unisex", label: "Unisex", letter: "905", description: "Bright green. Cheerful and gender-neutral." },
  { key: "lusik_purple", label: "Purple", letter: "550", description: "Dark violet. Quiet and elegant." },
  {
    key: "lusik_armenian_flag",
    label: "Armenian Flag",
    letter: "498",                        // fallback single color
    // Per-letter colors cycle red → blue → orange in stitch order. These
    // refs aren't in the 8-color bib palette, so BibColorPicker falls back
    // to the blanket palette (PRODUCT.threadColors) to resolve them.
    letterColors: ["498", "798", "740"],  // Red, Blue, Orange
    description: "Letters in red, blue, and orange — the colors of the Armenian flag.",
  },
];

export const BIB_DEFAULT_PRESET_KEY = "lusik_boys";

// Body colorways offered on the Full Alphabet Crib Blanket. Mirrors the
// solid colorways in the catalog gallery; the satin backing is matched to
// whichever the customer picks.
export const CRIB_BLANKET_BODY_COLORS = [
  { key: "blue",       label: "Blue",       hex: "#93B7D5" },
  { key: "pink",       label: "Pink",       hex: "#E8B5C7" },
  { key: "lavender",   label: "Lavender",   hex: "#BBA8D6" },
  { key: "mint",       label: "Mint",       hex: "#B5D9BC" },
  { key: "yellow",     label: "Yellow",     hex: "#E8D89B" },
  { key: "dusty_rose", label: "Dusty rose", hex: "#D8AFA3" },
];

export const CUSTOM_PRODUCTS = {
  bib: {
    key: "bib",
    name: "Baby Bib",
    name_hy: "Մանկական կրծկալ",
    tagline: "Your child's name on the cloth they wear every morning — embroidered by Lusik, in Armenian or English.",
    tagline_hy: "Ձեր երեխայի անունը այն կտորի վրա, որ նա կրում է ամեն առավոտ՝ ասեղնագործված Լուսիկի կողմից, հայերեն կամ անգլերեն։",
    price: 22,                    // single price — machine-only
    customMode: "name",           // machine mode accepts a short typed name
    description: "A soft white bib with your child's name embroidered across it — in Armenian script or English, the way it will be said for the rest of their life. Lusik does this one by machine, the way a bib needs to be done: 150 wash cycles a year, formula, blueberry yogurt, the entire bowl of oatmeal a one-year-old just flipped — the name has to survive all of it without lifting from the cloth. Up to six letters fit comfortably on the bib's small surface. One size, fits most babies. Made to order from her home in Southern California.",
    sizes: [
      "One size · fits most babies · white only",
    ],
    maxNameLength: 6,
    threadColors: BIB_THREAD_COLORS,
    colorPresets: BIB_COLOR_PRESETS,
    defaultPresetKey: BIB_DEFAULT_PRESET_KEY,
  },

  // ── The Full Alphabet Crib Blanket ──────────────────────────────────
  "blanket-full-alphabet": {
    key: "blanket-full-alphabet",
    name: "The Full Alphabet Crib Blanket",
    price: 245,
    image: "/img/full-alphabet/cover.jpg",
    buy: {
      kind: "cribBlanket",
      bodyColors: CRIB_BLANKET_BODY_COLORS,
      defaultBodyKey: "blue",
      allowName: true,   // optional name set into a free square, no upcharge
      nameMax: 12,
      sizeLabel: "One size · approx. 30 × 36 in",
    },
  },

  // ── The Armenian Days-of-the-Week Bib Set (7 bibs) ──────────────────
  "bib-days-of-week": {
    key: "bib-days-of-week",
    name: "The Armenian Days-of-the-Week Bib Set",
    price: 129,
    image: "/img/days-bib/cover.jpg",
    buy: {
      kind: "bibSet",
      colorPicker: true,
      threadColors: BIB_THREAD_COLORS,
      colorPresets: BIB_COLOR_PRESETS,
      defaultPresetKey: BIB_DEFAULT_PRESET_KEY,
      sizeLabel: "Set of seven · one size",
      cap: null,
    },
  },

  // ── The Mama & Papa's Anushig Bib Set (pair) ────────────────────────
  "bib-anushig-pair": {
    key: "bib-anushig-pair",
    name: "The Mama & Papa's Anushig Bib Set",
    price: 45,
    image: "/img/anushig-bib/cover.jpg",
    buy: {
      kind: "bibSet",
      colorPicker: true,
      threadColors: BIB_THREAD_COLORS,
      colorPresets: BIB_COLOR_PRESETS,
      defaultPresetKey: BIB_DEFAULT_PRESET_KEY,
      sizeLabel: "Set of two · one size · same colorway on both",
      cap: null,
    },
  },

  // ── The Bari Akhorzhak Bib & Burp Cloth Set (+ optional cap) ────────
  "bib-bari-akhorzhak-set": {
    key: "bib-bari-akhorzhak-set",
    name: "The Bari Akhorzhak Bib & Burp Cloth Set",
    price: 48,
    image: "/img/bari-akhorzhak-set/cover.jpg",
    buy: {
      kind: "bibSet",
      colorPicker: true,
      threadColors: BIB_THREAD_COLORS,
      colorPresets: BIB_COLOR_PRESETS,
      defaultPresetKey: BIB_DEFAULT_PRESET_KEY,
      sizeLabel: "Bib + burp cloth · one size",
      cap: {
        withKey: "bib-bari-akhorzhak-set-with-cap",
        priceWithCap: 65,
        upcharge: 17,
        nameInput: true,    // cap carries the baby's name or initial
        nameMax: 12,
      },
    },
  },
  // SKU/price record for the Bari cap variant (not routed standalone).
  "bib-bari-akhorzhak-set-with-cap": {
    key: "bib-bari-akhorzhak-set-with-cap",
    name: "The Bari Akhorzhak Bib & Burp Cloth Set",
    price: 65,
    variantOf: "bib-bari-akhorzhak-set",
  },

  // ── The Hye Em Yes Bib (+ optional cap) ─────────────────────────────
  // No thread-color choice: the three flag colors ARE the design.
  "bib-hy-em": {
    key: "bib-hy-em",
    name: "The Hye Em Yes Bib",
    price: 34,
    image: "/img/hye-em-bib/cover.jpg",
    buy: {
      kind: "bibSet",
      colorPicker: false,
      sizeLabel: "One size · fits most babies 0–24 months",
      cap: {
        withKey: "bib-hy-em-with-cap",
        priceWithCap: 52,
        upcharge: 18,
        nameInput: false,   // tricolor cap, no name
      },
    },
  },
  // SKU/price record for the Hye Em cap variant (not routed standalone).
  "bib-hy-em-with-cap": {
    key: "bib-hy-em-with-cap",
    name: "The Hye Em Yes Bib",
    price: 52,
    variantOf: "bib-hy-em",
  },
};
