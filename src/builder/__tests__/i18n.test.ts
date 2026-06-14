import { test } from "node:test";
import assert from "node:assert/strict";

import {
  LOCALES,
  LOCALE_CODES,
  localeByCode,
  isRtl,
  normalizeLocales,
  resolveI18n,
  resolveI18nDoc,
  setLocaleValue,
  localesPresent,
  localizeBlocks,
  translationCoverage,
  i18nSettingsSchema,
  fontFaceCss,
  buildI18nCss,
  familiesFor,
  fontManifest,
} from "../i18n/index.ts";
import { blockSchema } from "../schema/index.ts";
import { textDoc } from "../schema/richtext.ts";
import type { Block } from "../schema/index.ts";

// ── locales ─────────────────────────────────────────────────
test("the five locales exist with correct direction + endonyms", () => {
  assert.deepEqual([...LOCALE_CODES].sort(), ["ar", "en", "es", "hy", "ru"]);
  assert.equal(localeByCode("ar")!.dir, "rtl");
  assert.equal(isRtl("ar"), true);
  assert.equal(isRtl("hy"), false);
  assert.equal(localeByCode("hy")!.endonym, "Հայերեն");
  assert.equal(localeByCode("ru")!.endonym, "Русский");
  assert.equal(localeByCode("ar")!.endonym, "العربية");
});

test("normalizeLocales drops junk and never returns empty", () => {
  assert.deepEqual(normalizeLocales(["en", "xx", "ar"]), ["en", "ar"]);
  assert.deepEqual(normalizeLocales(["nope"]), ["en"]);
});

// ── translatable resolution ─────────────────────────────────
test("resolveI18n: exact → default → any → empty", () => {
  assert.equal(resolveI18n("plain", "ar"), "plain"); // plain strings pass through
  assert.equal(resolveI18n({ _i18n: { en: "Hello", ar: "مرحبا" } }, "ar"), "مرحبا");
  assert.equal(resolveI18n({ _i18n: { en: "Hello" } }, "ar", "en"), "Hello"); // falls back to default
  assert.equal(resolveI18n({ _i18n: { hy: "Բարև" } }, "ar", "en"), "Բարև"); // any present value
  assert.equal(resolveI18n({ _i18n: {} }, "ar"), "");
  assert.equal(resolveI18n(undefined, "ar"), "");
});

test("setLocaleValue promotes a string to a map and collapses back when bare", () => {
  const a = setLocaleValue("Hello", "ar", "مرحبا", "en");
  assert.deepEqual(a, { _i18n: { en: "Hello", ar: "مرحبا" } });
  // removing the only non-default returns a plain string
  const b = setLocaleValue(a, "ar", "", "en");
  assert.equal(b, "Hello");
  assert.deepEqual(localesPresent({ _i18n: { en: "x", ru: "y" } }).sort(), ["en", "ru"]);
});

test("resolveI18nDoc resolves per-locale rich docs with fallback", () => {
  const docs = { _i18nDoc: { en: textDoc("Hi"), ar: textDoc("مرحبا") } };
  assert.deepEqual(resolveI18nDoc(docs, "ar"), textDoc("مرحبا"));
  assert.deepEqual(resolveI18nDoc(docs, "ru", "en"), textDoc("Hi"));
  assert.deepEqual(resolveI18nDoc(textDoc("plain"), "ar"), textDoc("plain")); // plain doc passes through
});

// ── localize a block tree ───────────────────────────────────
test("localizeBlocks resolves strings + nested arrays + rich docs to one locale", () => {
  const blocks: Block[] = [
    {
      id: "b_sec00000001",
      type: "section",
      props: { heading: { _i18n: { en: "Welcome", ar: "أهلا" } }, eyebrow: "plain" },
      children: [
        { id: "b_btn00000001", type: "button", props: { label: { _i18n: { en: "Shop", ar: "تسوق" } }, href: "/shop" } },
        {
          id: "b_acc00000001",
          type: "accordion",
          props: { items: [{ id: "b_it000000001", title: { _i18n: { en: "Q", ar: "س" } }, body: { _i18nDoc: { en: textDoc("A"), ar: textDoc("ج") } } }] },
        },
      ],
    },
  ];
  const ar = localizeBlocks(blocks, "ar", "en");
  assert.equal((ar[0].props as { heading: string }).heading, "أهلا");
  assert.equal((ar[0].props as { eyebrow: string }).eyebrow, "plain");
  assert.equal((ar[0].children![0].props as { label: string }).label, "تسوق");
  const item = (ar[0].children![1].props as { items: Array<{ title: string; body: unknown }> }).items[0];
  assert.equal(item.title, "س");
  assert.deepEqual(item.body, textDoc("ج"));

  // English falls back where Arabic is absent; original tree is untouched
  const en = localizeBlocks(blocks, "en", "en");
  assert.equal((en[0].props as { heading: string }).heading, "Welcome");
  assert.equal((blocks[0].props as { heading: object }).heading instanceof Object, true);
});

test("translationCoverage counts translated vs total for a locale", () => {
  const blocks: Block[] = [
    { id: "b_a0000000001", type: "button", props: { label: { _i18n: { en: "A", ar: "أ" } }, href: "/" } },
    { id: "b_b0000000001", type: "button", props: { label: { _i18n: { en: "B" } }, href: "/" } },
  ];
  const cov = translationCoverage(blocks, "ar");
  assert.equal(cov.total, 2);
  assert.equal(cov.translated, 1);
});

// ── settings ────────────────────────────────────────────────
test("i18n settings: defaultLocale must be among enabled locales", () => {
  assert.equal(i18nSettingsSchema.safeParse({ locales: ["en", "ar"], defaultLocale: "en" }).success, true);
  assert.equal(i18nSettingsSchema.safeParse({ locales: ["en", "ar"], defaultLocale: "ru" }).success, false);
  assert.equal(i18nSettingsSchema.safeParse({}).success, true); // all defaults
});

// ── offline fonts ───────────────────────────────────────────
test("fonts: only needed scripts emitted; @font-face is LOCAL (no Google)", () => {
  const css = buildI18nCss(["en", "ar"]);
  assert.match(css, /@font-face/);
  assert.match(css, /url\("\/fonts\/arabic.woff2"\)/);
  assert.match(css, /url\("\/fonts\/latin.woff2"\)/);
  assert.ok(!css.includes("armenian.woff2"), "Armenian not needed for en+ar");
  assert.ok(!/fonts\.googleapis|fonts\.gstatic|https?:/.test(css), "no network font URLs");
  // RTL direction baked into the Arabic root rule
  assert.match(css, /\[lang="ar"\][\s\S]*direction: rtl/);
});

test("familiesFor + fontManifest scope to the enabled scripts", () => {
  assert.deepEqual(familiesFor(["ru"]).map((f) => f.file), ["cyrillic.woff2"]);
  assert.equal(fontManifest(["en", "hy", "ar", "ru", "es"]).length, 4);
  assert.ok(fontFaceCss(["es"]).includes("latin.woff2"));
});

// ── the new blocks + backward compatibility ─────────────────
test("languageSwitcher + languageGate validate", () => {
  assert.equal(blockSchema.safeParse({ id: "b_sw00000001", type: "languageSwitcher", props: { style: "pills" } }).success, true);
  assert.equal(blockSchema.safeParse({ id: "b_gt00000001", type: "languageGate", props: { heading: "Pick", mode: "blocking" } }).success, true);
  // a switcher restricted to specific locales
  assert.equal(blockSchema.safeParse({ id: "b_sw00000002", type: "languageSwitcher", props: { locales: ["en", "hy"] } }).success, true);
});

test("BACKWARD COMPAT: text fields accept BOTH a plain string and an i18n map", () => {
  // plain string (every existing document) still validates
  assert.equal(blockSchema.safeParse({ id: "b_c00000001", type: "card", props: { title: "Plain title" } }).success, true);
  // and an i18n map validates
  assert.equal(blockSchema.safeParse({ id: "b_c00000002", type: "card", props: { title: { _i18n: { en: "Hi", ar: "مرحبا" } } } }).success, true);
  // an empty i18n map for a REQUIRED field is rejected
  assert.equal(blockSchema.safeParse({ id: "b_c00000003", type: "card", props: { title: { _i18n: {} } } }).success, false);
});
