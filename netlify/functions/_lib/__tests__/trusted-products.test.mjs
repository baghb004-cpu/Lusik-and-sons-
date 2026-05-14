// Tests for TRUSTED_PRODUCTS — the single server-side source of truth
// for what a customer can actually buy. If this drifts from the
// browser's cart-id shapes, blanket checkout 400s with "Unknown
// product key" — the exact bug we hit during the May 2026 session.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TRUSTED_PRODUCTS } from "../trusted-products.mjs";

test("TRUSTED_PRODUCTS has at least one entry", () => {
  assert.ok(Object.keys(TRUSTED_PRODUCTS).length > 0, "TRUSTED_PRODUCTS is empty");
});

test("every entry has name (string), variant (string), priceCents (positive integer)", () => {
  for (const [key, p] of Object.entries(TRUSTED_PRODUCTS)) {
    assert.equal(typeof p.name, "string", `${key}: name not a string`);
    assert.ok(p.name.length > 0, `${key}: name empty`);
    assert.equal(typeof p.variant, "string", `${key}: variant not a string`);
    assert.equal(typeof p.priceCents, "number", `${key}: priceCents not a number`);
    assert.ok(Number.isInteger(p.priceCents), `${key}: priceCents not an integer (was ${p.priceCents})`);
    assert.ok(p.priceCents > 0, `${key}: priceCents must be positive (was ${p.priceCents})`);
    assert.ok(p.priceCents < 1_000_00, `${key}: priceCents suspiciously large — typo? (was ${p.priceCents})`);
  }
});

test("keys match the expected browser cart-id shape", () => {
  // The browser's mapLegacyId in CheckoutView either passes the literal
  // productKey from the cart item (set by addToCart / addCustomToCart)
  // or maps a legacy id by slicing the layout suffix. Both code paths
  // produce keys matching this pattern. If a new product is added with
  // a different shape, this test fails loudly so the trusted map and
  // the cart-id generator stay in sync.
  const pattern = /^(blanket-[a-z0-9_-]+|bib)$/;
  for (const key of Object.keys(TRUSTED_PRODUCTS)) {
    assert.match(key, pattern, `key "${key}" doesn't match expected productKey shape`);
  }
});

test("'blanket-double_diag_br' exists (the live blanket SKU)", () => {
  assert.ok(
    TRUSTED_PRODUCTS["blanket-double_diag_br"],
    "the canonical blanket layout's trusted entry is missing"
  );
});

test("'bib' exists (the live bib SKU)", () => {
  assert.ok(TRUSTED_PRODUCTS["bib"], "the bib trusted entry is missing");
});
