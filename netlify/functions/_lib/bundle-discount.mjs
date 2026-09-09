// ============================================================
// _lib/bundle-discount.mjs — "every extra piece saves $1" bundle promo
// ============================================================
// Automatic multi-item discount: the first item in the bag is full
// price, and every additional UNIT after it takes PER_EXTRA_ITEM_CENTS
// off the order (2 items = $1 off, 3 items = $2 off, …), capped at
// MAX_DISCOUNT_CENTS. Applies storewide; gift wrap is an add-on, not
// a product, and never counts toward the item total.
//
// SOURCE OF TRUTH: this file is what CHECKOUT charges (via a Stripe
// coupon attached to the session — see create-checkout-session.mjs).
// The browser mirror is CONFIG.BUNDLE_DISCOUNT in src/data/config.js
// (display only: the savings row in the bag + checkout summary),
// kept in lockstep by bundle-discount-drift.test.mjs — same pattern
// as trusted-products / shipping-zones / launch-promo.
//
// The savings are applied as a REDUCTION ON THE LINE ITEMS, not as a
// Stripe coupon attached to the session. That is deliberate: a session
// can set either `discounts` or `allow_promotion_codes`, never both,
// and the shop mails printed coupon codes with every order — so the
// promotion-code field must be available on every checkout. See
// allocateBundleDiscount below.
//
// To tune: change PER_EXTRA_ITEM_CENTS (and the mirror) — e.g. 500
// for "$5 off every extra piece". To kill: ENABLED false in BOTH.
// ============================================================

export const BUNDLE_DISCOUNT = Object.freeze({
  ENABLED: true,
  PER_EXTRA_ITEM_CENTS: 100,    // $1 off per unit beyond the first
  MAX_DISCOUNT_CENTS: 2500,     // safety ceiling ($25) — qty caps make this ~unreachable
});

// Total UNITS in a cart (sum of quantities, qty clamped to the same
// 1..99 bounds checkout enforces). Two bibs on one line counts as 2.
export function cartUnitCount(cart) {
  if (!Array.isArray(cart)) return 0;
  return cart.reduce((sum, item) => {
    const raw = Number.isInteger(item?.qty) && item.qty > 0 ? item.qty : 1;
    return sum + Math.min(99, raw);
  }, 0);
}

// Discount in cents for a unit count, bounded so it can never exceed
// the cap nor swallow the subtotal (Stripe needs a positive total;
// 50¢ floor keeps us clear of the minimum-charge edge).
export function bundleDiscountCents(totalUnits, subtotalCents) {
  if (!BUNDLE_DISCOUNT.ENABLED) return 0;
  const units = Number.isInteger(totalUnits) ? totalUnits : 0;
  const sub = Number.isInteger(subtotalCents) ? subtotalCents : 0;
  if (units <= 1 || sub <= 0) return 0;
  const raw = (units - 1) * BUNDLE_DISCOUNT.PER_EXTRA_ITEM_CENTS;
  return Math.max(0, Math.min(raw, BUNDLE_DISCOUNT.MAX_DISCOUNT_CENTS, sub - 50));
}

export const MIN_UNIT_CENTS = 100;  // never charge less than $1 for a unit

// ------------------------------------------------------------
// Allocation: turning the bundle savings into real line prices
// ------------------------------------------------------------
// Stripe rejects a Checkout Session that sets BOTH `discounts` and
// `allow_promotion_codes`. The shop mails printed coupon codes with
// every order, so the promotion-code field has to be on the hosted
// page for EVERY checkout — which means the bundle savings can no
// longer ride as a session coupon. Instead we bake it into the line
// items: each unit's price drops by a whole number of cents.
//
// A uniform per-unit reduction is exact whenever the total divides by
// the unit count (2 units off $1.00 is 50c each). When it does not
// (3 units off $2.00 is 66c each, two cents short) the remainder goes
// to the first line holding a single unit, which lands the common cart
// on the exact amount. If no such line exists, the customer keeps the
// few cents; the discount never silently grows past its cap.
//
// MIN_UNIT_CENTS keeps every charged unit comfortably positive, which
// Stripe requires. Real prices start at $20, so it never binds.

/**
 * Spread the bundle savings across cart lines as integer per-unit
 * price reductions.
 *
 * @param {Array<{unitCents:number, qty:number}>} lines
 * @returns {{units:number, subtotalCents:number, targetCents:number,
 *            perUnitCents:number, extraLineIndex:number, extraCents:number,
 *            totalCents:number}}
 */
export function allocateBundleDiscount(lines) {
  const norm = (Array.isArray(lines) ? lines : []).map((l) => ({
    unitCents: Number.isInteger(l?.unitCents) && l.unitCents > 0 ? l.unitCents : 0,
    qty: Number.isInteger(l?.qty) && l.qty > 0 ? Math.min(99, l.qty) : 1,
  }));
  const units = norm.reduce((sum, l) => sum + l.qty, 0);
  const subtotalCents = norm.reduce((sum, l) => sum + l.unitCents * l.qty, 0);
  const none = {
    units, subtotalCents, targetCents: 0,
    perUnitCents: 0, extraLineIndex: -1, extraCents: 0, totalCents: 0,
  };
  if (units <= 1 || subtotalCents <= 0) return none;

  const targetCents = bundleDiscountCents(units, subtotalCents);
  if (targetCents <= 0) return none;

  // The cheapest unit in the bag sets how deep a uniform cut can go.
  const cheapest = norm.reduce((min, l) => Math.min(min, l.unitCents), Infinity);
  const headroom = Math.max(0, cheapest - MIN_UNIT_CENTS);
  const perUnitCents = Math.min(Math.floor(targetCents / units), headroom);
  let totalCents = perUnitCents * units;

  let extraLineIndex = -1;
  let extraCents = 0;
  const remainder = targetCents - totalCents;
  if (remainder > 0) {
    const idx = norm.findIndex(
      (l) => l.qty === 1 && l.unitCents - perUnitCents - remainder >= MIN_UNIT_CENTS,
    );
    if (idx >= 0) {
      extraLineIndex = idx;
      extraCents = remainder;
      totalCents += remainder;
    }
  }
  return { units, subtotalCents, targetCents, perUnitCents, extraLineIndex, extraCents, totalCents };
}
