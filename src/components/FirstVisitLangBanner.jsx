"use client";

import React from "react";
import { LangContext } from "../i18n/LangContext.jsx";

export function FirstVisitLangBanner() {
  const { bannerSeen, setBannerSeen, setLang, hydrated } = React.useContext(LangContext);

  // Don't render until storage check completes — avoids flash of banner for
  // returning visitors who already have a stored preference.
  if (!hydrated || bannerSeen) return null;

  const handlePick = (code) => {
    setLang(code);   // setLang already sets bannerSeen=true and persists
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(26,22,18,0.55)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lang-banner-title"
    >
      <div
        className="relative w-full max-w-md fade-in"
        style={{ background: "var(--bg-page)", border: "1px solid var(--border-default)" }}
      >
        {/* Header */}
        <div className="p-6 lg:p-8 text-center" style={{ borderBottom: "1px solid rgba(26,22,18,0.08)" }}>
          <p className="text-[0.6rem] tracking-[0.4em] uppercase mb-3" style={{ color: "var(--accent)" }}>
            Բարի եկաք · Welcome
          </p>
          <h2
            id="lang-banner-title"
            className="font-display text-2xl lg:text-3xl mb-2"
            style={{ fontWeight: 400, letterSpacing: "-0.01em" }}
          >
            Կը փափաքի՞ք հայերէնով կարդալ:
          </h2>
          <p className="text-sm opacity-70">
            Would you like to view this site in Armenian?
          </p>
        </div>

        {/* Two language buttons — Armenian (Հայերեն) takes the dark primary
            position since the customer's likely-Armenian if they're here.
            English is the secondary option. */}
        <div className="p-6 lg:p-8 space-y-3">
          <button
            onClick={() => handlePick("hy")}
            className="w-full p-4 text-center transition hover:opacity-90"
            style={{ background: "var(--ink)", color: "var(--text-on-ink)" }}
          >
            <p className="font-display text-xl" style={{ fontWeight: 500 }}>Հայերեն</p>
            <p className="text-[0.7rem] opacity-70 mt-1 tracking-wider uppercase">Armenian</p>
          </button>

          <button
            onClick={() => handlePick("en")}
            className="w-full p-4 text-center transition hover:bg-[rgba(26,22,18,0.04)]"
            style={{ border: "1px solid rgba(26,22,18,0.2)" }}
          >
            <p className="font-display text-xl" style={{ fontWeight: 500 }}>English</p>
            <p className="text-[0.7rem] opacity-70 mt-1 tracking-wider uppercase">Continue in English</p>
          </button>
        </div>

        {/* Footnote */}
        <div className="px-6 lg:px-8 pb-6 text-center">
          <p className="text-[0.65rem] opacity-50 italic">
            You can change your language anytime from the footer.
          </p>
        </div>
      </div>
    </div>
  );
}
