// ============================================================
// i18n — offline fonts (no Google, no network)
// ============================================================
// Generates @font-face CSS pointing at LOCAL /fonts/*.woff2 for
// exactly the scripts a site enables — so the exported site never
// calls Google Fonts. Each bundled family declares the OS-font
// fallbacks from locales.ts, so text renders correctly even
// BEFORE the woff2 binaries are added (the fallback is what makes
// "works offline on day one" true; the woff2 just pins the look).
//
// fontManifest() lists the files to drop into public/fonts/ —
// fetch them once with scripts/fetch-fonts.mjs (documented), or
// ship without them and rely on system fonts.
// ============================================================

import { LOCALES, type LocaleCode } from "./locales.ts";

interface BundledFamily {
  family: string; // the name used in locales.ts fontStack
  file: string; // expected woff2 in /fonts/
  scripts: LocaleCode[]; // which locales need it
  /** A real redistributable source (Noto, OFL) for the fetch script + docs. */
  source: string;
}

export const BUNDLED_FAMILIES: BundledFamily[] = [
  { family: "BW Latin", file: "latin.woff2", scripts: ["en", "es"], source: "Noto Sans (OFL)" },
  { family: "BW Armenian", file: "armenian.woff2", scripts: ["hy"], source: "Noto Sans Armenian (OFL)" },
  { family: "BW Arabic", file: "arabic.woff2", scripts: ["ar"], source: "Noto Sans Arabic (OFL)" },
  { family: "BW Cyrillic", file: "cyrillic.woff2", scripts: ["ru"], source: "Noto Sans (Cyrillic subset, OFL)" },
];

/** Only the families the enabled locales actually need. */
export function familiesFor(locales: LocaleCode[]): BundledFamily[] {
  return BUNDLED_FAMILIES.filter((f) => f.scripts.some((s) => locales.includes(s)));
}

/** @font-face blocks for the needed families. `fontPath` is the public dir. */
export function fontFaceCss(locales: LocaleCode[], fontPath = "/fonts"): string {
  return familiesFor(locales)
    .map(
      (f) => `@font-face {
  font-family: "${f.family}";
  src: url("${fontPath}/${f.file}") format("woff2");
  font-display: swap;
  font-weight: 100 900;
}`
    )
    .join("\n");
}

/** The per-locale CSS that sets direction + font-family on a scoped root. */
export function localeRootCss(locale: LocaleCode): string {
  const l = LOCALES.find((x) => x.code === locale);
  if (!l) return "";
  return `:root[lang="${locale}"], [data-locale="${locale}"] {\n  direction: ${l.dir};\n  font-family: ${l.fontStack};\n}`;
}

/** Every enabled locale's root CSS + the @font-face blocks — the export's i18n.css. */
export function buildI18nCss(locales: LocaleCode[], fontPath = "/fonts"): string {
  const faces = fontFaceCss(locales, fontPath);
  const roots = locales.map(localeRootCss).join("\n");
  return `${faces}\n\n${roots}\n`;
}

export interface FontManifestEntry {
  file: string;
  family: string;
  source: string;
  present: boolean; // filled by the caller after checking disk
}

export function fontManifest(locales: LocaleCode[]): FontManifestEntry[] {
  return familiesFor(locales).map((f) => ({ file: f.file, family: f.family, source: f.source, present: false }));
}
