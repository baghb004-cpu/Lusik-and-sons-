// ============================================================
// i18n — the offline locale library (Phase: languages)
// ============================================================
// Five locales baked in, no network: each carries its writing
// direction (Arabic is RTL — a real layout flip) and an offline
// font stack that prefers a bundled woff2 family, then falls back
// to the OS's own script fonts so text renders correctly EVEN
// BEFORE the woff2 binaries are dropped in (see public/fonts/).
//
// Endonyms (the language's own name) are what a switcher shows —
// a Russian speaker looks for "Русский", not "Russian".
// ============================================================

export type LocaleCode = "en" | "hy" | "ar" | "ru" | "es";
export type Direction = "ltr" | "rtl";

export interface Locale {
  code: LocaleCode;
  /** English name, for the editor. */
  label: string;
  /** The language's own name, for the visitor-facing switcher. */
  endonym: string;
  dir: Direction;
  /** Bundled family name (see fonts.ts) → script-appropriate system fallbacks. */
  fontStack: string;
}

// System fallbacks chosen for broad offline script coverage across
// Windows / macOS / Linux / Android / iOS.
const ARMENIAN_SYS = '"Noto Sans Armenian", "Mshtakan", "Sylfaen", system-ui, sans-serif';
const ARABIC_SYS = '"Noto Sans Arabic", "Geeza Pro", "Segoe UI", "Tahoma", system-ui, sans-serif';
const CYRILLIC_SYS = '"Noto Sans", "Segoe UI", "Helvetica Neue", system-ui, sans-serif';
const LATIN_SYS = '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif';

export const LOCALES: Locale[] = [
  { code: "en", label: "English", endonym: "English", dir: "ltr", fontStack: `"BW Latin", ${LATIN_SYS}` },
  { code: "hy", label: "Armenian", endonym: "Հայերեն", dir: "ltr", fontStack: `"BW Armenian", ${ARMENIAN_SYS}` },
  { code: "ar", label: "Arabic", endonym: "العربية", dir: "rtl", fontStack: `"BW Arabic", ${ARABIC_SYS}` },
  { code: "ru", label: "Russian", endonym: "Русский", dir: "ltr", fontStack: `"BW Cyrillic", ${CYRILLIC_SYS}` },
  { code: "es", label: "Spanish", endonym: "Español", dir: "ltr", fontStack: `"BW Latin", ${LATIN_SYS}` },
];

export const LOCALE_CODES = LOCALES.map((l) => l.code);
export const DEFAULT_LOCALE: LocaleCode = "en";

export function localeByCode(code: string): Locale | null {
  return LOCALES.find((l) => l.code === code) ?? null;
}

export function isRtl(code: string): boolean {
  return localeByCode(code)?.dir === "rtl";
}

/** Validate a list of enabled locale codes; always keeps a usable default. */
export function normalizeLocales(codes: string[], fallback: LocaleCode = DEFAULT_LOCALE): LocaleCode[] {
  const valid = codes.filter((c): c is LocaleCode => LOCALE_CODES.includes(c as LocaleCode));
  return valid.length > 0 ? [...new Set(valid)] : [fallback];
}
