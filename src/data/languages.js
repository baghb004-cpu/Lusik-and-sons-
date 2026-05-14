// ============================================================
// LANGUAGES — the i18n switcher options
// ============================================================
// Used by the language toggle in the header. Adding a new
// language here requires also adding a top-level key to
// TRANSLATIONS in src/i18n/translations.js (still being
// migrated — currently in index.html ~line 2082).
//
// `code`     — ISO 639-1 / BCP 47 short tag (drives the JSON-LD
//              inLanguage field and the <html lang=""> attribute)
// `label`    — what the switcher shows when the UI is in English
// `native`   — what the switcher shows when in the language itself
// `direction` — 'ltr' / 'rtl' (Armenian is ltr; reserved for later)
//
// MIRRORED FROM index.html (~line 2077).
// ============================================================

export const LANGUAGES = [
  { code: "en", label: "English",  native: "English",  direction: "ltr" },
  { code: "hy", label: "Armenian", native: "Հայերեն", direction: "ltr" },
];
