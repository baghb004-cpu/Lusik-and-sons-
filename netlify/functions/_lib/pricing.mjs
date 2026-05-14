// ============================================================
// Pricing constants — the single source of truth on the server
// ============================================================
// Numbers that the browser ALSO knows about (free-shipping
// threshold, gift-wrap add-on price). Previously these were
// declared twice — once in CONFIG inside index.html, once at the
// top of create-checkout-session.mjs — which is the kind of
// drift waiting to happen that loses money quietly.
//
// Now the server-side copy lives here. The browser still needs
// its own copy (it doesn't import server modules), but a unit
// test (`pricing-drift.test.mjs`) grep-asserts the two literals
// match, so the duplication can't silently rot.
//
// When changing a value:
//   1. Update the number below.
//   2. Update the matching CONFIG.* literal in index.html (the
//      test failure will tell you exactly which one).
//   3. Commit both files together.
// ============================================================

// Free U.S. shipping at or above this subtotal. Mirrored in
// index.html as CONFIG.FREE_SHIPPING_THRESHOLD_CENTS (~line 1662).
export const FREE_SHIPPING_THRESHOLD_CENTS = 15000;

// Gift-wrap add-on charge. Mirrored in index.html as
// CONFIG.GIFT_WRAP_PRICE_CENTS (~line 1675). The browser shows
// the line in the order summary; this number is what the server
// actually charges via a Stripe line item.
export const GIFT_WRAP_PRICE_CENTS = 500;
