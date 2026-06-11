import { test } from "node:test";
import assert from "node:assert/strict";

import {
  suggestSlug,
  pagePath,
  templatePath,
  createPage,
  duplicatePage,
  pageToTemplate,
  collectIds,
  EngineError,
} from "../engine/index.ts";
import { pageSchema, templateSchema, SLUG_RE } from "../schema/index.ts";
import { makePage } from "./fixtures.ts";

test("suggestSlug produces valid slugs from messy titles", () => {
  assert.equal(suggestSlug("Gift Guide 2026!"), "gift-guide-2026");
  assert.equal(suggestSlug("  Lusik’s   Story  "), "lusik-s-story");
  assert.equal(suggestSlug("Ա Բ Գ blanket"), "blanket"); // non-latin stripped
  for (const t of ["Hello World", "FAQ", "A/B Testing 101"]) {
    const s = suggestSlug(t);
    if (s) assert.match(s, SLUG_RE, t);
  }
});

test("createPage: blank page is schema-valid and a draft", () => {
  const page = createPage({ title: "New Landing" });
  assert.equal(pageSchema.safeParse(page).success, true);
  assert.equal(page.slug, "new-landing");
  assert.equal(page.status, "draft");
  assert.deepEqual(page.sections, []);
  assert.equal(pagePath(page.slug), "builder/pages/new-landing.json");
});

test("createPage from a page template deep-clones sections with fresh ids", () => {
  const source = makePage();
  const tpl = pageToTemplate(source, "Welcome layout");
  assert.equal(templateSchema.safeParse(tpl).success, true);
  assert.equal(tpl.kind, "page");

  const page = createPage({ title: "Spring Sale", template: tpl });
  assert.equal(pageSchema.safeParse(page).success, true);
  // structure copied…
  assert.equal(page.sections.length, source.sections.length);
  // …but every id is fresh (no collision with the source)
  const sourceIds = new Set(collectIds(source.sections));
  for (const id of collectIds(page.sections)) assert.ok(!sourceIds.has(id), `id ${id} leaked from source`);
});

test("createPage rejects an invalid explicit slug", () => {
  assert.throws(() => createPage({ title: "x", slug: "Bad Slug" }), EngineError);
});

test("duplicatePage: fresh ids, new slug, reset to draft, refuses same slug", () => {
  const source = makePage({ status: "published", publishedHash: "abc" });
  const copy = duplicatePage(source, "Welcome copy");
  assert.equal(pageSchema.safeParse(copy).success, true);
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.status, "draft");
  assert.equal(copy.publishedHash, undefined);
  const sourceIds = new Set(collectIds(source.sections));
  for (const id of collectIds(copy.sections)) assert.ok(!sourceIds.has(id));

  assert.throws(() => duplicatePage(source, "x", source.slug), EngineError);
});

test("pageToTemplate captures a draft page skeleton with a fresh page id", () => {
  const source = makePage({ status: "published" });
  const tpl = pageToTemplate(source, "Hero + cards");
  assert.equal(tpl.name, "Hero + cards");
  const root = tpl.root as { status: string; id: string };
  assert.equal(root.status, "draft");
  assert.notEqual(root.id, source.id);
  assert.equal(templatePath("Hero + cards"), "builder/templates/hero-cards.json");
});
