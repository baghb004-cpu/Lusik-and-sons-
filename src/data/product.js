// ============================================================
// PRODUCT — the live Armenian Alphabet Blanket
// ============================================================
// Drives the entire PDP: gallery, video block, threadColors palette,
// colorPresets, alphabets (Armenian / English), and the single
// currently-enabled layout (double_diag_br).
//
// MIRRORED FROM index.html (~line 1137). Photo references at the
// top now come from src/images/photos.js instead of being bare
// top-level constants in the same file.
//
// Adding a new layout: append an entry to `layouts` and set
// `enabled: true`. The picker UI auto-hides any disabled entry.
// Note: cart-ID shape `blanket-{alphabet}-{layoutKey}-...` is
// load-bearing for the server's TRUSTED_PRODUCTS map — when you
// add a layout, ALSO add `blanket-{layoutKey}` to
// netlify/functions/_lib/trusted-products.mjs and to the
// pricing-drift test pattern.
// ============================================================

import {
  PHOTO_HERO_OLEN,
  PHOTO_OLEN_2026_BLANKET,
  PHOTO_PURPLE_FLAT,
  PHOTO_ARMENIAN_FLAG,
  PHOTO_ARMENIAN_WITH_DATE,
  PHOTO_YELLOWGREEN,
  PHOTO_PURPLE_DETAIL,
  PHOTO_LUCA_HEARTS,
} from "../images/photos.js";

export const PRODUCT = {
  name: "The Armenian Alphabet Blanket",
  subtitle: "Hand cross-stitched by Lusik",
  price: 65,
  // ============================================================
  // PRODUCT VIDEO (optional)
  // ============================================================
  // A short loop of Lusik's hands cross-stitching — the single
  // most differentiating asset for the brand. When `video.src` is
  // a real URL the ProductShowcase renders a muted, looping,
  // autoplay video alongside the photo gallery; when `src` is
  // empty / null the section is hidden entirely so the page stays
  // clean until Lusik provides one.
  //
  // Recommended format: a 10-20 second mute-able MP4, H.264, 1080p,
  // <8 MB. Host on Netlify (drop in /public) or a CDN; the `poster`
  // image shows before playback starts (use the first frame).
  //
  // ⚠️ TODO_LUSIK: record + upload a hands-stitching clip and put
  // the path here. Until then this stays blank and the section
  // doesn't render.
  video: {
    src: "",                      // e.g. "/img/lusik-stitching.mp4"
    poster: "",                   // e.g. "/img/lusik-stitching-poster.jpg" — first frame, prevents flash
    caption: "Lusik's hands at work — a single Ա stitched live.",
  },
  gallery: [
    PHOTO_HERO_OLEN,           // Olen bib + Olen/2026 blanket together — the killer "real order" photo
    PHOTO_OLEN_2026_BLANKET,   // Same OLEN/2026 blanket, solo (no bib) — quieter follow-up shot
    PHOTO_PURPLE_FLAT,         // Purple ABC laid flat showing full pattern + fringe
    PHOTO_ARMENIAN_FLAG,       // Red/blue/orange Armenian Flag preset in action
    PHOTO_ARMENIAN_WITH_DATE,  // Armenian alphabet + stitched 07/05/24 date — proof of the personalization combo
    PHOTO_YELLOWGREEN,         // Yellow+green color variation
    PHOTO_PURPLE_DETAIL,       // Close-up showing cube outlines + stitch detail
    PHOTO_LUCA_HEARTS,         // "Luca" with hearts — shows custom personalization extreme
  ],
  description: "A soft acrylic baby blanket with a small woven pomegranate pattern. Lusik hand cross-stitches six letter squares — the alphabet (Ա Բ Գ in Armenian or ABC in English) stitched twice in two parallel diagonals running across the blanket. Each blanket is made to order. Lusik sources thread from various manufacturers, so slight color variation between blankets is part of what makes each one unique. For other letters or special requests, please email Lusik at hello@lusikandsons.com.",
  specs: [
    'Size: 52" × 46"',
    'Soft acrylic blanket with woven pomegranate pattern',
    'Six hand cross-stitched letter squares in two parallel diagonals',
    'Choose Armenian (ԱԲԳ) or English (ABC) alphabet',
    'Thread varies per blanket — sourced from various manufacturers',
    'Satin backing matched to the body color',
    'Fringed edges',
    'Made to order',
    'Professional dry cleaning recommended — protects the hand-stitched detail and satin backing',
  ],
  // Default color used for the cross-stitched letter on every blanket.
  // Customers don't choose; if they want something different they email.
  // Kept as an array of one to avoid touching cart/checkout code that
  // expects a colors[0] shape.
  // ============================================================
  // THREAD COLOR PALETTE
  // ============================================================
  // A curated palette of colors customers can pick for the cube outline
  // and the letter inside it. Lusik sources thread from various
  // manufacturers, so the on-screen color is an approximation — actual
  // thread color may vary slightly between blankets. This is intentional;
  // each blanket is unique.
  //
  // The `dmc` field is kept internally as a stable identifier for code
  // (presets reference colors by this key, cart metadata records it),
  // but it is NOT displayed to customers anymore. The number stays in the
  // data so future changes can be made without breaking the preset linkage.
  //
  // ⚠️  ON-WHITE READABILITY: colors that vanish on white fabric
  // (very pale yellows, pale pinks, ivories, light greys) are deliberately
  // omitted. Soft Sage and Baby Blue are kept because greens and mid-blues
  // hold up better on white than yellows or pinks of similar luminance.
  threadColors: [
    // ── DEEP REDS & WINES ──────────────────────────────
    { dmc: "498", name: "Dark Christmas Red",   hex: "#A02830", category: "red" },
    { dmc: "321", name: "Christmas Red",        hex: "#C8252C", category: "red" },
    { dmc: "815", name: "Wine Red",             hex: "#8B2C2C", category: "red", isDefault: true },
    { dmc: "150", name: "Bright Cranberry",     hex: "#A30A41", category: "red" },

    // ── PINKS ──────────────────────────────────────────
    { dmc: "3731",name: "Dark Dusty Rose",      hex: "#C9577F", category: "pink" },
    { dmc: "961", name: "Dark Dusty Rose Pink", hex: "#D85787", category: "pink" },
    { dmc: "603", name: "Cranberry Pink",       hex: "#E4658C", category: "pink" },
    { dmc: "604", name: "Light Pink",           hex: "#F4A6C4", category: "pink" },   // for "girls" preset block
    { dmc: "718", name: "Magenta Pink",         hex: "#C92E7E", category: "pink" },   // for "girls" preset letter

    // ── ORANGES & WARM ─────────────────────────────────
    { dmc: "350", name: "Coral",                hex: "#DC4D55", category: "orange" }, // for "girls" preset letter alt
    { dmc: "947", name: "Burnt Orange",         hex: "#E47137", category: "orange" },
    { dmc: "740", name: "Pumpkin Orange",       hex: "#FF8C26", category: "orange" }, // for Armenian Flag preset

    // ── GOLDS & DEEP YELLOWS ───────────────────────────
    { dmc: "972", name: "Deep Yellow",          hex: "#E6A817", category: "gold" },
    { dmc: "973", name: "Bright Yellow",        hex: "#F4D02E", category: "gold" },   // for "unisex" preset block
    { dmc: "729", name: "Old Gold",             hex: "#C5A356", category: "gold" },

    // ── GREENS ─────────────────────────────────────────
    { dmc: "986", name: "Very Dark Forest Green", hex: "#2D5536", category: "green" },
    { dmc: "3346",name: "Hunter Green",         hex: "#496B3D", category: "green" },
    { dmc: "3814",name: "Soft Sage",            hex: "#739B7B", category: "green" },
    { dmc: "905", name: "Bright Green",         hex: "#67923A", category: "green" }, // for "unisex" preset letter

    // ── BLUES ──────────────────────────────────────────
    { dmc: "823", name: "Dark Navy Blue",       hex: "#1F2C4E", category: "blue" },
    { dmc: "311", name: "Medium Navy Blue",     hex: "#2B4C73", category: "blue" }, // for "boys" preset letter
    { dmc: "798", name: "Dark Delft Blue",      hex: "#3756A4", category: "blue" }, // for Armenian Flag preset
    { dmc: "3766",name: "Light Peacock Blue",   hex: "#4A8AAB", category: "blue" },
    { dmc: "775", name: "Baby Blue",            hex: "#B5CEDE", category: "blue" }, // for "boys" preset block

    // ── PURPLES ────────────────────────────────────────
    { dmc: "550", name: "Very Dark Violet",     hex: "#5C2D6E", category: "purple" }, // for "purple" preset letter
    { dmc: "3837",name: "Ultra Dark Lavender",  hex: "#7755A1", category: "purple" },
    { dmc: "211", name: "Light Lavender",       hex: "#C9B5D6", category: "purple" }, // for "purple" preset block

    // ── BROWNS & NEUTRALS ──────────────────────────────
    { dmc: "898", name: "Very Dark Coffee Brown", hex: "#5D3920", category: "brown" },
    { dmc: "433", name: "Medium Brown",         hex: "#7E4F26", category: "brown" },
    { dmc: "437", name: "Light Tan",            hex: "#C7A877", category: "brown" }, // for Armenian Flag preset block (warm shiny brown)
    { dmc: "310", name: "Black",                hex: "#1A1A1A", category: "neutral" },
    { dmc: "844", name: "Charcoal",             hex: "#3C3934", category: "neutral" },
  ],

  // ============================================================
  // COLOR PRESETS — Lusik's actual color combinations
  // ============================================================
  // These aren't algorithmic birth-month matches — these are the specific
  // pairings Lusik makes for real customers. Each one is a combination she
  // does regularly enough that customers can pick it directly.
  //
  // For most presets, `block` (DMC #) sets the cube outline color and
  // `letter` (DMC #) sets all letters' color. The Armenian Flag preset is
  // the exception: it uses `letterColors` (array) for per-letter coloring
  // — red A, blue B, orange C — to evoke the Armenian flag's tricolor.
  // This applies to BOTH alphabets: in English mode, A is red, B is blue,
  // C is orange (with the same colors repeating for letters 4-6 of the
  // 6-letter layout).
  colorPresets: [
    // Lusik's actual color combinations she stitches regularly. Magenta/coral
    // for "Girls" — these two colors are next to each other on the color
    // wheel (both warm pinks shifting toward red), so we'll offer one
    // combined "Girls" preset showing both options visually.
    {
      key: "lusik_boys",
      label: "Boys",
      block: "775",   // Baby Blue
      letter: "311",  // Medium Navy Blue (semi-dark)
      description: "Baby blue cube with semi-dark blue letters. Lusik's classic choice for boys."
    },
    {
      key: "lusik_girls",
      label: "Girls",
      block: "604",   // Light Pink
      letter: "718",  // Magenta Pink (richer, more saturated)
      description: "Light pink cube with magenta letters. A coral variant is also available — just email Lusik to request it."
    },
    {
      key: "lusik_unisex",
      label: "Unisex",
      block: "973",   // Bright Yellow
      letter: "905",  // Bright Green
      description: "Yellow cube with green letters. Cheerful and gender-neutral."
    },
    {
      key: "lusik_purple",
      label: "Purple",
      block: "211",   // Light Lavender
      letter: "550",  // Very Dark Violet
      description: "Light purple cube with dark purple letters. Quiet and elegant."
    },
    {
      // Per-letter colors evoke the Armenian flag tricolor: red, blue, orange.
      // The `letterColors` array overrides the single `letter` field when
      // present. For a 3-letter layout, it maps to letters 1/2/3. For the
      // 6-letter double-diagonal layout, the alphabet repeats — so it maps
      // letters 1/2/3 then again 4/5/6, giving each diagonal red-blue-orange.
      key: "lusik_armenian_flag",
      label: "Armenian Flag",
      block: "437",   // Light Tan (warm, slightly shiny brown)
      letter: "498",  // Default letter color (fallback; per-letter overrides apply)
      letterColors: ["498", "798", "740"],   // Red A · Blue B · Orange C
      description: "Light tan cube with red, blue, and orange letters — the colors of the Armenian flag."
    },
  ],

  // Legacy colors array — kept for code compatibility. The default thread
  // color (Wine Red) is what an order defaults to if the customer doesn't
  // choose. New cart flow uses threadColors and colorPresets above.
  colors: [
    { name: "Wine Red", hex: "#8B2C2C" },
  ],
  // ALPHABETS — used by the blanket picker. Each blanket has three separate
  // squares, each with one letter, stitched diagonally across the blanket.
  // The diagonal direction is fixed (top-left to bottom-right) — Lusik does
  // not offer the mirrored direction. There is no DIAGONAL_DIRECTIONS choice.
  alphabets: [
    {
      key: "armenian",
      label: "Armenian",
      letters: ["Ա", "Բ", "Գ"],
      transliteration: "Ayb · Ben · Gim",
    },
    {
      key: "english",
      label: "English",
      letters: ["A", "B", "C"],
      transliteration: "A · B · C",
    },
  ],
  // LAYOUTS — the spatial arrangements Lusik can stitch on a blanket.
  //
  // ⚠️  TODO_LUSIK: These variants have NOT been confirmed with Lusik.
  // ⚠️  Before launch, confirm with her: (a) does she make all of these,
  // ⚠️  (b) at what prices, (c) any she should remove. Hide any she doesn't
  // ⚠️  make by setting `enabled: false` on the entry — the UI auto-hides it.
  //
  // Each layout entry includes:
  //   - key:          internal id used in cart SKU, Stripe metadata, and orders.
  //   - label:        short customer-facing name
  //   - shortLabel:   for the picker button (includes Unicode arrow indicator)
  //   - description:  full plain-language description that goes to Lusik in
  //                   the order record (THIS IS HOW SHE KNOWS WHAT TO STITCH).
  //   - letterCount:  how many letter-squares this variant has (3 or 6).
  //   - priceCents:   the price in cents (8900 = $89). Variants involving more
  //                   work charge more. Lusik should sanity-check these numbers.
  //   - preview:      array of grid positions (0–24 for the 5x5 grid we draw)
  //                   indicating where letters go. The first N positions get
  //                   the alphabet's N letters, mapped in stitch-order.
  //   - enabled:      false hides the variant from the picker. Use this to
  //                   remove a variant temporarily without deleting the code.
  layouts: [
    {
      key: "double_diag_br",
      label: "Two parallel diagonals",
      shortLabel: "↘↘ Two parallel diagonals · A at top-left of each",
      description: "Six letter squares placed in two parallel diagonals, both slanting top-left to bottom-right (↘). The first letter (A) sits at the top-left of each diagonal track. The upper diagonal hugs the top-right region of the blanket; the lower diagonal hugs the bottom-left region — so the two diagonals occupy diagonally opposite corners. Alphabet stitched twice, once on each diagonal.",
      letterCount: 6,
      priceCents: 6500,
      // 7x7 grid positions for two parallel ↘↘ diagonals occupying
      // diagonally opposite corners of the canvas.
      // Upper diagonal (top-right corner region):
      //   row 0 col 4, row 1 col 5, row 2 col 6 = positions 4, 12, 20
      //   A at (0,4) — top-left of its own track; C reaches the right edge.
      // Lower diagonal (bottom-left corner region):
      //   row 4 col 0, row 5 col 1, row 6 col 2 = positions 28, 36, 44
      //   A at (4,0) — top-left of its own track; C reaches the bottom edge.
      // Both diagonals share the same slope (col − row = +4 for upper,
      // −4 for lower); the geometric midline col = row runs between
      // them and carries the optional name/year text.
      preview: [4, 12, 20, 28, 36, 44],
      enabled: true,
    },
  ],
};
