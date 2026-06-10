// ============================================================
// _lib/launch-promo.mjs — time-boxed "Founding Price" launch promo
// ============================================================
// A SERVER-AUTHORITATIVE, time-based intro-pricing promo. While the
// promo window is open, selected bibs are charged a lower "founding
// price"; the moment the window closes, prices revert automatically —
// no manual step, no sold-count to track (that was the simpler choice
// over a unit cap).
//
// SOURCE OF TRUTH: this file is what CHECKOUT trusts. The browser has a
// mirror in src/data/config.js (CONFIG.LAUNCH_PROMO) for DISPLAY only —
// the two are kept in lockstep by launch-promo-drift.test.mjs, exactly
// like the FREE_SHIPPING_THRESHOLD_CENTS pattern. If you change a price
// or date, change BOTH files (the test will fail loudly otherwise).
//
// SAFETY: `enabled: false` = totally dormant. No price ever changes, on
// the server or the browser, until this is flipped on AND the current
// time is inside [startsAt, endsAt). Keys not listed in FOUNDING_CENTS
// are never discounted (blankets + the days-of-week set are excluded on
// purpose — heirloom/considered purchases shouldn't be marked down).
//
// HOW TO RUN IT:
//   1. Set enabled: true (here AND in src/data/config.js).
//   2. Set startsAt / endsAt to the launch window (ISO 8601, UTC).
//   3. Deploy. Prices drop on display + at checkout; they auto-revert
//      at endsAt with no further action.
// ============================================================

export const LAUNCH_PROMO = Object.freeze({
  // RETIRED June 2026 — superseded by a permanent base-price drop on the
  // bibs (see TRUSTED_PRODUCTS), which took the new everyday prices BELOW
  // the old founding prices. FOUNDING_CENTS must stay empty while base
  // prices sit under the old promo values: the drift test requires every
  // promo entry to be strictly cheaper than its trusted price. To run a
  // future promo: re-populate FOUNDING_CENTS (strictly below the current
  // trusted prices), set the window, flip enabled in BOTH files.
  enabled: false,
  startsAt: "2026-06-05T00:00:00Z",     // historical window (kept for the record)
  endsAt:   "2026-06-12T00:00:00Z",
  label: "Founding price",              // badge text shown in the UI

  // productKey -> founding price in CENTS. MUST be strictly less than the
  // product's normal TRUSTED_PRODUCTS priceCents (a guard rejects any
  // entry that isn't, so a fat-fingered higher value can never raise a
  // price).
  FOUNDING_CENTS: Object.freeze({}),
});

// Is the promo live at instant `now` (ms epoch)? Off unless enabled AND
// inside the window. Bad/empty dates fail closed (promo off).
export function isLaunchPromoActive(now = Date.now()) {
  if (!LAUNCH_PROMO.enabled) return false;
  const start = Date.parse(LAUNCH_PROMO.startsAt);
  const end   = Date.parse(LAUNCH_PROMO.endsAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return now >= start && now < end;
}

// Founding price (cents) for a productKey, or null if it has none.
export function foundingCentsFor(productKey) {
  const c = LAUNCH_PROMO.FOUNDING_CENTS[productKey];
  return Number.isInteger(c) ? c : null;
}

// The price CHECKOUT should actually charge for a line item: the founding
// price when the promo is active AND it's strictly lower than normal,
// otherwise the normal price. The "strictly lower" guard means a
// misconfigured founding price can only ever discount, never raise.
export function effectiveCents(productKey, normalCents, now = Date.now()) {
  if (!isLaunchPromoActive(now)) return normalCents;
  const f = foundingCentsFor(productKey);
  return (f != null && f < normalCents) ? f : normalCents;
}
