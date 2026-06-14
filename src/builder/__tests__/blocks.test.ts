// Schema-level coverage for the Phase 6 structural blocks. (Full DOM
// rendering is exercised by the e2e build; here we lock the prop
// contracts so a block can't be saved in a shape the renderer can't
// handle.)
import { test } from "node:test";
import assert from "node:assert/strict";

import { blockSchema, BLOCK_TYPES } from "../schema/index.ts";
import { textDoc } from "../schema/richtext.ts";

const ok = (type: string, props: unknown, id = "b_test00000001") =>
  blockSchema.safeParse({ id, type, props });

test("button: requires a safe href and label", () => {
  assert.equal(ok("button", { label: "Shop", href: "/shop", variant: "primary" }).success, true);
  assert.equal(ok("button", { label: "x", href: "javascript:alert(1)" }).success, false);
  assert.equal(ok("button", { href: "/shop" }).success, false); // no label
  assert.equal(ok("button", { label: "x", href: "/shop", variant: "neon" }).success, false);
});

test("breadcrumbs: items with optional hrefs (last = current page)", () => {
  assert.equal(
    ok("breadcrumbs", { items: [{ label: "Home", href: "/" }, { label: "Shop", href: "/shop" }, { label: "Blanket" }] }).success,
    true
  );
  assert.equal(ok("breadcrumbs", { items: [] }).success, false);
  assert.equal(ok("breadcrumbs", { items: [{ label: "x", href: "javascript:x" }] }).success, false);
});

test("tabs: 2–6 items, each with id/label/body", () => {
  const item = (n: number) => ({ id: `b_tab000000${n}0`, label: `Tab ${n}`, body: textDoc(`Panel ${n}`) });
  assert.equal(ok("tabs", { items: [item(1), item(2)] }).success, true);
  assert.equal(ok("tabs", { items: [item(1)] }).success, false); // need ≥2
  assert.equal(ok("tabs", { items: [1, 2, 3, 4, 5, 6, 7].map(item) }).success, false); // ≤6
});

test("the new block types are registered", () => {
  for (const t of ["button", "breadcrumbs", "tabs"]) {
    assert.ok(BLOCK_TYPES[t], `${t} must be in the registry`);
  }
});
