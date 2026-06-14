// Generated inspector forms (plan §21) — the schema registry IS the
// form definition. The lockstep test is the load-bearing one: every
// registered block type must compile to a real form with zero "json"
// fallback fields, so a zod upgrade or a weird new prop shape fails
// CI instead of silently degrading the inspector.
import { test } from "node:test";
import assert from "node:assert/strict";

import { BLOCK_TYPES, blockSchema, newId } from "../schema/index.ts";
import {
  fieldsForBlockType,
  newRowValue,
  isSimpleDoc,
  docToPlainText,
  plainTextToDoc,
  hasGeneratedForm,
  DEDICATED_EDITORS,
  type FieldSpec,
} from "../editor/introspect.ts";
import { textDoc } from "../schema/richtext.ts";

const fields = (type: string) => fieldsForBlockType(type)!;
const field = (type: string, name: string): FieldSpec => {
  const f = fields(type).find((x) => x.name === name);
  assert.ok(f, `${type}.${name} must introspect`);
  return f!;
};

// ── THE LOCKSTEP LAW ────────────────────────────────────────
test("every registered block type compiles to a form with zero json-fallback fields", () => {
  for (const type of Object.keys(BLOCK_TYPES)) {
    const specs = fieldsForBlockType(type);
    assert.ok(specs && specs.length > 0, `${type} must introspect to fields`);
    const collectKinds = (fs: FieldSpec[]): string[] =>
      fs.flatMap((f) => [f.kind, ...(f.itemFields ? collectKinds(f.itemFields) : [])]);
    const json = collectKinds(specs!).filter((k) => k === "json");
    assert.deepEqual(json, [], `${type} has unintrospectable props — extend introspect.ts, don't ship a JSON field silently`);
  }
});

// ── kind detection spot checks ──────────────────────────────
test("kinds: translatable, richdoc, selects, numbers, colors, refs detect correctly", () => {
  assert.equal(field("card", "title").kind, "translatable");
  assert.equal(field("card", "title").required, true);
  assert.equal(field("card", "ctaLabel").required, false);
  assert.equal(field("card", "body").kind, "richdoc");
  assert.equal(field("card", "image").kind, "group");

  const rotate = field("image", "rotate");
  assert.equal(rotate.kind, "select"); // literal union
  assert.deepEqual(rotate.options?.map((o) => o.value), [0, 90, 180, 270]);
  assert.equal(field("image", "src").kind, "image");

  const count = field("columns", "count");
  assert.equal(count.kind, "number");
  assert.equal(count.min, 1);
  assert.equal(count.max, 4);

  assert.equal(field("button", "href").kind, "href");
  assert.deepEqual(field("button", "variant").options?.map((o) => o.value), ["primary", "secondary", "ghost"]);

  assert.equal(field("productCard", "product").kind, "productRef");
  assert.equal(field("productCard", "product").required, true);
  assert.equal(field("sectionJumper", "accent").kind, "color");
  assert.equal(field("announcementBar", "binding").kind, "constant");
  assert.equal(field("announcementBar", "binding").constantValue, "cms:announcement");
});

test("rows: nested item fields compile, ids are managed (hidden), bounds carried", () => {
  const items = field("accordion", "items");
  assert.equal(items.kind, "rows");
  assert.equal(items.rowsMin, 1);
  assert.ok(!items.itemFields!.some((f) => f.name === "id"), "id is never a visible field");
  assert.equal(items.itemFields!.find((f) => f.name === "title")!.kind, "translatable");
  assert.equal(items.itemFields!.find((f) => f.name === "body")!.kind, "richdoc");

  const tabs = field("tabs", "items");
  assert.equal(tabs.rowsMin, 2);
  assert.equal(tabs.rowsMax, 6);

  const locales = field("languageSwitcher", "locales");
  assert.equal(locales.kind, "multiselect");
  assert.equal(locales.options?.length, 5);
});

// ── "+ Add row" produces schema-valid data ──────────────────
test("newRowValue rows validate against their block schema", () => {
  const accordionRow = newRowValue(field("accordion", "items").itemFields!);
  assert.equal(
    blockSchema.safeParse({ id: newId(), type: "accordion", props: { items: [accordionRow] } }).success,
    true
  );
  const tabRows = [newRowValue(field("tabs", "items").itemFields!), newRowValue(field("tabs", "items").itemFields!)];
  assert.equal(blockSchema.safeParse({ id: newId(), type: "tabs", props: { items: tabRows } }).success, true);
  const swatch = newRowValue(field("swatchRow", "swatches").itemFields!);
  assert.equal(
    blockSchema.safeParse({ id: newId(), type: "swatchRow", props: { layout: "horizontal", swatches: [swatch] } }).success,
    true
  );
  // breadcrumbs items carry NO id — newRowValue must respect rowsHaveId
  const crumbSpec = field("breadcrumbs", "items");
  assert.equal(crumbSpec.rowsHaveId, false);
  const crumb = newRowValue(crumbSpec.itemFields!, crumbSpec.rowsHaveId !== false);
  assert.ok(!("id" in crumb));
  assert.equal(blockSchema.safeParse({ id: newId(), type: "breadcrumbs", props: { items: [crumb] } }).success, true);
});

// ── the paragraph textarea round-trip ───────────────────────
test("simple docs round-trip through plain text; rich ones are detected and deferred", () => {
  const doc = plainTextToDoc("First paragraph.\n\nSecond one.");
  assert.equal(doc.content.length, 2);
  assert.equal(isSimpleDoc(doc), true);
  assert.equal(docToPlainText(doc), "First paragraph.\n\nSecond one.");
  assert.equal(isSimpleDoc(textDoc("plain")), true);

  // marks, headings and per-locale docs are NOT simple — the form defers
  assert.equal(isSimpleDoc({ type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [] }] }), false);
  assert.equal(
    isSimpleDoc({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "bold" }] }] }] }),
    false
  );
  assert.equal(isSimpleDoc({ _i18nDoc: { en: textDoc("x") } }), false);
  assert.equal(isSimpleDoc(undefined), false);
});

// ── dedicated editors keep precedence ───────────────────────
test("pillNav keeps its dedicated editor; everything else gets the generated form", () => {
  assert.ok(DEDICATED_EDITORS.has("pillNav"));
  assert.equal(hasGeneratedForm({ id: "b_x000000001", type: "pillNav", props: {} }), false);
  assert.equal(hasGeneratedForm({ id: "b_x000000001", type: "card", props: { title: "x" } }), true);
  assert.equal(hasGeneratedForm({ id: "b_x000000001", type: "notARealType", props: {} }), false);
});
