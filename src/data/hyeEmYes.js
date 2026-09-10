// ============================================================
// HYE EM YES — the words and the three colours
// ============================================================
// հայ եմ ես: "I am Armenian", one word in each colour of the Armenian
// flag. Nothing about this is chosen by the customer — the product page
// says outright that the flag IS the design — so it lives here as data
// rather than in a configurator's state.
//
// Lowercase, deliberately. public/img/hye-em-bib/01.jpg shows the piece
// with a lowercase հ: it is a sentence a child is saying, not a title.
// The product JSON's tagline capitalises it the way prose capitalises a
// sentence; the cloth does not.
//
// Plain JavaScript rather than TypeScript, the same reason as
// blanketLayout.js and capabilityTier.js: CI runs the unit suite on Node
// 20, which cannot import TypeScript, and a drift test has to compare
// against the REAL values rather than a transcription of them. The one
// here checks these hexes against the colorway in
// content/products/hy-em-armenian-bib.json, so a Studio edit and the
// stitched piece cannot come to disagree.
// ============================================================

/** @typedef {{ text: string, color: string }} StitchedWord */

/** Red, blue, orange — the flag's own order, top band first. */
export const ARMENIAN_FLAG_COLORS = Object.freeze({
  red: "#D90012",
  blue: "#0033A0",
  orange: "#F2A800",
  /** The flagpole on the cap's brim: an olive-brown thread, not a colour of the flag. */
  pole: "#7C6A3C",
});

/** The words in stitching order, each with its thread. */
export const HYE_EM_YES_WORDS = Object.freeze([
  { text: "հայ", color: ARMENIAN_FLAG_COLORS.red },
  { text: "եմ", color: ARMENIAN_FLAG_COLORS.blue },
  { text: "ես", color: ARMENIAN_FLAG_COLORS.orange },
]);

/** The whole sentence, for a text alternative or a search index. */
export const HYE_EM_YES_TEXT = HYE_EM_YES_WORDS.map((w) => w.text).join(" ");
