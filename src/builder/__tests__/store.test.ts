// Store Manager (§30, Phase 4): the offline business engine — search, barcode
// lookup, order recording + stock movement, purchase history, low-stock,
// retention, anonymize/delete, CSV reports, and validated backup/restore.
import { test } from "node:test";
import assert from "node:assert/strict";

import { emptyStore, storeSchema, type Store } from "../studio/store/schemas.ts";
import {
  searchCustomers, lookupByBarcode, lowStock, recordOrder, purchaseHistory, customerTotals,
  adjustStock, anonymizeCustomer, deleteCustomer, orderTotalCents, applyRetention,
} from "../studio/store/engine.ts";
import { customersCsv, ordersCsv, serializeStore, parseStoreBackup } from "../studio/store/io.ts";

function seed(): Store {
  return storeSchema.parse({
    settings: { storeName: "Gohar's", retention: "5y" },
    customers: [
      { id: "c1", firstName: "Ana", lastName: "K", phone: "555-1111", email: "ana@x.com", createdAt: "2026-01-01" },
      { id: "c2", firstName: "Bo", lastName: "L", phone: "555-2222", email: "bo@x.com", createdAt: "2026-02-01" },
    ],
    products: [
      { id: "p1", name: "Blue Scarf", sku: "SC-1", barcode: "0001", priceCents: 2500, stock: 5, reorderThreshold: 2 },
      { id: "p2", name: "Red Hat", sku: "HT-1", barcode: "0002", priceCents: 1800, stock: 1, reorderThreshold: 3 },
    ],
  });
}

test("search finds customers by name / phone / email", () => {
  const s = seed();
  assert.equal(searchCustomers(s, "ana").length, 1);
  assert.equal(searchCustomers(s, "555-2222")[0].id, "c2");
  assert.equal(searchCustomers(s, "x.com").length, 2);
  assert.equal(searchCustomers(s, "").length, 2);
});

test("barcode lookup hits product / customer / none", () => {
  const s = seed();
  assert.equal(lookupByBarcode(s, "0001").product?.id, "p1");
  assert.equal(lookupByBarcode(s, "SC-1").product?.id, "p1"); // sku also works
  assert.equal(lookupByBarcode(s, "555-1111").customer?.id, "c1");
  assert.equal(lookupByBarcode(s, "nope").kind, "none");
});

test("recording an order decrements stock, logs a movement, and stamps the visit", () => {
  const s = seed();
  const order = { id: "o1", customerId: "c1", date: "2026-06-13", items: [{ productId: "p1", name: "Blue Scarf", qty: 2, unitPriceCents: 2500 }], discountCents: 0, taxCents: 0, paymentMethodLabel: "Cash", notes: "", receiptNumber: "R1", source: "in-store" as const };
  const next = recordOrder(s, order, "2026-06-13T10:00:00Z");
  assert.equal(next.products.find((p) => p.id === "p1")!.stock, 3); // 5 - 2
  assert.equal(next.movements.length, 1);
  assert.equal(next.movements[0].delta, -2);
  assert.equal(next.customers.find((c) => c.id === "c1")!.lastVisit, "2026-06-13T10:00:00Z");
  assert.equal(next.orders.length, 1);
  assert.equal(s.products[0].stock, 5); // input untouched
  // totals + history
  assert.equal(orderTotalCents(order), 5000);
  assert.equal(purchaseHistory(next, "c1").length, 1);
  assert.equal(customerTotals(next, "c1").spentCents, 5000);
});

test("low-stock flags items at/under their reorder threshold", () => {
  const s = seed();
  const low = lowStock(s);
  assert.equal(low.length, 1); // Red Hat: stock 1 <= 3
  assert.equal(low[0].id, "p2");
  const adjusted = adjustStock(s, "p2", 10, "restock", "2026-06-13T10:00:00Z");
  assert.equal(lowStock(adjusted).length, 0);
  assert.equal(adjusted.movements[adjusted.movements.length - 1].delta, 10);
});

test("anonymize keeps orders; delete detaches them; both privacy-safe", () => {
  let s = recordOrder(seed(), { id: "o1", customerId: "c1", date: "2026-06-13", items: [], discountCents: 0, taxCents: 0, paymentMethodLabel: "", notes: "", receiptNumber: "", source: "in-store" }, "2026-06-13T10:00:00Z");
  const anon = anonymizeCustomer(s, "c1");
  assert.equal(anon.customers.find((c) => c.id === "c1")!.firstName, "Removed");
  assert.equal(anon.customers.find((c) => c.id === "c1")!.phone, "");
  assert.equal(purchaseHistory(anon, "c1").length, 1); // history kept
  const del = deleteCustomer(s, "c1");
  assert.equal(del.customers.find((c) => c.id === "c1"), undefined);
  assert.equal(del.orders[0].customerId, ""); // detached to guest
});

test("retention drops orders older than the window; 'forever' keeps all", () => {
  const s = storeSchema.parse({ orders: [{ id: "old", customerId: "c1", date: "2018-01-01", items: [], source: "in-store" }, { id: "new", customerId: "c1", date: "2026-01-01", items: [], source: "in-store" }] });
  const kept = applyRetention(s, "2026-06-13T00:00:00Z"); // 5y window
  assert.deepEqual(kept.orders.map((o) => o.id), ["new"]);
  const forever = applyRetention({ ...s, settings: { ...s.settings, retention: "forever" } }, "2026-06-13T00:00:00Z");
  assert.equal(forever.orders.length, 2);
});

test("CSV reports never leak card data; backup round-trips + rejects foreign files", () => {
  const s = seed();
  assert.ok(customersCsv(s).includes("Ana"));
  assert.ok(ordersCsv(s).includes("Payment (label)")); // a label column, not card data
  const json = serializeStore(s);
  const back = parseStoreBackup(json);
  assert.equal(back.customers.length, 2);
  assert.equal(back.products.length, 2);
  assert.throws(() => parseStoreBackup("nope"), /valid JSON/);
  assert.throws(() => parseStoreBackup(JSON.stringify({ app: "something" })), /Store Manager backup/);
});

test("emptyStore is schema-valid", () => {
  storeSchema.parse(emptyStore());
});
