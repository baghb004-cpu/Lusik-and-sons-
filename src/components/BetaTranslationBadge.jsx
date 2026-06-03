"use client";

import React from "react";
import { LangContext, useT } from "../i18n/LangContext.jsx";

export function BetaTranslationBadge() {
  const { lang } = React.useContext(LangContext);
  const t = useT();
  if (lang === "en") return null;
  return (
    <div
      className="mt-4 p-3 text-xs leading-relaxed"
      style={{
        background: "rgba(176,136,66,0.08)",
        border: "1px dashed rgba(176,136,66,0.4)",
        color: "rgba(26,22,18,0.85)",
      }}
      role="note"
    >
      <p className="font-display text-sm mb-1" style={{ fontWeight: 500, color: "var(--accent)" }}>
        ⚠ {t("betaBadge.label")}
      </p>
      <p>{t("betaBadge.body")}</p>
    </div>
  );
}
