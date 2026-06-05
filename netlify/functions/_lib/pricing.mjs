// ============================================================
// Pricing constants — the single source of truth on the server
// ============================================================
// Numbers that the browser ALSO knows about (free-shipping
// threshold, gift-wrap add-on price). Previously these were
// declared twice — once in CONFIG (now src/data/config.js), once
// at the top of create-checkout-session.mjs — which is the kind of
// drift waiting to happen that loses money quietly.
//
// Now the server-side copy lives here. The browser still needs
// its own copy (it doesn't import server modules), but a unit
// test (`pricing-drift.test.mjs`) grep-asserts the two literals
// match, so the duplication can't silently rot.
//
// When changing a value:
//   1. Update the number below.
//   2. Update the matching CONFIG.* literal in src/data/config.js
//      (the test failure will tell you exactly which one).
//   3. Commit both files together.
// ============================================================

// Free U.S. shipping at or above this subtotal. Mirrored in
// src/data/config.js as CONFIG.FREE_SHIPPING_THRESHOLD_CENTS.
// Set to 0 so EVERY order ships free — surprise shipping at the
// final checkout step was the biggest small-cart abandonment
// driver. Shipping cost is absorbed into product pricing instead.
export const FREE_SHIPPING_THRESHOLD_CENTS = 0;

// Gift-wrap add-on charge. Mirrored in src/data/config.js as
// CONFIG.GIFT_WRAP_PRICE_CENTS. The browser shows
// the line in the order summary; this number is what the server
// actually charges via a Stripe line item.
export const GIFT_WRAP_PRICE_CENTS = 500;
