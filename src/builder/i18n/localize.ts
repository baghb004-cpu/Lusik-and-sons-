// ============================================================
// i18n — localize a block tree for a target locale
// ============================================================
// One pure pass turns an authored (multilingual) block tree into
// a plain, single-language tree the existing renderer draws with
// no changes: every declared translatable string/doc field is
// resolved via resolveI18n / resolveI18nDoc, falling back to the
// project default. Unknown/plain values pass through untouched,
// so non-translated content and older docs are unaffected.
//
// TRANSLATABLE_FIELDS is the registry: add a field here and it
// becomes translatable everywhere — renderer, preview, export.
// ============================================================

import type { Block } from "../schema/block.ts";
import type { LocaleCode } from "./locales.ts";
import { resolveI18n, resolveI18nDoc, type Translatable } from "./translatable.ts";

interface FieldSpec {
  /** plain string props on the block. */
  strings?: string[];
  /** rich-doc props on the block. */
  docs?: string[];
  /** array props whose items have translatable string/doc fields. */
  arrays?: Array<{ prop: string; strings?: string[]; docs?: string[] }>;
}

export const TRANSLATABLE_FIELDS: Record<string, FieldSpec> = {
  section: { strings: ["eyebrow", "heading"] },
  richText: { docs: ["doc"] },
  card: { strings: ["title", "ctaLabel"], docs: ["body"] },
  button: { strings: ["label"] },
  drawer: { strings: ["triggerLabel"] },
  searchLauncher: { strings: ["label", "placeholder"] },
  spacer: {},
  accordion: { arrays: [{ prop: "items", strings: ["title"], docs: ["body"] }] },
  tabs: { arrays: [{ prop: "items", strings: ["label"], docs: ["body"] }] },
  breadcrumbs: { arrays: [{ prop: "items", strings: ["label"] }] },
  gallery: { arrays: [{ prop: "images", strings: ["alt"] }] },
  pillNav: { arrays: [{ prop: "items", strings: ["label"] }] },
  faqSection: { arrays: [{ prop: "items", strings: ["q"], docs: ["a"] }] },
  featuredProduct: { strings: ["headline"] },
  productCard: {}, // catalog-driven; product copy localizes via the catalog later
  languageSwitcher: { strings: ["label"] },
  languageGate: { strings: ["heading", "subtext", "continueLabel"] },
  sectionJumper: { strings: ["upLabel", "downLabel"] },
  appearanceSwitcher: { strings: ["lightLabel", "darkLabel", "autoLabel", "candleLabel"] },
};

function localizeProps(
  type: string,
  props: Record<string, unknown>,
  locale: LocaleCode,
  defaultLocale: LocaleCode
): Record<string, unknown> {
  const spec = TRANSLATABLE_FIELDS[type];
  if (!spec) return props;
  let next = props;
  const ensure = () => (next === props ? (next = { ...props }) : next);

  for (const key of spec.strings ?? []) {
    if (key in props && props[key] !== undefined) {
      ensure()[key] = resolveI18n(props[key] as Translatable, locale, defaultLocale);
    }
  }
  for (const key of spec.docs ?? []) {
    if (key in props && props[key] !== undefined) {
      ensure()[key] = resolveI18nDoc(props[key], locale, defaultLocale);
    }
  }
  for (const arr of spec.arrays ?? []) {
    const items = props[arr.prop];
    if (!Array.isArray(items)) continue;
    ensure()[arr.prop] = items.map((item: Record<string, unknown>) => {
      let it = item;
      const ensureItem = () => (it === item ? (it = { ...item }) : it);
      for (const key of arr.strings ?? []) {
        if (key in item && item[key] !== undefined) ensureItem()[key] = resolveI18n(item[key] as Translatable, locale, defaultLocale);
      }
      for (const key of arr.docs ?? []) {
        if (key in item && item[key] !== undefined) ensureItem()[key] = resolveI18nDoc(item[key], locale, defaultLocale);
      }
      return it;
    });
  }
  return next;
}

/** Resolve an entire block tree to a single locale (immutable). */
export function localizeBlocks(blocks: Block[], locale: LocaleCode, defaultLocale: LocaleCode): Block[] {
  return blocks.map((b) => {
    const props = localizeProps(b.type, b.props as Record<string, unknown>, locale, defaultLocale);
    const children = b.children ? localizeBlocks(b.children, locale, defaultLocale) : undefined;
    if (props === b.props && children === b.children) return b;
    return { ...b, props, ...(children ? { children } : {}) };
  });
}

/** Coverage: count translatable string fields and how many have `locale` copy. */
export function translationCoverage(blocks: Block[], locale: LocaleCode): { total: number; translated: number } {
  let total = 0;
  let translated = 0;
  const visit = (b: Block) => {
    const spec = TRANSLATABLE_FIELDS[b.type];
    if (spec) {
      const props = b.props as Record<string, unknown>;
      const count = (val: unknown) => {
        if (val === undefined || val === "") return;
        total++;
        if (typeof val === "string") return; // base-only counts as untranslated for this locale
        const map = (val as { _i18n?: Record<string, string> })._i18n;
        if (map && map[locale]) translated++;
      };
      for (const k of spec.strings ?? []) count(props[k]);
      for (const arr of spec.arrays ?? []) {
        const items = props[arr.prop];
        if (Array.isArray(items)) for (const it of items) for (const k of arr.strings ?? []) count((it as Record<string, unknown>)[k]);
      }
    }
    b.children?.forEach(visit);
  };
  blocks.forEach(visit);
  return { total, translated };
}
