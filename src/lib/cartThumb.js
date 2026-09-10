// ============================================================
// CART THUMBNAILS — the piece they configured, in the bag
// ============================================================
// SITE_OVERHAUL_HANDOFF.md PR 8: "Bag rows and checkout summary show a
// small poster of the configured design."
//
// A bag row that shows a stock photograph of somebody else's blanket,
// after the customer just spent five minutes choosing an alphabet and
// two thread colours, quietly loses the thing they came for. So the
// stage exports a small image when the piece goes in the bag.
//
// It is a DISPLAY field and nothing else:
//   - it never reaches the server (CheckoutView builds its payload from
//     an explicit list of fields, so this one is dropped by
//     construction, and a test holds that);
//   - it is re-validated on the way out of localStorage, because a
//     string read from storage and put straight into an <img src> is a
//     way to make the browser fetch something for a third party.
//
// Plain JavaScript with JSDoc so the Node unit suite can import the real
// rules.
// ============================================================

/**
 * The most a thumbnail may weigh.
 *
 * A cart holds up to forty rows and all of them share one localStorage
 * origin, so this is a real budget rather than a formality. Forty
 * kilobytes of base64 is roughly thirty of image.
 */
export const THUMB_MAX_BYTES = 40 * 1024;

/** Longest side, in device-independent pixels. */
export const THUMB_MAX_EDGE = 320;

/** Only these can appear in an <img src> from this field. */
const ALLOWED_PREFIX = /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/;

/**
 * A thumbnail that is safe to render, or null.
 *
 * Rejects anything that is not a self-contained base64 image data URL.
 * An http(s) URL would be a request to somebody else's server made on
 * the customer's behalf, from a value that lives in storage this code
 * does not control; an SVG data URL can carry script.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function sanitizeThumb(value) {
  if (typeof value !== "string") return null;
  if (value.length > THUMB_MAX_BYTES) return null;
  if (!ALLOWED_PREFIX.test(value)) return null;
  return value;
}

/**
 * The size to capture at: the stage's own shape, scaled so its longest
 * side is THUMB_MAX_EDGE and never enlarged.
 *
 * Deliberately NOT a fixed 320 by 240. The stage is a tall box and a bag
 * row is a small one; squeezing a blanket into a landscape frame makes
 * the piece the wrong shape, which on a product whose whole appeal is
 * its proportions is a worse lie than a slightly different thumbnail
 * size. Bag rows crop with object-fit, so any shape lands correctly.
 *
 * @param {number} width
 * @param {number} height
 * @returns {{ width: number, height: number }}
 */
export function thumbSize(width, height) {
  const w = Math.max(1, Math.floor(Number(width) || 0));
  const h = Math.max(1, Math.floor(Number(height) || 0));
  const scale = Math.min(1, THUMB_MAX_EDGE / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/**
 * The quality ladder tried in order until one fits the budget.
 *
 * A blanket covered in stitches does not compress like a photograph, so
 * one fixed quality either wastes space on a bare bib or blows the
 * budget on a full alphabet.
 */
export const THUMB_QUALITIES = Object.freeze([0.72, 0.55, 0.4]);
