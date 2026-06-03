// ============================================================
// LangContext, useT, useLang, LanguageProvider
// ============================================================
// The i18n surface every component reads from. Three exports
// matter at the call site:
//
//   useT()        → returns a `t(key, vars?)` function that
//                   looks up the dotted key in the current
//                   language, falls back to English, and
//                   interpolates {variables} from `vars`.
//   useLang()     → returns { lang, setLang, bannerSeen,
//                   setBannerSeen, hydrated }.
//   <LanguageProvider> → wraps <App>. Reads the stored
//                   preference on mount, persists changes
//                   to localStorage("lusik_lang_v1").
//
// Missing keys fall through to English; if a key is missing
// EVERYWHERE, the literal key string is returned so the dev
// sees exactly what to add to translations.js.
//
// ============================================================

import React, { useState, useEffect } from "react";
import { TRANSLATIONS } from "./translations.js";

// React Context for the current language. The default value
// here matters: a future component placed above the provider
// won't crash useT() — it'll just always render English.
export const LangContext = React.createContext({
  lang: "en",
  setLang: () => {},
  bannerSeen: true,
  setBannerSeen: () => {},
  hydrated: false,
});

// Deep-read a dotted key from a translation object.
// `getKey(translations.en, "hero.headline")` returns the string.
// Returns undefined if any segment is missing.
function getTranslation(obj, key) {
  return key.split(".").reduce(
    (acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined),
    obj,
  );
}

// The hook every component uses. Returns a `t(key, vars?)` function that:
//   1. Looks up the key in the current language
//   2. Falls back to English if missing
//   3. Falls back to the key itself if missing from both (so the dev
//      sees exactly which key needs adding)
//   4. Interpolates {variables} from the optional vars object
export function useT() {
  const { lang } = React.useContext(LangContext);
  return React.useCallback((key, vars) => {
    let str = getTranslation(TRANSLATIONS[lang], key);
    if (str === undefined) str = getTranslation(TRANSLATIONS.en, key);
    if (str === undefined) return key; // visible "missing key" indicator
    if (vars && typeof str === "string") {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      });
    }
    return str;
  }, [lang]);
}

// Hook for the current language code, plus a setter that persists
// to localStorage. Also exposes the first-visit-banner state for
// the LanguageBanner component.
export function useLang() {
  return React.useContext(LangContext);
}

// LanguageProvider — wraps the app. Reads stored preference on
// mount, persists changes. `bannerSeen` tracks whether the
// first-visit language banner should appear.
export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState("en");
  const [bannerSeen, setBannerSeen] = useState(true); // assume seen until storage loads
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("lusik_lang_v1");
      if (stored && TRANSLATIONS[stored]) {
        setLangState(stored);
        setBannerSeen(true);
      } else {
        // No preference stored — show the banner once
        setBannerSeen(false);
      }
    } catch {
      // localStorage blocked or unavailable — show banner, don't persist
      setBannerSeen(false);
    }
    setHydrated(true);
  }, []);

  const setLang = React.useCallback((next) => {
    if (!TRANSLATIONS[next]) return;
    setLangState(next);
    setBannerSeen(true);
    try { localStorage.setItem("lusik_lang_v1", next); } catch {}
  }, []);

  return (
    <LangContext.Provider value={{ lang, setLang, bannerSeen, setBannerSeen, hydrated }}>
      {children}
    </LangContext.Provider>
  );
}
