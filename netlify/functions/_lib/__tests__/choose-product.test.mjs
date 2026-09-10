// ============================================================
// THE THREE-QUESTION CHOOSER
// ============================================================
// A recommender a customer acts on. The rule that matters most is the
// deadline one: a piece that cannot be finished in time is removed, not
// ranked lower, and the LONGEST estimate is what decides — quoting the
// optimistic end of a range to keep a product in the running is how a
// christening gift arrives after the christening.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ENGLISH_CAPABLE, LANGUAGE_OPTIONS, SET_KEYS, WHEN_OPTIONS, WHO_OPTIONS,
  chooseProduct, isAnswered,
} from "../../../../src/lib/chooseProduct.js";
import { CONFIG } from "../../../../src/data/config.js";

/** The real shop, shaped the way the chooser takes it. */
const SHOP = [
  { key: "blanket-alphabet", slug: "armenian-alphabet-blanket", categorySlug: "blankets", priceFrom: 65, weeks: [4, 6] },
  { key: "blanket-full-alphabet", slug: "full-alphabet-crib-blanket", categorySlug: "blankets", priceFrom: 245, weeks: [10, 12] },
  { key: "bib-single", slug: "baby-bib", categorySlug: "bibs", priceFrom: 22, weeks: [2, 3] },
  { key: "bib-hy-em", slug: "hy-em-armenian-bib", categorySlug: "bibs", priceFrom: 20, weeks: [2, 3] },
  { key: "bib-days-of-week", slug: "days-of-the-week-bib-set", categorySlug: "bibs", priceFrom: 60, weeks: [5, 6] },
  { key: "bib-anushig-pair", slug: "anushig-bib-set", categorySlug: "bibs", priceFrom: 40, weeks: [3, 4] },
  { key: "bib-bari-akhorzhak-set", slug: "bari-akhorzhak-bib-burp-cloth-set", categorySlug: "bibs", priceFrom: 40, weeks: [3, 4] },
];

test("a deadline removes what cannot be finished, it does not rank it lower", () => {
  const out = chooseProduct(SHOP, { who: "keepsake", when: "soon", language: "either" });
  const named = [out.recommended, ...out.alternatives].filter(Boolean).map((p) => p.key);
  assert.ok(!named.includes("blanket-full-alphabet"),
    "a ten-to-twelve week blanket was offered to someone who needs it in four");
  assert.ok(out.excludedForTime > 0, "nothing was reported as excluded");
});

test("the LONGEST estimate decides, not the shortest", () => {
  // Four weeks needed; a piece quoted at three to five weeks might make
  // it and might not. Offering it is selling a maybe as a yes.
  const risky = [{ key: "x", slug: "x", categorySlug: "bibs", weeks: [3, 5] }];
  assert.equal(chooseProduct(risky, { when: "soon" }).recommended, null);
  const safe = [{ key: "y", slug: "y", categorySlug: "bibs", weeks: [3, 4] }];
  assert.equal(chooseProduct(safe, { when: "soon" }).recommended?.key, "y");
});

test("asking for English never returns a piece that cannot be worked in English", () => {
  for (const who of WHO_OPTIONS.map((o) => o.key)) {
    for (const when of WHEN_OPTIONS.map((o) => o.key)) {
      const out = chooseProduct(SHOP, { who, when, language: "english" });
      for (const p of [out.recommended, ...out.alternatives].filter(Boolean)) {
        assert.ok(ENGLISH_CAPABLE.includes(p.key),
          `${p.key} was offered for an English name and cannot carry one`);
      }
    }
  }
});

test("a keepsake leans to a blanket, everyday to a bib, a gift to a set", () => {
  const keepsake = chooseProduct(SHOP, { who: "keepsake", when: "no_rush", language: "either" });
  assert.equal(keepsake.recommended.categorySlug, "blankets");

  const everyday = chooseProduct(SHOP, { who: "everyday", when: "no_rush", language: "either" });
  assert.equal(everyday.recommended.categorySlug, "bibs");

  const gift = chooseProduct(SHOP, { who: "whole_gift", when: "no_rush", language: "either" });
  assert.ok(SET_KEYS.includes(gift.recommended.key),
    `${gift.recommended.key} is not a set`);
});

test("the same answers always give the same answer", () => {
  const answers = { who: "everyday", when: "months", language: "armenian" };
  const first = chooseProduct(SHOP, answers).recommended.key;
  for (let i = 0; i < 5; i += 1) {
    assert.equal(chooseProduct([...SHOP].reverse(), answers).recommended.key, first,
      "the recommendation depends on the order the shop happens to be in");
  }
});

test("nothing that fits means nothing recommended, not a wrong recommendation", () => {
  const out = chooseProduct(
    [{ key: "blanket-full-alphabet", slug: "x", categorySlug: "blankets", weeks: [10, 12] }],
    { who: "everyday", when: "soon", language: "english" },
  );
  assert.equal(out.recommended, null);
  assert.deepEqual(out.alternatives, []);
});

test("an empty or malformed shop does not throw", () => {
  assert.equal(chooseProduct([], { when: "soon" }).recommended, null);
  assert.equal(chooseProduct(null, {}).recommended, null);
  assert.equal(chooseProduct(undefined, undefined).recommended, null);
  // A product with no lead time is not excluded by a deadline it says
  // nothing about — it is simply unranked on that axis.
  const noWeeks = [{ key: "z", slug: "z", categorySlug: "bibs" }];
  assert.equal(chooseProduct(noWeeks, { when: "soon" }).recommended?.key, "z");
});

test("every key the rules name is a real catalog key", async () => {
  // ENGLISH_CAPABLE and SET_KEYS are written in CATALOG keys. The shop
  // page used to hand the rules `trustedKey ?? key` instead, which
  // coincides today only because trustedKey is not populated on those
  // objects — the moment it is, "blanket-double_diag_br" arrives, matches
  // nothing, and the alphabet blanket drops silently out of every English
  // answer. Nothing would have failed; the shop would just have got
  // quieter.
  const { listCategories } = await import("../../../../src/data/catalog.js");
  const known = new Set();
  for (const category of listCategories()) {
    for (const product of category.products ?? []) known.add(product.key);
  }
  for (const key of [...ENGLISH_CAPABLE, ...SET_KEYS]) {
    // "bib" is the trusted checkout key for the name bib, kept alongside
    // "bib-single" so either shape is recognised.
    if (key === "bib") continue;
    assert.ok(known.has(key), `${key} is not a product key in the catalog`);
  }
});

test("asking for English still leaves something to recommend", async () => {
  // The other direction from the filter test. A rule that removed
  // EVERYTHING would pass a test that only checks the wrong things are
  // absent, and the page would show "nothing fits" to anyone who wants an
  // English name — which is most of the customers.
  for (const who of WHO_OPTIONS.map((o) => o.key)) {
    for (const when of WHEN_OPTIONS.map((o) => o.key)) {
      const out = chooseProduct(SHOP, { who, when, language: "english" });
      assert.ok(out.recommended, `nothing recommended for ${who} / ${when} / english`);
    }
  }
});

test("all three questions must be answered before anything is shown", () => {
  assert.equal(isAnswered({}), false);
  assert.equal(isAnswered({ who: "everyday" }), false);
  assert.equal(isAnswered({ who: "everyday", when: "soon" }), false);
  assert.equal(isAnswered({ who: "everyday", when: "soon", language: "either" }), true);
});

test("the option lists are the ones the copy has strings for", () => {
  assert.deepEqual(WHO_OPTIONS.map((o) => o.key), ["keepsake", "everyday", "whole_gift"]);
  assert.deepEqual(WHEN_OPTIONS.map((o) => o.key), ["soon", "months", "no_rush"]);
  assert.deepEqual(LANGUAGE_OPTIONS.map((o) => o.key), ["armenian", "english", "either"]);
});

test("every product the chooser can name has a real lead time on the dial board", () => {
  // The chooser filters on lead time. A product missing from
  // CONFIG.LEAD_TIMES.WEEKS falls back to the default range, which for a
  // ten-week blanket would be a three-to-five-week promise.
  const weeks = CONFIG.LEAD_TIMES.WEEKS;
  for (const product of SHOP) {
    assert.ok(weeks[product.key], `${product.key} has no entry in CONFIG.LEAD_TIMES.WEEKS`);
    assert.deepEqual(weeks[product.key], product.weeks,
      `${product.key}'s lead time here disagrees with the dial board`);
  }
});
