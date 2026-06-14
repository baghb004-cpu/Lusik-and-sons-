// Store Manager reports (§30, Phase 5): the XLSX generator + the report set
// (CSV/XLSX/print). Pure + local; no card data anywhere.
import { test } from "node:test";
import assert from "node:assert/strict";

import { storeSchema, type Store } from "../studio/store/schemas.ts";
import { xlsxParts, colLetter } from "../studio/store/xlsx.ts";
import { STORE_REPORTS, reportHtml } from "../studio/store/reports.ts";

function seed(): Store {
  return storeSchema.parse({
    settings: { storeName: "Gohar's" },
    customers: [{ id: "c1", firstName: "Ana", lastName: "K", phone: "555", email: "a@x.com", createdAt: "2026-01-01" }],
    products: [{ id: "p1", name: "Scarf", sku: "S1", barcode: "001", priceCents: 2500, stock: 1, reorderThreshold: 3 }],
    orders: [{ id: "o1", customerId: "c1", date: "2026-06-13", items: [{ productId: "p1", name: "Scarf", qty: 2, unitPriceCents: 2500 }], discountCents: 0, taxCents: 0, paymentMethodLabel: "Cash", notes: "", receiptNumber: "R1", source: "in-store" }],
  });
}

test("colLetter maps columns correctly", () => {
  assert.equal(colLetter(0), "A");
  assert.equal(colLetter(25), "Z");
  assert.equal(colLetter(26), "AA");
});

test("xlsxParts builds a valid-shaped workbook with the data inside", () => {
  const files = xlsxParts([{ name: "Customers", headers: ["Name", "Spent"], rows: [["Ana", 25], ["Bo", 18.5]] }]);
  for (const f of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/worksheets/sheet1.xml"]) {
    assert.ok(files[f], `has ${f}`);
  }
  const sheet = files["xl/worksheets/sheet1.xml"];
  assert.ok(sheet.includes("<t xml:space=\"preserve\">Name</t>")); // header inline string
  assert.ok(sheet.includes("<v>25</v>")); // numeric cell
  assert.ok(files["xl/workbook.xml"].includes('name="Customers"'));
  // sheet name sanitized + capped to 31 chars
  const bad = xlsxParts([{ name: "Bad:Name/With*Chars and a really long title beyond limit", headers: [], rows: [] }]);
  const name = /name="([^"]*)"/.exec(bad["xl/workbook.xml"])![1];
  assert.ok(name.length <= 31 && !/[:/*]/.test(name));
});

test("the standard report set builds, with totals and a low-stock flag", () => {
  const s = seed();
  const byId = Object.fromEntries(STORE_REPORTS.map((r) => [r.id, r.build(s)]));
  assert.ok(byId.customers.rows.length === 1 && byId.customers.rows[0].includes("Ana"));
  assert.equal(byId["low-stock"].rows.length, 1); // Scarf stock 1 <= 3
  assert.ok(byId.sales.rows.some((r) => r[0] === "Total sales ($)"));
  // print HTML escapes + omits card data
  const html = reportHtml(byId.orders, "Gohar's");
  assert.ok(html.includes("<table") && html.includes("Payment (label)"));
  assert.ok(/no payment card data/i.test(html));
});
