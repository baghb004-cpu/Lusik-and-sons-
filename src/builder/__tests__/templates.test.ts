// The starter template gallery (roadmap #5): every JSON in
// builder/templates/ must parse as a Template, and page-kind roots must
// be PUBLISHABLE — a starter that fails its own gate is worse than none.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { templateSchema } from "../schema/index.ts";
import { validatePage } from "../engine/validate.ts";
import { createPage } from "../engine/pages.ts";

const DIR = join(process.cwd(), "builder", "templates");
const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));

test("the gallery ships at least the six starters", () => {
  assert.ok(files.length >= 6, `found ${files.length}`);
  for (const want of ["shop-landing", "our-story", "faq", "contact", "gallery", "coming-soon"]) {
    assert.ok(files.some((f) => f.includes(want)), `missing starter: ${want}`);
  }
});

test("every template parses, and page templates are publishable as-is", () => {
  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(DIR, file), "utf8"));
    const parsed = templateSchema.safeParse(raw);
    assert.ok(parsed.success, `${file}: ${!parsed.success && JSON.stringify(parsed.error.issues[0])}`);
    if (parsed.success && parsed.data.kind === "page") {
      const v = validatePage(parsed.data.root);
      assert.ok(v.publishable, `${file}: ${JSON.stringify(v.issues.filter((i) => i.level === "error"))}`);
    }
  }
});

test("instantiating a starter gives fresh ids and a publishable page", () => {
  const raw = JSON.parse(readFileSync(join(DIR, files.find((f) => f.includes("contact"))!), "utf8"));
  const tpl = templateSchema.parse(raw);
  const page = createPage({ title: "My contact page", slug: "my-contact", template: tpl });
  assert.equal(page.slug, "my-contact");
  const v = validatePage(page);
  assert.ok(v.publishable);
  // fresh ids — instantiating twice can't collide
  const again = createPage({ title: "Other", slug: "other", template: tpl });
  const ids = (blocks: { id: string; children?: unknown[] }[]): string[] =>
    blocks.flatMap((b) => [b.id, ...ids((b.children ?? []) as never)]);
  const a = new Set(ids(page.sections as never));
  for (const id of ids(again.sections as never)) assert.ok(!a.has(id), "ids must regenerate");
});
