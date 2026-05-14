// ============================================================
// PHOTO_* — product photo URLs / inlined base64 fallbacks
// ============================================================
// Mirror of the PHOTO_* constants in index.html (~line 1102).
// Some entries are path strings (`/img/foo.jpg`); two are still
// base64-inlined because Lusik's photo handoff for those isn't
// yet finalized.
//
// Paths are normalized to leading-slash absolute (`/img/...`)
// here, even though the original copies in index.html lack the
// leading slash. The current site happens to work because the
// only routes that render product images are the home / PDP
// routes, where `img/foo.jpg` and `/img/foo.jpg` resolve to the
// same URL. Once this module is wired up in Phase 9, the
// leading-slash form is the correct one for the Vite build —
// `/public/img/*.jpg` gets served at `/img/*.jpg` after build.
//
// MIGRATION NOTE on the base64 ones:
//   The Phase 10 flip extracts PHOTO_PURPLE_DETAIL and
//   PHOTO_BIB_PILE into real /public/img/ JPEGs and switches
//   them to path strings here. Until then, importing this
//   module pulls ~500 KB of base64 into the JS bundle — fine
//   during development (Vite tree-shakes the unused parts
//   anyway since nothing's wired up yet) but worth flipping
//   before production.
// ============================================================

// IMG_0541.jpg — 238,017 bytes
export const PHOTO_HERO_OLEN = "/img/hero-olen-bib.jpg";
// 5474F925-F1E7-445F-BFC1-9AC85E2A5F9C.jpg — 283,962 bytes
export const PHOTO_PURPLE_FLAT = "/img/purple-flat.jpg";
// A9E2C330-7BD7-4503-BC6E-37B2517D8F52.jpg — 304,698 bytes
export const PHOTO_PURPLE_DETAIL = "/img/purple-detail.jpg";
// 0C6872FB-778B-42A4-A2D7-4C4FB497A7FA.jpg — 205,767 bytes
export const PHOTO_PURPLE_SIDE = "/img/purple-side.jpg";
// IMG_7426.jpg — 281,831 bytes
export const PHOTO_YELLOWGREEN = "/img/yellowgreen.jpg";
// IMG_7428.jpg — 287,644 bytes
export const PHOTO_YELLOWGREEN_2 = "/img/yellowgreen-flat.jpg";
// IMG_0353.jpg — 259,978 bytes
export const PHOTO_BIB_ROMEO = "/img/bib-romeo.jpg";
// FullSizeRender.jpg — 251,635 bytes
export const PHOTO_BIB_STACK = "/img/bib-stack.jpg";
// IMG_7427.jpg — 79,741 bytes
export const PHOTO_BIB_PILE = "/img/bib-pile.jpg";
// IMG_7970.jpg — 224,125 bytes
export const PHOTO_DATE_DETAIL = "/img/date-detail.jpg";
// IMG_7971.jpg — 162,697 bytes
export const PHOTO_ARMENIAN_FLAG = "/img/armenian-flag.jpg";
// IMG_7972.jpg — 168,757 bytes
export const PHOTO_LUCA_HEARTS = "/img/luca-hearts.jpg";

// Newer real-order photos with no exact predecessor in the original gallery.
// OLEN_2026_BLANKET is the same blanket as PHOTO_HERO_OLEN but shot WITHOUT
// the matching bib — a quieter / more contemplative angle that pairs well
// with the hero shot. ARMENIAN_WITH_DATE shows the Armenian-alphabet preset
// combined with stitched date personalization, which is otherwise only shown
// as separate close-ups elsewhere.
export const PHOTO_OLEN_2026_BLANKET = "/img/olen-2026-blanket.jpg";
export const PHOTO_ARMENIAN_WITH_DATE = "/img/armenian-with-date.jpg";
