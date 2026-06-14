import { test } from "node:test";
import assert from "node:assert/strict";

import { blockSchema } from "../schema/index.ts";
import { validateCommerceRefs, resolveProductRef, type CatalogSnapshot } from "../engine/commerce.ts";
import { INSERTABLE_TYPES, newDefaultBlock, defaultProductRef } from "../editor/newBlock.ts";
import { validatePage } from "../engine/index.ts";
import { makePage } from "./fixtures.ts";

const catalog: CatalogSnapshot = {
  bibs: [
    { slug: "baby-bib", name: "The Custom Name Bib", status: "live", priceFrom: 22, coverImage: "/img/x.jpg" },
    { slug: "hye-bib", name: "Hye Bib", status: "live", priceFrom: 20 },
    { slug: "future-bib", name: "Future Bib", status: "placeholder", priceFrom: null },
  ],
  blankets: [{ slug: "alphabet-blanket", name: "Alphabet Blanket", status: "live", priceFrom: 65 }],
};

const block = (type: string, props: unknown) => ({ id: "b_commerce0001", type, props });

test("commerce schemas: refs validated, no price fields exist to drift", () => {
  assert.equal(blockSchema.safeParse(block("productCard", { product: "bibs/baby-bib" })).success, true);
  assert.equal(blockSchema.safeParse(block("productCard", { product: "not-a-ref" })).success, false);
  // structurally price-proof: a price prop is rejected outright (strict schema)
  assert.equal(blockSchema.safeParse(block("productCard", { product: "bibs/baby-bib", price: 5 })).success, false);
  assert.equal(blockSchema.safeParse(block("buyBox", { product: "bibs/baby-bib", ctaLabel: "Buy" })).success, true);
  assert.equal(blockSchema.safeParse(block("featuredProduct", { binding: "cms:featured" })).success, true);
  assert.equal(blockSchema.safeParse(block("productGrid", { category: "bibs", columns: 3 })).success, true);
});

test("swatchRow: inline swatches validated; needs swatches OR a product", () => {
  assert.equal(
    blockSchema.safeParse(
      block("swatchRow", { layout: "horizontal", swatches: [{ id: "b_sw0000000001", color: "#B08842", name: "Gold" }] })
    ).success,
    true
  );
  assert.equal(blockSchema.safeParse(block("swatchRow", { layout: "horizontal" })).success, false);
  assert.equal(blockSchema.safeParse(block("swatchRow", { layout: "horizontal", product: "bibs/baby-bib" })).success, true);
  assert.equal(
    blockSchema.safeParse(
      block("swatchRow", { layout: "horizontal", swatches: [{ id: "b_sw0000000001", color: "not-hex", name: "x" }] })
    ).success,
    false
  );
});

test("gallery: explicit images or a product binding", () => {
  assert.equal(blockSchema.safeParse(block("gallery", { product: "bibs/baby-bib", layout: "grid" })).success, true);
  assert.equal(blockSchema.safeParse(block("gallery", { layout: "grid" })).success, false);
});

test("resolveProductRef walks category/slug", () => {
  assert.equal(resolveProductRef(catalog, "bibs/baby-bib")?.name, "The Custom Name Bib");
  assert.equal(resolveProductRef(catalog, "bibs/nope"), null);
  assert.equal(resolveProductRef(catalog, "towels/baby-bib"), null);
});

test("THE BINDING GATE: unknown products are errors; buyBox demands live", () => {
  const page = makePage();
  page.sections.push(
    { id: "b_okcard000001", type: "productCard", props: { product: "bibs/baby-bib" } },
    { id: "b_ghost0000001", type: "productCard", props: { product: "bibs/ghost" } },
    { id: "b_soonbuy00001", type: "buyBox", props: { product: "bibs/future-bib" } },
    { id: "b_sooncard0001", type: "productCard", props: { product: "bibs/future-bib" } }
  );
  assert.equal(validatePage(page).publishable, true, "schema level is fine");
  const issues = validateCommerceRefs(page.sections, catalog);
  const byCode = (c: string) => issues.filter((i) => i.code === c);
  assert.equal(byCode("unknown_product").length, 1);
  assert.equal(byCode("unknown_product")[0].level, "error");
  assert.equal(byCode("buybox_not_live").length, 1);
  assert.equal(byCode("buybox_not_live")[0].level, "error");
  assert.equal(byCode("product_not_live").length, 1);
  assert.equal(byCode("product_not_live")[0].level, "warning"); // coming-soon card is legitimate
});

test("productGrid category must exist; cms:featured passes through", () => {
  const page = makePage();
  page.sections.push(
    { id: "b_grid00000001", type: "productGrid", props: { category: "towels" } },
    { id: "b_feat00000001", type: "featuredProduct", props: { binding: "cms:featured" } }
  );
  const issues = validateCommerceRefs(page.sections, catalog);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "unknown_category");
});

test("every insertable default is schema-valid and binds to a live product", () => {
  assert.equal(defaultProductRef(catalog), "bibs/baby-bib");
  for (const type of INSERTABLE_TYPES) {
    const b = newDefaultBlock(type, catalog);
    const result = blockSchema.safeParse(b);
    assert.equal(result.success, true, `${type}: ${JSON.stringify(!result.success && result.error.issues)}`);
    const commerceIssues = validateCommerceRefs([b], catalog).filter((i) => i.level === "error");
    assert.deepEqual(commerceIssues, [], type);
  }
});
