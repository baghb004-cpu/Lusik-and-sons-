import { test } from "node:test";
import assert from "node:assert/strict";

import { validateDocument } from "../server/validateDoc.ts";
import { assertDocPath } from "../storage/index.ts";

// The real server price map — these tests run against the same data the
// build gate and Stripe handoff use, so they break if the contract moves.
import { TRUSTED_PRODUCTS } from "../../../netlify/functions/_lib/trusted-products.mjs";

const liveBib = (priceFrom: number) => ({
  category: "bibs",
  key: "baby-bib",
  slug: "baby-bib",
  name: "The Custom Name Bib",
  tagline: "A bib with their name on it.",
  description: "Hand cross-stitched.",
  status: "live",
  trustedKey: "bib",
  priceFrom,
});

test("content/ paths are valid document paths now", () => {
  assert.equal(assertDocPath("content/products/baby-bib.json"), "content/products/baby-bib.json");
  assert.equal(assertDocPath("content/pages/faq.json"), "content/pages/faq.json");
  assert.throws(() => assertDocPath("content/../netlify/x.json"));
  assert.throws(() => assertDocPath("src/data/config.json"));
});

test("THE MONEY GATE: a live product whose price drifts from Stripe is refused", async () => {
  const trusted = (TRUSTED_PRODUCTS as Record<string, { priceCents: number }>).bib;
  assert.ok(trusted, "trusted-products must still have the bib entry");

  // correct price (to the cent) → saves
  const ok = await validateDocument("content/products/baby-bib.json", liveBib(trusted.priceCents / 100));
  assert.deepEqual(ok, []);

  // $3 drift → the same failure the build would produce
  const drifted = await validateDocument("content/products/baby-bib.json", liveBib(trusted.priceCents / 100 + 3));
  assert.equal(drifted.length, 1);
  assert.equal(drifted[0].code, "build_gate");
  assert.match(drifted[0].message, /does not match trusted-products/);
});

test("a live product with an unknown trustedKey is refused", async () => {
  const issues = await validateDocument("content/products/x.json", { ...liveBib(22), trustedKey: "invented-product" });
  assert.equal(issues[0].code, "build_gate");
  assert.match(issues[0].message, /no entry in trusted-products/);
});

test("placeholders don't need a price; missing required copy is refused", async () => {
  const placeholder = { ...liveBib(22), status: "placeholder", priceFrom: null, trustedKey: undefined };
  assert.deepEqual(await validateDocument("content/products/x.json", placeholder), []);

  const missingTagline = { ...placeholder, tagline: "" };
  const issues = await validateDocument("content/products/x.json", missingTagline);
  assert.equal(issues[0].code, "build_gate");
  assert.match(issues[0].message, /"tagline"/);
});

test("categories run the build validator", async () => {
  assert.deepEqual(
    await validateDocument("content/categories/bibs.json", { slug: "bibs", label: "Bibs", description: "d" }),
    []
  );
  const issues = await validateDocument("content/categories/bibs.json", { slug: "Bad Slug", label: "Bibs", description: "d" });
  assert.equal(issues[0].code, "build_gate");
});

test("page surfaces use their per-file validators; unknown surfaces are refused", async () => {
  assert.deepEqual(
    await validateDocument("content/pages/announcement.json", { enabled: false, message: "", link: "", linkLabel: "" }),
    []
  );
  const enabledEmpty = await validateDocument("content/pages/announcement.json", { enabled: true, message: "" });
  assert.equal(enabledEmpty[0].code, "build_gate");

  const unknown = await validateDocument("content/pages/brand-new-surface.json", {});
  assert.equal(unknown[0].code, "unknown_page");
});

test("paths outside any known family are refused, not silently accepted", async () => {
  const issues = await validateDocument("content/mystery/x.json", {});
  assert.equal(issues[0].code, "unknown_family");
});
