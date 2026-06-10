// ============================================================
// productPathForCartItem — cart item → PDP path resolution
// ============================================================
// Tapping a bag item jumps to its product page; this guards the
// cart-key → catalog-path translation (with-cap variants collapse
// to the base product, "bib" → the name bib, blanket layout keys →
// the main Armenian Alphabet Blanket, unknown → /shop, never a 404).
// ============================================================
import { test } from "node:test";
import assert from "node:assert/strict";

const { productPathForCartItem } = await import("../../../../src/lib/productUrl.js");
const { CATALOG } = await import("../../../../src/data/catalog.js");

test("every live catalog product resolves to its own canonical path by key", () => {
  const categories = Array.isArray(CATALOG) ? CATALOG : Object.values(CATALOG);
  for (const cat of categories) {
    for (const p of cat.products || []) {
      if (p.status !== "live") continue;
      const path = productPathForCartItem({ productKey: p.key });
      assert.equal(path, `/shop/${cat.slug}/${p.slug}`, `wrong path for catalog key ${p.key}`);
    }
  }
});

test("checkout productKeys that differ from catalog keys translate correctly", () => {
  const cases = [
    // -with-cap variants land on the base product's page
    [{ productKey: "bib-hy-em-with-cap" },             "/shop/bibs/hy-em-armenian-bib"],
    [{ productKey: "bib-bari-akhorzhak-set-with-cap" },"/shop/bibs/bari-akhorzhak-bib-burp-cloth-set"],
    // the trusted "bib" key is the catalog's "bib-single" (name bib)
    [{ productKey: "bib" },                            "/shop/bibs/baby-bib"],
    // blanket layout keys are variants of the main alphabet blanket
    [{ productKey: "blanket-double_diag_br" },         "/shop/blankets/armenian-alphabet-blanket"],
    [{ productKey: "blanket-full-alphabet" },          "/shop/blankets/full-alphabet-crib-blanket"],
  ];
  for (const [item, expected] of cases) {
    assert.equal(productPathForCartItem(item), expected, JSON.stringify(item));
  }
});

test("legacy rows without productKey resolve from the cart-id prefix", () => {
  assert.equal(
    productPathForCartItem({ id: "blanket-armenian-double_diag_br-310-321" }),
    "/shop/blankets/armenian-alphabet-blanket",
  );
  assert.equal(
    productPathForCartItem({ id: "bib-Emma-pink-0" }),
    "/shop/bibs/baby-bib",
  );
});

test("unresolvable items fall back to /shop (never a dead click)", () => {
  assert.equal(productPathForCartItem({}), "/shop");
  assert.equal(productPathForCartItem(null), "/shop");
  assert.equal(productPathForCartItem({ productKey: "gift-wrap" }), "/shop");
  assert.equal(productPathForCartItem({ id: "mystery-thing" }), "/shop");
});
