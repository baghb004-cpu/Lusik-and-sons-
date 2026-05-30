"use client";

// FooterLangToggle — MIRRORED FROM index.html (~line 2894).
import React from "react";
import { LangContext, useT } from "../i18n/LangContext.jsx";
import { LANGUAGES } from "../data/languages";

export function FooterLangToggle() {
  const { lang, setLang } = React.useContext(LangContext);
  const t = useT();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[0.6rem] tracking-[0.3em] uppercase opacity-50">
        {t("langToggle.label")}:
      </span>
      {LANGUAGES.map((l) => {
        const active = lang === l.code;
        return (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            className="text-xs px-2.5 py-1 transition"
            style={{
              background: active ? "#1A1612" : "transparent",
              color: active ? "#F5EFE3" : "inherit",
              border: `1px solid ${active ? "#1A1612" : "rgba(26,22,18,0.2)"}`,
              opacity: active ? 1 : 0.7,
            }}
            aria-pressed={active}
            aria-label={`Switch to ${l.label}`}
          >
            {l.code === "en" ? "EN" : l.native.split(" ")[0]}
          </button>
        );
      })}
    </div>
  );
}
