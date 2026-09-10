// ============================================================
// _lib/order-tokens — signed, read-only links to one order
// ============================================================
// Most people who order here never make an account: they check out as a
// guest and then want to know how the piece is coming along. This mints
// the token in their confirmation email's "follow along" link, which
// opens a read-only timeline for that one order.
//
// The token is an HMAC of the order id, so it cannot be guessed and
// cannot be edited into a different order. It grants READ access to one
// order's milestones and nothing else — no address, no email, no
// payment detail, and no write of any kind.
//
// Domain separation matters: the gift-reminder unsubscribe token
// (signReminderToken in _lib/email.mjs) signs the bare order id with the
// same secret, so this one signs a prefixed string. An unsubscribe link
// therefore can never be replayed as a view link, or the reverse.
//
// Secret: ORDER_LINK_SECRET if set, otherwise REMINDER_SECRET, which is
// already required. Without either, signing returns null and the
// feature stays dark rather than shipping guessable links.
// ============================================================
import { createHmac, timingSafeEqual } from "node:crypto";

const PURPOSE = "order-view:";

function secret() {
  return process.env.ORDER_LINK_SECRET || process.env.REMINDER_SECRET || "";
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Signed token for one order, or null when no secret is configured. */
export function signOrderToken(orderId) {
  const key = secret();
  if (!key || !orderId) return null;
  return b64url(createHmac("sha256", key).update(PURPOSE + String(orderId)).digest());
}

/** Constant-time check. False for any missing piece. */
export function verifyOrderToken(orderId, token) {
  const expected = signOrderToken(orderId);
  if (!expected || typeof token !== "string" || token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

// A second capability, with its OWN purpose prefix.
//
// The prefix is the whole point: without it, a token minted to let
// somebody watch their order would also let them post a review on it,
// and a review link would open the timeline. Two capabilities, two
// strings, one secret.
const REVIEW_PURPOSE = "order-review:";

/** Signed review token for one order, or null when no secret is set. */
export function signReviewToken(orderId) {
  const key = secret();
  if (!key || !orderId) return null;
  return b64url(createHmac("sha256", key).update(REVIEW_PURPOSE + String(orderId)).digest());
}

/** Constant-time check. False for any missing piece. */
export function verifyReviewToken(orderId, token) {
  const expected = signReviewToken(orderId);
  if (!expected || typeof token !== "string" || token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

// The steps in the order Lusik works them. The UI renders this list even
// for steps that have not happened yet, so a customer can see what is
// still ahead. Keep in lockstep with the CHECK constraint in schema.sql.
export const MILESTONES = Object.freeze([
  "received",
  "cloth_cut",
  "stitching",
  "backing",
  "finished",
  "shipped",
]);

export function isMilestone(value) {
  return typeof value === "string" && MILESTONES.includes(value);
}
