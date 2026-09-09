// ============================================================
// bundleDiscount — browser helpers for the multi-item bundle promo
// ============================================================
// DISPLAY ONLY. The server (netlify/functions/_lib/bundle-discount.mjs)
// reduces the real Stripe line-item prices at checkout; this mirrors its
// math from CONFIG.BUNDLE_DISCOUNT for the savings row shown in the bag
// and the checkout order summary. Lockstep is enforced by
// bundle-discount-drift.test.mjs.
//
// The row shows the ALLOCATED amount, not the ideal one, so the number
// a customer reads in the bag is the number Stripe charges them.
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

export const MIN_UNIT_CENTS = 100;  // never charge less than $1 for a unit

// The ideal savings before allocation, in cents. Mirrors the server's
// bundleDiscountCents(): $1 per unit beyond the first, capped, and never
// allowed to swallow the subtotal.
export function bundleDiscountCents(totalUnits, subtotalCents) {
  if (!PROMO.ENABLED) return 0;
  const units = Number.isInteger(totalUnits) ? totalUnits : 0;
  const sub = Number.isInteger(subtotalCents) ? subtotalCents : 0;
  if (units <= 1 || sub <= 0) return 0;
  const raw = (units - 1) * (PROMO.PER_EXTRA_ITEM_CENTS || 0);
  return Math.max(0, Math.min(raw, PROMO.MAX_DISCOUNT_CENTS || 0, sub - 50));
}

// Mirror of the server's allocator: the savings become integer per-unit
// price reductions, so the hosted checkout keeps its promotion-code
// field for the printed coupons. Same inputs, same output.
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

// Cart rows -> allocator lines. Cart prices are dollars; the server
// works from the trusted price map, and the build-time gate keeps the
// two equal to the cent.
export function cartLines(cart) {
  return (Array.isArray(cart) ? cart : []).map((item) => ({
    unitCents: Math.round((Number(item?.price) || 0) * 100),
    qty: Number.isInteger(item?.qty) && item.qty > 0 ? Math.min(99, item.qty) : 1,
  }));
}

// Savings for a cart: { units, cents, dollars, perExtraDollars }.
// `cents` is the ALLOCATED amount — exactly what Stripe will charge.
// 0 when the promo is off or the bag has 0–1 units.
export function bundleSavingsForCart(cart, subtotalDollars) {
  const alloc = allocateBundleDiscount(cartLines(cart));
  // A caller that passes an explicit subtotal (the checkout summary does)
  // still gets the cap applied against that number.
  const passedCents = Math.round((Number(subtotalDollars) || 0) * 100);
  const cents = passedCents > 0 && alloc.subtotalCents === 0
    ? bundleDiscountCents(alloc.units, passedCents)
    : alloc.totalCents;
  return {
    units: alloc.units,
    cents,
    dollars: cents / 100,
    perExtraDollars: (PROMO.PER_EXTRA_ITEM_CENTS || 0) / 100,
    enabled: PROMO.ENABLED === true,
  };
}
