// i18n / offline languages — public surface.

export {
  LOCALES,
  LOCALE_CODES,
  DEFAULT_LOCALE,
  localeByCode,
  isRtl,
  normalizeLocales,
  type Locale,
  type LocaleCode,
  type Direction,
} from "./locales.ts";

export {
  translatableSchema,
  translatableRequired,
  translatableDoc,
  resolveI18n,
  resolveI18nDoc,
  setLocaleValue,
  localesPresent,
  isI18nString,
  isI18nDoc,
  type Translatable,
  type I18nString,
} from "./translatable.ts";

export { localizeBlocks, translationCoverage, TRANSLATABLE_FIELDS } from "./localize.ts";

export {
  i18nSettingsSchema,
  DEFAULT_I18N_SETTINGS,
  I18N_SETTINGS_PATH,
  type I18nSettings,
} from "./settings.ts";

export {
  BUNDLED_FAMILIES,
  familiesFor,
  fontFaceCss,
  localeRootCss,
  buildI18nCss,
  fontManifest,
  type FontManifestEntry,
} from "./fonts.ts";
