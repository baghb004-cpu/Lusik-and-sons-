// ============================================================
// Bundle-discount drift + math guard
// ============================================================
// The bundle promo lives twice on purpose:
//   - Server: _lib/bundle-discount.mjs — what Stripe checkout charges
//     (a coupon attached to the session).
//   - Browser: CONFIG.BUNDLE_DISCOUNT (src/data/config.js), consumed
//     through src/lib/bundleDiscount.js — the savings row in the bag
//     + checkout summary.
//
// They MUST stay identical, or the customer sees one discount and is
// charged another. This test enforces lockstep plus the bounds of the
// math itself.
// ============================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUNDLE_DISCOUNT,
  cartUnitCount,
  bundleDiscountCents,
} from "../bundle-discount.mjs";

const { CONFIG } = await import("../../../../src/data/config.js");
const browserLib = await import("../../../../src/lib/bundleDiscount.js");

test("CONFIG.BUNDLE_DISCOUNT matches the server constants", () => {
  assert.ok(CONFIG.BUNDLE_DISCOUNT, "CONFIG.BUNDLE_DISCOUNT missing from src/data/config.js");
  assert.deepEqual(
    { ...CONFIG.BUNDLE_DISCOUNT },
    { ...BUNDLE_DISCOUNT },
    "BUNDLE_DISCOUNT drift between src/data/config.js and _lib/bundle-discount.mjs",
  );
});

test("unit counting matches between server and browser (qty clamping included)", () => {
  const carts = [
    [],
    [{ qty: 1 }],
    [{ qty: 2 }, { qty: 1 }],
    [{ qty: 0 }, { qty: -3 }, {}],          // malformed -> 1 each
    [{ qty: 250 }],                          // clamped to 99
    [{ qty: 1.5 }],                          // non-integer -> 1
  ];
  for (const cart of carts) {
    assert.equal(
      browserLib.cartUnitCount(cart),
      cartUnitCount(cart),
      `unit count drift for ${JSON.stringify(cart)}`,
    );
  }
});

test("discount math: $1 per extra unit, zero for 0-1 units, capped, never swallows the subtotal", () => {
  const per = BUNDLE_DISCOUNT.PER_EXTRA_ITEM_CENTS;
  assert.equal(bundleDiscountCents(0, 10000), 0);
  assert.equal(bundleDiscountCents(1, 10000), 0);
  assert.equal(bundleDiscountCents(2, 10000), per);
  assert.equal(bundleDiscountCents(3, 10000), 2 * per);
  assert.equal(bundleDiscountCents(5, 10000), 4 * per);
  // Cap
  assert.equal(bundleDiscountCents(999, 1000000), BUNDLE_DISCOUNT.MAX_DISCOUNT_CENTS);
  // Subtotal floor: discount stays 50¢ below the subtotal
  assert.equal(bundleDiscountCents(3, 150), 100);
  assert.equal(bundleDiscountCents(3, 120), 70);
  assert.equal(bundleDiscountCents(2, 0), 0);
  // Garbage in -> zero out
  assert.equal(bundleDiscountCents(null, 10000), 0);
  assert.equal(bundleDiscountCents(2.7, 10000), 0);
});

test("browser savings match the server discount for sample carts", () => {
  const carts = [
    { cart: [{ qty: 1 }], subtotal: 20 },
    { cart: [{ qty: 1 }, { qty: 1 }], subtotal: 60 },
    { cart: [{ qty: 3 }, { qty: 2 }], subtotal: 200 },
    { cart: [{ qty: 2 }], subtotal: 40 },
  ];
  for (const { cart, subtotal } of carts) {
    const units = cartUnitCount(cart);
    const serverCents = bundleDiscountCents(units, Math.round(subtotal * 100));
    const browser = browserLib.bundleSavingsForCart(cart, subtotal);
    assert.equal(browser.units, units);
    assert.equal(browser.cents, serverCents, `savings drift for ${JSON.stringify(cart)}`);
  }
});

test("disabled flag zeroes everything (dormant safety)", () => {
  // The exported constant is frozen, so simulate the disabled path by
  // contract: when ENABLED is false the function must return 0. We
  // can't flip the flag at runtime; assert the guard clause exists by
  // checking behavior consistency instead — if this test ever runs
  // with ENABLED false, the math must go quiet.
  if (!BUNDLE_DISCOUNT.ENABLED) {
    assert.equal(bundleDiscountCents(5, 10000), 0);
    assert.equal(browserLib.bundleSavingsForCart([{ qty: 5 }], 100).cents, 0);
  } else {
    assert.ok(bundleDiscountCents(2, 10000) > 0, "enabled promo must discount a 2-unit cart");
  }
});
