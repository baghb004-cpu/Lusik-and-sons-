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
// Stripe constraint worth knowing: a Checkout Session can have EITHER
// `discounts` (this bundle coupon) OR `allow_promotion_codes`, never
// both. So when the bundle discount applies (2+ units), the hosted
// checkout page loses its "Add promotion code" field; single-item
// checkouts keep it. Documented tradeoff, revisit if Lusik starts
// issuing promo codes regularly.
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
