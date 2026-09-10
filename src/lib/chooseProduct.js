// ============================================================
// HELPING SOMEONE CHOOSE
// ============================================================
// Three questions on the shop page — who it is for, when it is needed,
// which language — and one recommendation.
//
// The rules are built only from things the shop actually knows: the
// lead time in CONFIG.LEAD_TIMES.WEEKS, the category a product sits in,
// its price, and whether it can be worked in English. Nothing here
// invents a fact about a piece. A recommender that guessed would be
// worse than no recommender, because a customer would act on it.
//
// The most important rule is the honest one: **when someone says they
// need it by a date, a piece that cannot be finished by then is removed,
// not ranked lower.** Recommending a ten-week blanket to someone who
// needs it in three is not a soft mismatch, it is a missed christening.
//
// Plain JavaScript with JSDoc, so the Node unit suite can import the real
// rules rather than a transcription of them.
// ============================================================

/** How long until the customer needs it, in weeks. */
export const WHEN_OPTIONS = Object.freeze([
  { key: "soon", weeks: 4 },
  { key: "months", weeks: 10 },
  { key: "no_rush", weeks: Infinity },
]);

/** Who it is for. Maps to what the piece is, not to who buys it. */
export const WHO_OPTIONS = Object.freeze([
  { key: "keepsake" },   // a christening, an heirloom, a photograph
  { key: "everyday" },   // feeding, mess, a baby who is already here
  { key: "whole_gift" }, // a baby shower — something that opens as a set
]);

export const LANGUAGE_OPTIONS = Object.freeze([
  { key: "armenian" },
  { key: "english" },
  { key: "either" },
]);

/**
 * Products that can carry an English name. Everything else is worked in
 * Armenian because the Armenian IS the product — the days of the week,
 * the blessing, "I am Armenian" — and translating them would be selling
 * something different.
 */
export const ENGLISH_CAPABLE = Object.freeze(["blanket-alphabet", "bib-single", "bib"]);

/** Sets: more than one piece, so they open like a gift. */
export const SET_KEYS = Object.freeze([
  "bib-days-of-week",
  "bib-anushig-pair",
  "bib-bari-akhorzhak-set",
]);

/**
 * @typedef {object} ChooserProduct
 * @property {string} key
 * @property {string} slug
 * @property {string} categorySlug
 * @property {number} [priceFrom]
 * @property {[number, number]} weeks  lead time, min and max
 */

/**
 * @typedef {object} Answers
 * @property {string} [who]
 * @property {string} [when]
 * @property {string} [language]
 */

/**
 * Rank the products against the answers.
 *
 * @param {ChooserProduct[]} products
 * @param {Answers} answers
 * @returns {{ recommended: ChooserProduct | null, alternatives: ChooserProduct[], excludedForTime: number }}
 */
export function chooseProduct(products, answers = {}) {
  const list = Array.isArray(products) ? products : [];
  const deadline = WHEN_OPTIONS.find((o) => o.key === answers.when)?.weeks ?? Infinity;

  // The hard filter. A piece whose LONGEST estimate misses the date is
  // out — quoting the optimistic end of a range to make a sale is how a
  // gift arrives after the occasion.
  const inTime = [];
  let excludedForTime = 0;
  for (const product of list) {
    const max = product.weeks?.[1];
    if (Number.isFinite(deadline) && Number.isFinite(max) && max > deadline) {
      excludedForTime += 1;
      continue;
    }
    inTime.push(product);
  }

  // The other hard filter: asking for English and being sent something
  // that cannot be worked in English is not a recommendation.
  const candidates = answers.language === "english"
    ? inTime.filter((p) => ENGLISH_CAPABLE.includes(p.key))
    : inTime;

  if (candidates.length === 0) {
    return { recommended: null, alternatives: [], excludedForTime };
  }

  const scored = candidates
    .map((product) => ({ product, score: scoreFor(product, answers) }))
    // Ties break on the shorter lead time, then on price, then on key —
    // the last so the same answers always give the same answer.
    .sort((a, b) =>
      b.score - a.score
      || (a.product.weeks?.[1] ?? 0) - (b.product.weeks?.[1] ?? 0)
      || (a.product.priceFrom ?? 0) - (b.product.priceFrom ?? 0)
      || a.product.key.localeCompare(b.product.key));

  return {
    recommended: scored[0].product,
    alternatives: scored.slice(1, 3).map((s) => s.product),
    excludedForTime,
  };
}

/**
 * @param {ChooserProduct} product
 * @param {Answers} answers
 * @returns {number}
 */
function scoreFor(product, answers) {
  let score = 0;
  const isSet = SET_KEYS.includes(product.key);
  const isBlanket = product.categorySlug === "blankets";

  if (answers.who === "keepsake") {
    // A blanket is the thing that gets folded into a chest.
    if (isBlanket) score += 3;
    if (isSet) score += 1;
  } else if (answers.who === "everyday") {
    // A bib is what a baby actually wears at lunch.
    if (!isBlanket) score += 3;
    if (isSet) score += 1;
  } else if (answers.who === "whole_gift") {
    if (isSet) score += 3;
    if (isBlanket) score += 1;
  }

  // Being able to work the name in the language they asked for is worth
  // something even when they said either.
  if (answers.language === "armenian" && !ENGLISH_CAPABLE.includes(product.key)) score += 1;
  if (answers.language === "english" && ENGLISH_CAPABLE.includes(product.key)) score += 1;

  // With no deadline, the pieces that take longest are the ones someone
  // is most glad to have waited for.
  if (answers.when === "no_rush" && (product.weeks?.[1] ?? 0) >= 8) score += 1;
  if (answers.when === "soon" && (product.weeks?.[1] ?? 0) <= 3) score += 1;

  return score;
}

/**
 * Whether the customer has answered enough to be given an answer.
 *
 * @param {Answers} answers
 * @returns {boolean}
 */
export function isAnswered(answers = {}) {
  return Boolean(answers.who && answers.when && answers.language);
}
