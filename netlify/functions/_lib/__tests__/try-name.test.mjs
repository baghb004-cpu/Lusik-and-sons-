// ============================================================
// TRY A NAME
// ============================================================
// The field on a shop card that carries a typed name into the product
// page. What it lets through is what a customer will see stitched, so
// the rules are worth holding still.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  TRY_NAME_MAX, TRY_NAME_PRODUCTS, acceptsTryName, readTryName, sanitizeTryName, tryNameHref,
} from "../../../../src/lib/tryName.js";
import { CUSTOM_PRODUCTS } from "../../../../src/data/customProducts.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = (p) => resolve(here, "../../../../", p);

// Անի, the Armenian for the name the poster is stitched with.
const ANI_HY = "Անի";

test("the limit is the one the bib actually holds", () => {
  // Four copies of "6" would otherwise drift: this one, the bib config,
  // and the blanket's two custom-line inputs.
  // CUSTOM_PRODUCTS is keyed by the TRUSTED key ("bib"); the catalog key
  // for the same product is "bib-single".
  const bib = CUSTOM_PRODUCTS.bib;
  assert.ok(bib, "the Custom Name Bib is no longer in CUSTOM_PRODUCTS under the key \"bib\"");
  assert.equal(TRY_NAME_MAX, bib.maxNameLength ?? 6,
    "TRY_NAME_MAX and the bib's maxNameLength disagree, so a card would offer letters the bib cannot hold");
});

test("the blanket's own name inputs accept the same length", () => {
  const src = readFileSync(root("src/components/ProductShowcase.jsx"), "utf8");
  const lengths = [...src.matchAll(/maxLength=\{(\d+)\}/g)].map((m) => Number(m[1]));
  assert.ok(lengths.length >= 2, "the blanket's two custom-line inputs are not where this test expects them");
  for (const len of lengths) {
    assert.equal(len, TRY_NAME_MAX,
      `a custom-line input accepts ${len} characters while a card offers ${TRY_NAME_MAX}`);
  }
});

test("only the two products a customer configures accept a name", () => {
  assert.deepEqual([...TRY_NAME_PRODUCTS].sort(), ["bib-single", "blanket-alphabet"]);
  assert.equal(acceptsTryName("bib-hy-em"), false,
    "Hye Em Yes says its own three words — there is no name to type into it");
  assert.equal(acceptsTryName("bib-days-of-week"), false);
  assert.equal(acceptsTryName(undefined), false);
});

test("it keeps Armenian and Latin, and drops what cannot be stitched", () => {
  assert.equal(sanitizeTryName("Ani"), "Ani");
  assert.equal(sanitizeTryName(ANI_HY), ANI_HY);
  assert.equal(sanitizeTryName("Zoé"), "Zoé");     // an accent survives
  assert.equal(sanitizeTryName("O'Hara"), "O'Hara");
  assert.equal(sanitizeTryName("Anne-Marie", 12), "Anne-Marie");
  assert.equal(sanitizeTryName("Ani123"), "Ani");
  assert.equal(sanitizeTryName("<script>"), "script");
  // Whitespace of any kind collapses to a space rather than vanishing,
  // which would weld two words together.
  assert.equal(sanitizeTryName("A n\ni"), "A n i");
});

test("it caps at the limit rather than accepting and truncating later", () => {
  assert.equal(sanitizeTryName("Anahit").length, 6);
  assert.equal(sanitizeTryName("Anahit Grigoryan"), "Anahit");
  assert.equal(sanitizeTryName("Ani", 2), "An");
});

test("a trailing space survives so typing does not fight the field", () => {
  // Someone midway through "Ani M" has a trailing space. Eating it means
  // the space never appears and the field feels broken.
  assert.equal(sanitizeTryName("Ani "), "Ani ");
  assert.equal(sanitizeTryName("   Ani"), "Ani");
});

test("the href carries the name and an empty one carries nothing", () => {
  assert.equal(tryNameHref("/shop/bibs/baby-bib", "Ani"), "/shop/bibs/baby-bib?name=Ani");
  assert.equal(tryNameHref("/shop/bibs/baby-bib", "   "), "/shop/bibs/baby-bib");
  assert.equal(tryNameHref("/shop/bibs/baby-bib", "Ani "), "/shop/bibs/baby-bib?name=Ani");
  // Armenian has to survive the round trip, which is the whole point.
  const href = tryNameHref("/p", ANI_HY);
  assert.equal(readTryName(new URL(href, "https://x").search), ANI_HY);
});

test("a malformed query string never stops a product page mounting", () => {
  assert.equal(readTryName(undefined), "");
  assert.equal(readTryName("?name="), "");
  assert.equal(readTryName("?other=1"), "");
  // URLSearchParams does not throw on a broken percent-escape; it hands
  // back what it can. Whatever that is, it goes through the same filter
  // as anything else and cannot reach the page as markup.
  assert.doesNotThrow(() => readTryName("?name=%E0%A4%A"));
  assert.doesNotThrow(() => readTryName("?name=%"));
  // The angle brackets and the equals sign are gone, and what is left
  // is cut to six letters like any other name.
  assert.equal(readTryName("?name=%3Cimg%20src%3Dx%3E"), "img sr");
});
