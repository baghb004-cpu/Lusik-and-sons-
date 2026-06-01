// ============================================================
// CUSTOM_PRODUCTS — machine-embroidered customizable items
// ============================================================
// Currently just one entry: the personalized baby bib. The
// blanket lives separately in `product.js` because its config
// (alphabets, layouts, dual-color presets) is too different
// to share a shape with the bib.
//
// `customMode: "name"` tells the picker UI to render the short
// typed-name flow. (The previous "hand-stitched" bib mode was
// removed — Lusik dropped the hand-cross-stitched bib option;
// the bib is now machine-embroidery-only.)
//
// MIRRORED FROM index.html (~line 1391).
// ============================================================

export const CUSTOM_PRODUCTS = {
  bib: {
    key: "bib",
    name: "Baby Bib",
    name_hy: "Մանկական կրծկալ",
    tagline: "Your child's name on the cloth they wear every morning — embroidered by Lusik, in Armenian or English.",
    tagline_hy: "Ձեր երեխայի անունը այն կտորի վրա, որ նա կրում է ամեն առավոտ՝ ասեղնագործված Լուսիկի կողմից, հայերեն կամ անգլերեն։",
    price: 22,                    // single price — machine-only
    // handStitchedPrice removed — Lusik decided to drop the hand-cross-stitched
    // bib option. The bib is now machine-embroidery-only with a typed name.
    customMode: "name",           // machine mode accepts a short typed name
    description: "A soft white bib with your child's name embroidered across it — in Armenian script or English, the way it will be said for the rest of their life. Lusik does this one by machine, the way a bib needs to be done: 150 wash cycles a year, formula, blueberry yogurt, the entire bowl of oatmeal a one-year-old just flipped — the name has to survive all of it without lifting from the cloth. Up to six letters fit comfortably on the bib's small surface. One size, fits most babies. Made to order from her home in Southern California.",
    sizes: [
      "One size · fits most babies · white only",
    ],
    // Hard limit on machine-embroidered name length. Enforced in the picker UI.
    maxNameLength: 6,

    // ============================================================
    // BIB THREAD COLOR PALETTE — curated subset for machine-embroidered bibs.
    // ============================================================
    // Smaller than the blanket palette because a machine embroidery setup
    // typically only has 6-8 thread spools loaded at a time. These eight
    // colors are the most commonly-requested for baby bibs and are what
    // Lusik would realistically keep stocked. References (`dmc`) match the
    // blanket palette so order metadata stays consistent across products.
    threadColors: [
      { dmc: "311", name: "Medium Navy Blue",   hex: "#2B4C73", category: "blue"   },
      { dmc: "775", name: "Baby Blue",          hex: "#B5CEDE", category: "blue"   },
      { dmc: "604", name: "Light Pink",         hex: "#F4A6C4", category: "pink"   },
      { dmc: "718", name: "Magenta Pink",       hex: "#C92E7E", category: "pink"   },
      { dmc: "905", name: "Bright Green",       hex: "#67923A", category: "green"  },
      { dmc: "550", name: "Very Dark Violet",   hex: "#5C2D6E", category: "purple" },
      { dmc: "815", name: "Wine Red",           hex: "#8B2C2C", category: "red"    },
      { dmc: "844", name: "Charcoal",           hex: "#3C3934", category: "neutral"},
    ],

    // ============================================================
    // BIB COLOR PRESETS — same conceptual palette as the blanket so
    // customers see consistent options across products. Single-color presets
    // pick one thread color for the whole name; Armenian Flag uses
    // `letterColors` to alternate red/blue/orange across letters.
    // ============================================================
    colorPresets: [
      {
        key: "lusik_boys",
        label: "Boys",
        letter: "311",  // Medium Navy Blue
        description: "Semi-dark blue — Lusik's classic boys choice."
      },
      {
        key: "lusik_girls",
        label: "Girls",
        letter: "718",  // Magenta Pink
        description: "Magenta pink. A coral variant is also available — email to request."
      },
      {
        key: "lusik_unisex",
        label: "Unisex",
        letter: "905",  // Bright Green
        description: "Bright green. Cheerful and gender-neutral."
      },
      {
        key: "lusik_purple",
        label: "Purple",
        letter: "550",  // Very Dark Violet
        description: "Dark violet. Quiet and elegant."
      },
      {
        key: "lusik_armenian_flag",
        label: "Armenian Flag",
        letter: "498",  // fallback single color
        // Per-letter colors — letters cycle through red, blue, orange in
        // stitch order. For "ANNA" (4 letters): A=red, N=blue, N=orange, A=red.
        // The thread refs below need to exist in the bib's threadColors palette
        // OR be added — we add them as a fallback list since the bib palette
        // doesn't include all three flag colors.
        letterColors: ["498", "798", "740"],   // Red, Blue, Orange
        description: "Letters in red, blue, and orange — the colors of the Armenian flag."
      },
    ],

    // Default preset key. Boys preset matches the blanket's default for
    // consistency across products.
    defaultPresetKey: "lusik_boys",
  },
};
