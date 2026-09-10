// ============================================================
// TRY A NAME — the doorway from a shop card to a configured piece
// ============================================================
// SITE_OVERHAUL_HANDOFF.md PR 7 asks for a "Try a name" field on the two
// products a customer configures, carrying what they typed into the
// product page.
//
// It is a DOORWAY, not a second configurator. Typing a name into a card
// in a grid and watching a 3D blanket stitch it would mean loading the
// engine on a page showing four products at once, which the same plan
// rules out in as many words ("No engine load on grids"). What the field
// removes is the step where you land on the product page and have to
// find the box and type the name again. You land already looking at it.
//
// Plain JavaScript with JSDoc so the Node unit suite can import the real
// rules rather than a transcription of them.
// ============================================================

/**
 * How many letters fit on the smallest of these pieces.
 *
 * Six, because that is what the bib holds — `maxNameLength` in
 * `src/data/customProducts.js` — and what the blanket's two custom lines
 * accept. A drift test keeps this equal to both rather than letting a
 * fourth copy of the number wander off.
 */
export const TRY_NAME_MAX = 6;

/**
 * The products that can carry a typed name, by CATALOG key.
 *
 * Not the trusted checkout key: the rest of the shop is worked in
 * Armenian that IS the product — the days of the week, the blessing,
 * "I am Armenian" — and there is nothing to type into those.
 */
export const TRY_NAME_PRODUCTS = Object.freeze(["blanket-alphabet", "bib-single"]);

/** @param {string} [key] catalog key @returns {boolean} */
export function acceptsTryName(key) {
  return typeof key === "string" && TRY_NAME_PRODUCTS.includes(key);
}

// Latin, Armenian (capitals, lowercase and the ligatures), the accented
// Latin a European name needs, plus space, hyphen and apostrophe. A name
// is not a free-text field: what goes in here ends up stitched.
const ALLOWED = /[^A-Za-zÀ-ɏԱ-Ֆա-և֊ﬓ-ﬗ\s'-]/g;

/**
 * What a customer typed, reduced to something that could be worked.
 *
 * @param {string} raw
 * @param {number} [max]
 * @returns {string}
 */
export function sanitizeTryName(raw, max = TRY_NAME_MAX) {
  if (typeof raw !== "string") return "";
  const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : TRY_NAME_MAX;
  return raw
    .replace(ALLOWED, "")
    .replace(/\s+/g, " ")
    // Leading space only; a trailing one is what someone is standing on
    // while they type the next letter, and eating it makes the field
    // feel like it is fighting them.
    .replace(/^ +/, "")
    .slice(0, limit);
}

/**
 * The product page, with the name already in it.
 *
 * One query parameter, `?name=`, readable in the address bar and the
 * same on both products. The blanket's existing `?d=<base64>` share blob
 * is a different thing — a whole design, alphabet and colours included —
 * and it keeps precedence when both are present, because someone opening
 * a shared design asked for that design.
 *
 * @param {string} path e.g. "/shop/blankets/armenian-alphabet-blanket"
 * @param {string} name
 * @param {number} [max]
 * @returns {string}
 */
export function tryNameHref(path, name, max = TRY_NAME_MAX) {
  const clean = sanitizeTryName(name, max).trim();
  if (!clean) return path;
  return `${path}?name=${encodeURIComponent(clean)}`;
}

/**
 * The name a product page was opened with, or "".
 *
 * @param {string | URLSearchParams} [search] `window.location.search`
 * @param {number} [max]
 * @returns {string}
 */
export function readTryName(search, max = TRY_NAME_MAX) {
  try {
    const params = search instanceof URLSearchParams
      ? search
      : new URLSearchParams(typeof search === "string" ? search : "");
    return sanitizeTryName(params.get("name") ?? "", max).trim();
  } catch {
    // A malformed query string must never stop a product page mounting.
    return "";
  }
}
