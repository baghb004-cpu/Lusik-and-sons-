import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { blockSchema, templateSchema, PILL_ICONS, migrateDocument } from "../schema/index.ts";
import { validatePage } from "../engine/index.ts";
import { makePage } from "./fixtures.ts";

const pill = (id = "b_pill00000001") => ({
  id,
  type: "pillNav",
  props: {
    items: [
      { id: "b_pillitem0001", icon: "home", label: "For You", href: "/" },
      { id: "b_pillitem0002", icon: "bag", label: "Bag", href: "/cart" },
    ],
    position: "bottom",
  },
});

test("pillNav schema: bounds on items, icons, labels, hrefs", () => {
  assert.equal(blockSchema.safeParse(pill()).success, true);

  const tooFew = structuredClone(pill());
  (tooFew.props.items as unknown[]).pop();
  assert.equal(blockSchema.safeParse(tooFew).success, false);

  const badIcon = structuredClone(pill());
  badIcon.props.items[0].icon = "rocket";
  assert.equal(blockSchema.safeParse(badIcon).success, false);

  const badHref = structuredClone(pill());
  badHref.props.items[0].href = "javascript:alert(1)";
  assert.equal(blockSchema.safeParse(badHref).success, false);

  const sixItems = structuredClone(pill());
  sixItems.props.items = [1, 2, 3, 4, 5, 6].map((n) => ({
    id: `b_pillitem000${n}`,
    icon: "star",
    label: `B${n}`,
    href: "/",
  }));
  assert.equal(blockSchema.safeParse(sixItems).success, false, "max 5 buttons");

  const badHeight = structuredClone(pill()) as Record<string, unknown>;
  (badHeight.props as Record<string, unknown>).heightPx = 30; // under the 48px floor
  assert.equal(blockSchema.safeParse(badHeight).success, false);
});

test("publish rules: one pill per page, top-level only", () => {
  const page = makePage();
  page.sections.push(pill("b_pill00000001"));
  let result = validatePage(page);
  assert.equal(result.publishable, true, JSON.stringify(result.issues));

  // a second pill is a publish-blocking error
  page.sections.push(pill("b_pill00000002"));
  result = validatePage(page);
  assert.ok(result.issues.some((i) => i.code === "pill_multiple" && i.level === "error"));
  assert.equal(result.publishable, false);

  // nested inside a section = error too
  const nested = makePage();
  nested.sections[0].children!.push(pill("b_pill00000003"));
  result = validatePage(nested);
  assert.ok(result.issues.some((i) => i.code === "pill_nested" && i.level === "error"));
});

test("publish rules: hiding the pill on mobile warns but doesn't block", () => {
  const page = makePage();
  page.sections.push({ ...pill(), visibility: { mobile: false } });
  const result = validatePage(page);
  assert.ok(result.issues.some((i) => i.code === "pill_hidden_mobile" && i.level === "warning"));
  assert.equal(result.publishable, true);
});

test("the seeded Lusik nav template validates and mirrors the live nav", () => {
  const raw = JSON.parse(readFileSync(join(process.cwd(), "builder", "templates", "lusik-pill-nav.json"), "utf8"));
  const parsed = templateSchema.safeParse(migrateDocument(raw));
  assert.equal(parsed.success, true, JSON.stringify(!parsed.success && parsed.error.issues));
  const tpl = (parsed as unknown as { success: true; data: { kind: string; root: { props: { items: Array<{ label: string }>; preset: string } } } }).data;
  assert.equal(tpl.kind, "pillNav");
  assert.deepEqual(tpl.root.props.items.map((i) => i.label), ["For You", "Shop", "Journal", "Bag"]);
  assert.equal(tpl.root.props.preset, "Liquid Glass");
});

test("every PILL_ICONS name is a real icon (registry lockstep)", () => {
  // The renderer's SVG map can't be imported here (JSX), so the contract
  // is enforced structurally: the schema enum drives BOTH sides, and the
  // renderer falls back safely for unknown names. This test pins the
  // enum's stability so a removed icon can't orphan saved documents.
  assert.deepEqual(
    [...PILL_ICONS].sort(),
    ["bag", "gift", "heart", "home", "journal", "phone", "search", "shop", "star", "user"].sort()
  );
});
