// ============================================================
// i18n — the translatable-string model (Phase: languages)
// ============================================================
// The atom that makes "every element translatable, even title
// cards" real WITHOUT breaking a single existing document.
//
// A translatable value is EITHER a plain string (what every
// current block prop already is) OR a { _i18n: { en, hy, ... } }
// map. resolveI18n() collapses it to a string for a target
// locale, falling back to the project's default locale, then any
// present value — so a half-translated page never renders blank.
//
// Because plain strings stay valid, this is fully backward-
// compatible: untranslated docs work untouched, and a block only
// "becomes multilingual" when an editor adds locale variants.
// ============================================================

import { z } from "zod";
import { DEFAULT_LOCALE, LOCALE_CODES, type LocaleCode } from "./locales.ts";

export interface I18nString {
  _i18n: Partial<Record<LocaleCode, string>>;
}

export type Translatable = string | I18nString;

const i18nMapSchema = z
  .object({
    // partialRecord: zod v4's z.record(enum, …) is EXHAUSTIVE (every locale
    // required) — partialRecord keeps it a sparse map, which is the point.
    _i18n: z.partialRecord(z.enum(LOCALE_CODES as [LocaleCode, ...LocaleCode[]]), z.string()),
  })
  .strict();

/** Accepts a plain string OR an i18n map — drop-in for any OPTIONAL text prop. */
export const translatableSchema = z.union([z.string(), i18nMapSchema]);

/** Required text: a non-empty string OR an i18n map carrying at least one value. */
export const translatableRequired = z.union([
  z.string().min(1),
  i18nMapSchema.refine((m) => Object.keys(m._i18n).length > 0, "needs at least one language"),
]);

/** A rich-text doc, optionally per-locale. The doc schema is injected to
 *  avoid an import cycle with the block schema. */
export function translatableDoc<T extends z.ZodTypeAny>(docSchema: T) {
  return z.union([
    docSchema,
    z.object({ _i18nDoc: z.partialRecord(z.enum(LOCALE_CODES as [LocaleCode, ...LocaleCode[]]), docSchema) }).strict(),
  ]);
}

export interface I18nDoc<D> {
  _i18nDoc: Partial<Record<LocaleCode, D>>;
}

export function isI18nDoc<D>(v: unknown): v is I18nDoc<D> {
  return typeof v === "object" && v !== null && "_i18nDoc" in v;
}

/** Resolve a (possibly per-locale) rich doc to a single doc for `locale`. */
export function resolveI18nDoc<D>(value: D | I18nDoc<D> | undefined, locale: LocaleCode, defaultLocale: LocaleCode = DEFAULT_LOCALE): D | undefined {
  if (value === undefined) return undefined;
  if (!isI18nDoc<D>(value)) return value;
  const map = value._i18nDoc;
  if (map[locale]) return map[locale];
  if (map[defaultLocale]) return map[defaultLocale];
  for (const code of LOCALE_CODES) if (map[code]) return map[code];
  return undefined;
}

export function isI18nString(v: unknown): v is I18nString {
  return typeof v === "object" && v !== null && "_i18n" in v && typeof (v as I18nString)._i18n === "object";
}

/**
 * Collapse a translatable to a string for `locale`:
 *   exact locale → project default → any non-empty present value → "".
 */
export function resolveI18n(value: Translatable | undefined, locale: LocaleCode, defaultLocale: LocaleCode = DEFAULT_LOCALE): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  const map = value._i18n;
  if (map[locale]) return map[locale]!;
  if (map[defaultLocale]) return map[defaultLocale]!;
  for (const code of LOCALE_CODES) {
    if (map[code]) return map[code]!;
  }
  return "";
}

/** Which locales a translatable actually has copy for (for coverage reports). */
export function localesPresent(value: Translatable | undefined): LocaleCode[] {
  if (value === undefined || typeof value === "string") return [];
  return LOCALE_CODES.filter((c) => !!value._i18n[c]);
}

/** Set one locale's text, promoting a plain string into an i18n map. */
export function setLocaleValue(value: Translatable | undefined, locale: LocaleCode, text: string, defaultLocale: LocaleCode = DEFAULT_LOCALE): Translatable {
  const base: Partial<Record<LocaleCode, string>> =
    typeof value === "string" ? { [defaultLocale]: value } : isI18nString(value) ? { ...value._i18n } : {};
  if (text) base[locale] = text;
  else delete base[locale];
  const keys = Object.keys(base);
  // collapse back to a plain string if only the default remains (keeps docs clean)
  if (keys.length === 0) return "";
  if (keys.length === 1 && keys[0] === defaultLocale) return base[defaultLocale]!;
  return { _i18n: base };
}
