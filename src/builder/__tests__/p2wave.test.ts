// Phase-2 wave (INSPIRATION_ROADMAP): Brand Kit, review notes, the CSV
// table, print CSS, the deck target, page-weight math.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { brandSchema, reviewsSchema, blockSchema, newId } from "../schema/index.ts";
import { validateDocument } from "../server/validateDoc.ts";
import { parseCsv } from "../engine/csv.ts";
import { pageWeight, PAGE_WEIGHT_BUDGET_BYTES } from "../editor/pageWeight.ts";
import { assembleHtmlDocument, PRINT_CSS, DECK_CSS } from "../export/static.ts";
import { makePage, makeMobileLayer } from "./fixtures.ts";

test("brand kit: schema gates the seed; routing covers it; fail-closed intact", async () => {
  const seed = JSON.parse(readFileSync("builder/brand.json", "utf8"));
  assert.equal(brandSchema.safeParse(seed).success, true, "the seed brand must stay valid");
  assert.equal(brandSchema.safeParse({ schemaVersion: 1, name: "X", email: "not-an-email" }).success, false);
  assert.deepEqual(await validateDocument("builder/brand.json", seed), []);
  assert.ok((await validateDocument("builder/brand2.json", {})).some((i) => i.code === "unknown_family"));
});

test("review notes: gated family, block-pinned or page-level, resolvable", async () => {
  const doc = {
    schemaVersion: 1,
    slug: "welcome",
    notes: [
      { id: newId("n"), blockId: "b_card00000001", author: "Gohar", text: "Make this warmer?", createdAt: 1 },
      { id: newId("n"), author: "You", text: "Page-level: add a photo up top", createdAt: 2, resolved: true },
    ],
  };
  assert.equal(reviewsSchema.safeParse(doc).success, true);
  assert.deepEqual(await validateDocument("builder/reviews/welcome.json", doc), []);
  assert.ok((await validateDocument("builder/reviews/welcome.json", { notes: [{ text: "" }] })).length > 0);
});

test("csv: quoted fields, escapes, row/col caps; the block validates", () => {
  const rows = parseCsv('Item,Price\n"Blanket, crib","$165"\n"Says ""hi""",$5\n');
  assert.deepEqual(rows, [["Item", "Price"], ["Blanket, crib", "$165"], ['Says "hi"', "$5"]]);
  assert.equal(parseCsv("a,b\n".repeat(500)).length, 200); // row cap
  assert.equal(parseCsv("x," + "c,".repeat(30))[0]!.length, 12); // col cap
  assert.equal(blockSchema.safeParse({ id: "b_csv00000001", type: "csvTable", props: { csv: "a,b\n1,2" } }).success, true);
  assert.equal(blockSchema.safeParse({ id: "b_csv00000001", type: "csvTable", props: { csv: "" } }).success, false);
});

test("page weight: sums only referenced media, honest budget verdict", () => {
  const files = [
    { name: "big.jpg", path: "/img/uploads/big.jpg", size: 1_400_000 },
    { name: "small.jpg", path: "/img/uploads/small.jpg", size: 200_000 },
    { name: "unused.jpg", path: "/img/uploads/unused.jpg", size: 9_000_000 },
  ];
  const page = { sections: [{ props: { src: "/img/uploads/big.jpg" } }, { props: { image: { src: "/img/uploads/small.jpg" } } }] };
  const w = pageWeight(page, files);
  assert.equal(w.refs.length, 2);
  assert.equal(w.bytes, 1_600_000);
  assert.equal(w.over, w.bytes > PAGE_WEIGHT_BUDGET_BYTES);
  assert.equal(w.over, true);
});

test("exports: print CSS in every page; deck CSS only when the target asks", () => {
  const base = {
    page: makePage(),
    bodyHtml: "<section>hi</section>",
    layers: [makeMobileLayer()],
    theme: null,
    stylesheetHref: "styles.css",
    siteName: "X",
  };
  const html = assembleHtmlDocument(base);
  assert.ok(html.includes("@media print"), "print-ready by default");
  assert.ok(!html.includes("scroll-snap-type"));
  const deck = assembleHtmlDocument({ ...base, extraCss: DECK_CSS });
  assert.match(deck, /scroll-snap-type: y mandatory/);
  assert.match(DECK_CSS, /min-height: 100vh/);
});
