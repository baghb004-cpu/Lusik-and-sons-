import { test } from "node:test";
import assert from "node:assert/strict";

import { validatePage, checkContrast, contrastRatio } from "../engine/index.ts";
import { CURRENT_SCHEMA_VERSION } from "../schema/migrate.ts";
import { makePage } from "./fixtures.ts";

test("a valid page is publishable", () => {
  const result = validatePage(makePage());
  assert.equal(result.publishable, true, JSON.stringify(result.issues));
  assert.ok(result.page);
});

test("duplicate block ids are a publish-blocking error", () => {
  const page = makePage();
  page.sections.push(structuredClone(page.sections[1])); // same id twice
  const result = validatePage(page);
  assert.equal(result.publishable, false);
  assert.ok(result.issues.some((i) => i.code === "duplicate_id" && i.level === "error"));
});

test("images without alt text block publish unless decorative", () => {
  const page = makePage();
  const section = page.sections[0];
  const img = section.children!.find((b) => b.type === "image")!;
  img.props = { ...img.props, alt: "  " };
  let result = validatePage(page);
  assert.ok(result.issues.some((i) => i.code === "image_alt" && i.level === "error"));
  assert.equal(result.publishable, false);

  img.props = { ...img.props, decorative: true };
  result = validatePage(page);
  assert.equal(result.publishable, true, JSON.stringify(result.issues));
});

test("hidden-on-every-device blocks warn but do not block publish", () => {
  const page = makePage();
  page.sections[1].visibility = { desktop: false, tablet: false, mobile: false };
  const result = validatePage(page);
  assert.ok(result.issues.some((i) => i.code === "hidden_everywhere" && i.level === "warning"));
  assert.equal(result.publishable, true);
});

test("documents from a newer builder version are rejected with a clear error", () => {
  const result = validatePage({ ...makePage(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 });
  assert.equal(result.publishable, false);
  assert.equal(result.issues[0].code, "schema_version");
});

test("malformed JSON shapes produce schema errors, not crashes", () => {
  const result = validatePage({ schemaVersion: 1, id: "nope" });
  assert.equal(result.publishable, false);
  assert.ok(result.issues.every((i) => i.level === "error"));
});

// ── contrast math (powers the theme guardrails) ─────────────
test("contrast: known WCAG reference values", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
  assert.equal(contrastRatio("#777777", "#777777"), 1);
  // order independence
  assert.equal(contrastRatio("#1A1612", "#F5EFE3"), contrastRatio("#F5EFE3", "#1A1612"));
});

test("contrast: the site's ink-on-cream palette passes AA; gray-on-white fails", () => {
  const brand = checkContrast("#1A1612", "#F5EFE3"); // ink on cream
  assert.equal(brand.passesAA, true);
  const weak = checkContrast("#aaaaaa", "#ffffff");
  assert.equal(weak.passesAA, false);
  // large-text threshold is looser
  assert.equal(checkContrast("#767676", "#ffffff", true).passesAA, true);
});
