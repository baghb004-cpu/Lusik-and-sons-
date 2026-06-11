import { test } from "node:test";
import assert from "node:assert/strict";

import {
  pageSchema,
  blockSchema,
  templateSchema,
  richTextDoc,
  textDoc,
  newId,
  BLOCK_ID_RE,
  migrateDocument,
  SchemaVersionError,
  CURRENT_SCHEMA_VERSION,
} from "../schema/index.ts";
import { makePage, heroSection } from "./fixtures.ts";

test("a representative page parses", () => {
  const result = pageSchema.safeParse(makePage());
  assert.equal(result.success, true, JSON.stringify(!result.success && result.error.issues));
});

test("newId() satisfies the id shape blocks require", () => {
  assert.match(newId(), BLOCK_ID_RE);
  assert.match(newId("tpl"), BLOCK_ID_RE);
  assert.notEqual(newId(), newId());
});

test("unknown block type is rejected", () => {
  const bad = { id: "b_x123456789ab", type: "marquee3000", props: {} };
  const result = blockSchema.safeParse(bad);
  assert.equal(result.success, false);
  assert.match(JSON.stringify(!result.success && result.error.issues), /Unknown block type/);
});

test("children on a non-container block are rejected", () => {
  const bad = {
    id: "b_x123456789ab",
    type: "image",
    props: { src: "/img/a.jpg", alt: "a" },
    children: [{ id: "b_y123456789ab", type: "spacer", props: { size: "spacing.md" } }],
  };
  const result = blockSchema.safeParse(bad);
  assert.equal(result.success, false);
  assert.match(JSON.stringify(!result.success && result.error.issues), /cannot have children/);
});

test("block props are validated per type", () => {
  const bad = { id: "b_x123456789ab", type: "columns", props: { count: 9 } };
  const result = blockSchema.safeParse(bad);
  assert.equal(result.success, false);
});

test("javascript: links cannot be saved in rich text", () => {
  const evil = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "click",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
        ],
      },
    ],
  };
  assert.equal(richTextDoc.safeParse(evil).success, false);
  // protocol-relative URLs are also rejected; plain https and site-relative pass
  const mk = (href: string) => ({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href } }] }] },
    ],
  });
  assert.equal(richTextDoc.safeParse(mk("//evil.com")).success, false);
  assert.equal(richTextDoc.safeParse(mk("https://example.com")).success, true);
  assert.equal(richTextDoc.safeParse(mk("/shop")).success, true);
});

test("bad slugs are rejected", () => {
  for (const slug of ["Has Space", "UPPER", "trailing-", "-leading", "dotted.path", ""]) {
    assert.equal(pageSchema.safeParse(makePage({ slug })).success, false, slug);
  }
  assert.equal(pageSchema.safeParse(makePage({ slug: "gift-guide-2026" })).success, true);
});

test("template kind must match its root shape", () => {
  const blockRoot = structuredClone(heroSection);
  const ok = templateSchema.safeParse({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: "b_tpl000000001",
    name: "Hero",
    kind: "section",
    root: blockRoot,
  });
  assert.equal(ok.success, true);

  const mismatched = templateSchema.safeParse({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: "b_tpl000000001",
    name: "Hero",
    kind: "page",
    root: blockRoot,
  });
  assert.equal(mismatched.success, false);
});

test("rich text doc helper produces a valid doc", () => {
  assert.equal(richTextDoc.safeParse(textDoc("hello")).success, true);
});

test("migration: documents from a newer builder fail loudly", () => {
  assert.throws(
    () => migrateDocument({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }),
    SchemaVersionError
  );
});

test("migration: versionless documents are treated as v1 and stamped", () => {
  const out = migrateDocument({ id: "b_page00000001" });
  assert.equal(out.schemaVersion, CURRENT_SCHEMA_VERSION);
});
