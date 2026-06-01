// ============================================================
// localize — pick a per-language field off a plain data object
// ============================================================
// Catalog/product data (src/data/*.js, content/products/*.json) is
// English by default. Where a short, card-level field has been
// translated, the Armenian sits alongside it under a `<field>_hy`
// key (e.g. `name` + `name_hy`, `tagline` + `tagline_hy`). This
// helper returns the right one for the active language, falling
// back to English whenever the translation is missing.
//
// Deliberately NOT used for the long-form `description` paragraphs
// or the care/detail prose — those are Lusik's own voice and are
// localized by her (the TODO_LUSIK convention), not auto-filled.
//
// Pair with `useLang()` in a component:
//   const { lang } = useLang();
//   loc(product, "name", lang)
// ============================================================

export function loc(obj, field, lang) {
  if (!obj) return "";
  if (lang && lang !== "en") {
    const translated = obj[`${field}_${lang}`];
    if (translated != null && translated !== "") return translated;
  }
  return obj[field];
}
