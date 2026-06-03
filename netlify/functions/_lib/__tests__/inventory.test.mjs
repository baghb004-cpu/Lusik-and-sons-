// Tests for the handmade-stock safety cap (_lib/inventory.mjs).
// The overselling guard is security-relevant: if it under-counts,
// the shop oversells Lusik's time; if it mis-groups cap variants,
// a product can be bought past its real limit.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_STOCK_LIMIT,
  inventoryGroup,
  limitForGroup,
  soldByGroup,
  remainingFor,
  availabilitySnapshot,
  findInventoryViolation,
} from "../inventory.mjs";

// A tiny fake `sql` tagged-template that returns canned order_items
// rows, so these tests need no database.
function fakeSql(rows) {
  return async () => rows;
}

test("inventoryGroup strips the -with-cap suffix so variants share a pool", () => {
  assert.equal(inventoryGroup("bib-hy-em"), "bib-hy-em");
  assert.equal(inventoryGroup("bib-hy-em-with-cap"), "bib-hy-em");
  assert.equal(inventoryGroup("bib-bari-akhorzhak-set-with-cap"), "bib-bari-akhorzhak-set");
  assert.equal(inventoryGroup("blanket-full-alphabet"), "blanket-full-alphabet");
  assert.equal(inventoryGroup(null), null);
});

test("limitForGroup defaults to DEFAULT_STOCK_LIMIT", () => {
  assert.equal(limitForGroup("bib"), DEFAULT_STOCK_LIMIT);
  assert.equal(DEFAULT_STOCK_LIMIT, 5);
});

test("soldByGroup folds cap-variant sales into the base group", async () => {
  const sql = fakeSql([
    { product_key: "bib-hy-em", sold: 2 },
    { product_key: "bib-hy-em-with-cap", sold: 1 },
    { product_key: "bib", sold: 4 },
  ]);
  const map = await soldByGroup(sql);
  assert.equal(map.get("bib-hy-em"), 3); // 2 + 1 cap variant
  assert.equal(map.get("bib"), 4);
});

test("remainingFor floors at zero and respects the limit", () => {
  const sold = new Map([["bib-hy-em", 7]]); // oversold beyond 5
  assert.equal(remainingFor("bib-hy-em", sold), 0);
  assert.equal(remainingFor("bib", new Map([["bib", 1]])), 4);
  assert.equal(remainingFor("bib", new Map()), 5);
});

test("availabilitySnapshot reports soldOut at the limit", async () => {
  const sql = fakeSql([
    { product_key: "bib-hy-em", sold: 4 },
    { product_key: "bib-hy-em-with-cap", sold: 1 }, // group total = 5 = limit
  ]);
  const snap = await availabilitySnapshot(sql);
  assert.equal(snap["bib-hy-em"].remaining, 0);
  assert.equal(snap["bib-hy-em"].soldOut, true);
  // A product with no sales is fully available.
  assert.equal(snap["bib"].remaining, 5);
  assert.equal(snap["bib"].soldOut, false);
});

test("findInventoryViolation blocks a cart that exceeds remaining", async () => {
  const sql = fakeSql([{ product_key: "bib-days-of-week", sold: 4 }]); // 1 left
  // Asking for 2 when only 1 remains → violation.
  const v = await findInventoryViolation(sql, [
    { productKey: "bib-days-of-week", qty: 2 },
  ]);
  assert.ok(v, "expected a violation");
  assert.equal(v.group, "bib-days-of-week");
  assert.equal(v.remaining, 1);
});

test("findInventoryViolation counts a base + cap variant against one pool", async () => {
  const sql = fakeSql([{ product_key: "bib-hy-em", sold: 4 }]); // 1 left in the pool
  // One base bib + one bib+cap = 2 requested against 1 remaining → block.
  const v = await findInventoryViolation(sql, [
    { productKey: "bib-hy-em", qty: 1 },
    { productKey: "bib-hy-em-with-cap", qty: 1 },
  ]);
  assert.ok(v, "expected a violation across the shared pool");
  assert.equal(v.group, "bib-hy-em");
  assert.equal(v.remaining, 1);
});

test("findInventoryViolation allows a cart that fits", async () => {
  const sql = fakeSql([{ product_key: "bib", sold: 1 }]); // 4 left
  const v = await findInventoryViolation(sql, [{ productKey: "bib", qty: 3 }]);
  assert.equal(v, null);
});
