// ============================================================
// LangToggleCompact — Asbarez-style one-tap language switch
// ============================================================
// Shows the label of the language you'd switch TO (in English →
// "ՀԱՅ"; in Armenian → "ENG"), and tapping flips between the two.
// The site's Armenian is Eastern (hy). The fuller multi-language
// switcher still lives in the footer (FooterLangToggle).
// ============================================================

import React from "react";
import { LangContext } from "../i18n/LangContext.jsx";

export function LangToggleCompact() {
  const { lang, setLang } = React.useContext(LangContext);
  const goingToArmenian = lang === "en";
  const next = goingToArmenian ? "hy" : "en";
  const label = goingToArmenian ? "ՀԱՅ" : "ENG";

  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      aria-label={goingToArmenian ? "Switch to Armenian" : "Switch to English"}
      style={{
        fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
        fontSize: "0.8rem",
        fontWeight: 600,
        letterSpacing: "0.05em",
        color: "#B08842",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "4px 2px",
      }}
    >
      {label}
    </button>
  );
}
