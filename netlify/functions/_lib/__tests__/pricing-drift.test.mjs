// ============================================================
// Pricing drift guard
// ============================================================
// The numbers in _lib/pricing.mjs exist twice on purpose:
//   - Once on the server (this module) — used by Stripe checkout
//     line items and webhook subtotal accounting.
//   - Once in the browser, as CONFIG.FREE_SHIPPING_THRESHOLD_CENTS
//     and CONFIG.GIFT_WRAP_PRICE_CENTS in index.html.
//
// The browser can't import server modules, and shipping the
// server module to the browser would mean shipping the rest of
// netlify/functions/ with it. So we keep two literals and rely
// on this test to catch drift.
//
// When this test fails: open index.html, find the CONFIG.* line
// the error mentions, and update it to match _lib/pricing.mjs
// (or vice versa). Commit both files together.
// ============================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  FREE_SHIPPING_THRESHOLD_CENTS,
  GIFT_WRAP_PRICE_CENTS,
} from "../pricing.mjs";

// Post-Vite-migration the browser's CONFIG lives in src/data/config.js
// instead of inline in index.html. Resolve relative to this test file so
// the test runs from any cwd (npm test, npx node --test, IDE runner).
const HERE = dirname(fileURLToPath(import.meta.url));
const BROWSER_CONFIG_PATH = resolve(HERE, "../../../../src/data/config.js");
const browserConfig = readFileSync(BROWSER_CONFIG_PATH, "utf8");

function extractConfigNumber(key) {
  // Match `KEY: 12345,` or `KEY: 12345` with optional whitespace.
  // The CONFIG block uses `KEY: value,` shape consistently.
  const re = new RegExp(`\\b${key}:\\s*(\\d+)`);
  const m = browserConfig.match(re);
  return m ? Number(m[1]) : null;
}

test("FREE_SHIPPING_THRESHOLD_CENTS matches CONFIG in src/data/config.js", () => {
  const browserValue = extractConfigNumber("FREE_SHIPPING_THRESHOLD_CENTS");
  assert.ok(
    browserValue !== null,
    "CONFIG.FREE_SHIPPING_THRESHOLD_CENTS not found in src/data/config.js — did the key get renamed?"
  );
  assert.equal(
    browserValue,
    FREE_SHIPPING_THRESHOLD_CENTS,
    `Pricing drift: server says ${FREE_SHIPPING_THRESHOLD_CENTS}, src/data/config.js says ${browserValue}. Update one of them.`
  );
});

test("GIFT_WRAP_PRICE_CENTS matches CONFIG in src/data/config.js", () => {
  const browserValue = extractConfigNumber("GIFT_WRAP_PRICE_CENTS");
  assert.ok(
    browserValue !== null,
    "CONFIG.GIFT_WRAP_PRICE_CENTS not found in src/data/config.js — did the key get renamed?"
  );
  assert.equal(
    browserValue,
    GIFT_WRAP_PRICE_CENTS,
    `Pricing drift: server says ${GIFT_WRAP_PRICE_CENTS}, src/data/config.js says ${browserValue}. Update one of them.`
  );
});

// ============================================================
// Per-SKU pricing drift — the real risk.
// ============================================================
// PRODUCT.layouts[].priceCents (browser display) must match
// TRUSTED_PRODUCTS["blanket-<key>"].priceCents (server-trusted
// for Stripe). Likewise CUSTOM_PRODUCTS.bib.price (in dollars,
// integer) must match TRUSTED_PRODUCTS["bib"].priceCents / 100.
//
// If these drift, the customer sees one price in the UI and is
// charged a different one at Stripe — silent revenue leak or
// silent overcharge. Both are bad.
//
// We dynamic-import the browser data files because they're ESM
// modules that may not coexist with this test in static analysis.
// ============================================================
const { PRODUCT }         = await import("../../../../src/data/product.js");
const { CUSTOM_PRODUCTS } = await import("../../../../src/data/customProducts.js");
const { TRUSTED_PRODUCTS } = await import("../trusted-products.mjs");

test("every enabled PRODUCT.layout has a matching TRUSTED_PRODUCTS entry at the same price", () => {
  for (const layout of PRODUCT.layouts) {
    if (layout.enabled === false) continue; // disabled = not for sale
    const key = `blanket-${layout.key}`;
    const trusted = TRUSTED_PRODUCTS[key];
    assert.ok(
      trusted,
      `Browser shows enabled layout '${layout.key}' but TRUSTED_PRODUCTS['${key}'] is missing — server will reject this SKU.`,
    );
    assert.equal(
      layout.priceCents,
      trusted.priceCents,
      `Pricing drift for '${key}': browser shows ${layout.priceCents}, server trusts ${trusted.priceCents}.`,
    );
  }
});

test("PRODUCT.price (display dollars) matches the cheapest enabled layout / 100", () => {
  // PRODUCT.price is the "starting at" headline. It must equal the
  // minimum priceCents/100 across enabled layouts so the customer
  // doesn't see e.g. "$65" but find no $65 variant exists.
  const enabled = PRODUCT.layouts.filter((l) => l.enabled !== false);
  assert.ok(enabled.length > 0, "No enabled layouts found in PRODUCT.layouts");
  const minDollars = Math.min(...enabled.map((l) => l.priceCents)) / 100;
  assert.equal(
    PRODUCT.price,
    minDollars,
    `PRODUCT.price (${PRODUCT.price}) doesn't match the cheapest enabled layout's priceCents/100 (${minDollars}).`,
  );
});

test("CUSTOM_PRODUCTS entries have matching TRUSTED_PRODUCTS prices", () => {
  for (const [productKey, custom] of Object.entries(CUSTOM_PRODUCTS)) {
    const trusted = TRUSTED_PRODUCTS[productKey];
    assert.ok(
      trusted,
      `CUSTOM_PRODUCTS.${productKey} has no TRUSTED_PRODUCTS entry — server will reject this SKU.`,
    );
    assert.equal(
      custom.price * 100,
      trusted.priceCents,
      `Pricing drift for '${productKey}': browser shows $${custom.price} (${custom.price * 100}¢), server trusts ${trusted.priceCents}¢.`,
    );
  }
});

test("every TRUSTED_PRODUCTS key matches a real browser SKU (no orphans)", () => {
  // The reverse direction — a TRUSTED_PRODUCTS entry that no
  // longer corresponds to a browser SKU isn't actively dangerous,
  // but it's dead weight that drifts further from reality over
  // time. Catching it now keeps the map honest.
  const browserKeys = new Set([
    ...PRODUCT.layouts.filter((l) => l.enabled !== false).map((l) => `blanket-${l.key}`),
    ...Object.keys(CUSTOM_PRODUCTS),
  ]);
  for (const key of Object.keys(TRUSTED_PRODUCTS)) {
    assert.ok(
      browserKeys.has(key),
      `TRUSTED_PRODUCTS['${key}'] has no matching browser SKU. Remove it or re-enable the matching layout.`,
    );
  }
});
