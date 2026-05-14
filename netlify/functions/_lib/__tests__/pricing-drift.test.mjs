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
