"use client";

// ============================================================
// ProductVariationNote — the product-variation disclaimer
// ============================================================
// A tasteful, warm "these photos are examples" note shown on
// product detail pages (and reusable elsewhere). Protects the
// business: every piece is handmade, so the exact fabric, trim,
// closure, and colors may differ from the sample photos — and
// for bibs, the neck closure in particular may differ from older
// photos. Copy lives in i18n (`disclaimer.*`) so it translates.
//
// Props:
//   bib    — include the bib-specific neck-closure sentence.
//   className — extra layout classes from the caller.
// ============================================================

import React from "react";
import { useT } from "../i18n/LangContext.jsx";

export function ProductVariationNote({ bib = false, className = "" }) {
  const t = useT();
  return (
    <div
      className={`text-xs leading-relaxed ${className}`}
      style={{
        background: "var(--accent-soft)",
        border: "1px solid var(--accent-strong)",
        borderRadius: 12,
        padding: "12px 14px",
        color: "var(--text-secondary)",
      }}
    >
      <p style={{ color: "var(--accent)", fontWeight: 600, marginBottom: 4 }}>
        {t("disclaimer.heading")}
      </p>
      <p>
        {t("disclaimer.full")}
        {bib ? " " + t("disclaimer.bibClosure") : ""}
      </p>
    </div>
  );
}
