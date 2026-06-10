// ============================================================
// bundleDiscount — browser helpers for the multi-item bundle promo
// ============================================================
// DISPLAY ONLY. The server (netlify/functions/_lib/bundle-discount.mjs)
// attaches the real Stripe coupon at checkout; this mirrors its math
// from CONFIG.BUNDLE_DISCOUNT for the savings row shown in the bag and
// the checkout order summary. Lockstep is enforced by
// bundle-discount-drift.test.mjs.
// ============================================================

import { CONFIG } from "../data/config.js";

const PROMO = CONFIG.BUNDLE_DISCOUNT || {};

// Total UNITS in the cart (sum of quantities, clamped 1..99 per line —
// the same bounds checkout enforces server-side).
export function cartUnitCount(cart) {
  if (!Array.isArray(cart)) return 0;
  return cart.reduce((sum, item) => {
    const raw = Number.isInteger(item?.qty) && item.qty > 0 ? item.qty : 1;
    return sum + Math.min(99, raw);
  }, 0);
}

// Savings for a cart: { units, cents, dollars, perExtraDollars }.
// cents is 0 when the promo is off or the bag has 0–1 units.
export function bundleSavingsForCart(cart, subtotalDollars) {
  const units = cartUnitCount(cart);
  const subtotalCents = Math.round((Number(subtotalDollars) || 0) * 100);
  let cents = 0;
  if (PROMO.ENABLED && units > 1 && subtotalCents > 0) {
    const raw = (units - 1) * (PROMO.PER_EXTRA_ITEM_CENTS || 0);
    cents = Math.max(0, Math.min(raw, PROMO.MAX_DISCOUNT_CENTS || 0, subtotalCents - 50));
  }
  return {
    units,
    cents,
    dollars: cents / 100,
    perExtraDollars: (PROMO.PER_EXTRA_ITEM_CENTS || 0) / 100,
    enabled: PROMO.ENABLED === true,
  };
}
