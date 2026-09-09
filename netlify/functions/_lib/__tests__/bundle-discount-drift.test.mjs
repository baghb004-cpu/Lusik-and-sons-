// ============================================================
// Bundle-discount drift + math guard
// ============================================================
// The bundle promo lives twice on purpose:
//   - Server: _lib/bundle-discount.mjs — what Stripe checkout charges
//     (integer reductions on the line-item prices, so the hosted page
//     keeps its promotion-code field for the shop's printed coupons).
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
import { readFileSync } from "node:fs";
import {
  BUNDLE_DISCOUNT,
  MIN_UNIT_CENTS,
  cartUnitCount,
  bundleDiscountCents,
  allocateBundleDiscount,
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

// ============================================================
// Allocation — the savings become real line-item prices
// ============================================================

const CARTS = [
  { name: "blanket + bib, one each",   lines: [{ unitCents: 6500, qty: 1 }, { unitCents: 2200, qty: 1 }] },
  { name: "three bibs on one line",    lines: [{ unitCents: 2200, qty: 3 }] },
  { name: "two bibs + a blanket",      lines: [{ unitCents: 2200, qty: 2 }, { unitCents: 6500, qty: 1 }] },
  { name: "single item",               lines: [{ unitCents: 2000, qty: 1 }] },
  { name: "empty bag",                 lines: [] },
  { name: "malformed rows",            lines: [{ unitCents: 0, qty: 0 }, {}] },
  { name: "big bag hits the cap",      lines: [{ unitCents: 6500, qty: 99 }] },
];

test("allocation never charges more than the ideal discount, nor takes a unit below the floor", () => {
  for (const { name, lines } of CARTS) {
    const a = allocateBundleDiscount(lines);
    assert.ok(a.totalCents <= a.targetCents, `${name}: allocated more than the target`);
    assert.ok(a.totalCents >= 0, `${name}: negative allocation`);
    assert.ok(Number.isInteger(a.perUnitCents), `${name}: fractional per-unit reduction`);
    // Recompute the charged subtotal the way checkout does.
    let charged = 0;
    lines.forEach((l, i) => {
      const qty = Number.isInteger(l?.qty) && l.qty > 0 ? Math.min(99, l.qty) : 1;
      const unit = Number.isInteger(l?.unitCents) && l.unitCents > 0 ? l.unitCents : 0;
      const cut = a.perUnitCents + (i === a.extraLineIndex ? a.extraCents : 0);
      const reduced = unit - cut;
      charged += (unit > 0 && reduced >= MIN_UNIT_CENTS ? reduced : unit) * qty;
    });
    if (a.subtotalCents > 0) {
      assert.equal(a.subtotalCents - charged, a.totalCents,
        `${name}: line reductions do not add up to the reported savings`);
    }
  }
});

test("allocation is exact whenever the savings divide evenly, and the remainder rides a single-unit line", () => {
  // 2 units, $1.00 off -> 50c from each unit, exactly.
  const pair = allocateBundleDiscount([{ unitCents: 6500, qty: 1 }, { unitCents: 2200, qty: 1 }]);
  assert.equal(pair.targetCents, 100);
  assert.equal(pair.perUnitCents, 50);
  assert.equal(pair.totalCents, 100);

  // 3 units on ONE line: 200 / 3 leaves 2c that no single-unit line can take.
  const three = allocateBundleDiscount([{ unitCents: 2200, qty: 3 }]);
  assert.equal(three.targetCents, 200);
  assert.equal(three.perUnitCents, 66);
  assert.equal(three.extraLineIndex, -1);
  assert.equal(three.totalCents, 198, "customer keeps the 2c rather than the shop over-discounting");

  // Same 3 units, but one line holds a single piece: that line absorbs the 2c.
  const mixed = allocateBundleDiscount([{ unitCents: 2200, qty: 2 }, { unitCents: 6500, qty: 1 }]);
  assert.equal(mixed.extraLineIndex, 1);
  assert.equal(mixed.extraCents, 2);
  assert.equal(mixed.totalCents, 200, "the exact target when a single-unit line exists");
});

test("browser and server allocate identically", () => {
  for (const { name, lines } of CARTS) {
    assert.deepEqual(
      browserLib.allocateBundleDiscount(lines),
      allocateBundleDiscount(lines),
      `allocation drift for ${name}`,
    );
  }
});

test("the bag's savings row shows what Stripe will actually charge", () => {
  const cart = [{ price: 22, qty: 3 }];
  const lines = browserLib.cartLines(cart);
  const alloc = allocateBundleDiscount(lines);
  const shown = browserLib.bundleSavingsForCart(cart, 66);
  assert.equal(shown.cents, alloc.totalCents, "the row must not promise more than checkout charges");
  assert.equal(shown.units, 3);
});

test("checkout keeps the promotion-code field on every session", () => {
  // The shop mails printed coupon codes with every order, so a session
  // must never set `discounts` (Stripe forbids pairing it with
  // allow_promotion_codes). Guarded here because the failure is silent:
  // the field just disappears for multi-item carts.
  const src = readFileSync(new URL("../../create-checkout-session.mjs", import.meta.url), "utf8");
  assert.match(src, /allow_promotion_codes:\s*true/, "promotion codes must be enabled");
  assert.equal(/^\s*discounts:/m.test(src), false, "a session must not attach a discounts array");
  assert.equal(/stripe\.coupons\./.test(src), false, "the bundle savings no longer use a Stripe coupon");
});
