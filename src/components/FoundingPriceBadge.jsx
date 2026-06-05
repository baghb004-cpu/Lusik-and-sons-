// ============================================================
// FoundingPriceBadge + FoundingFromPrice — launch-promo UI bits
// ============================================================
// Small, brand-matched pieces for the time-boxed "Founding Price" promo.
// The badge uses the brand GOLD accent (var(--accent) = #B08842) with
// cream text — deliberately NOT a loud red "SALE", so it reads as a
// curated, limited offer rather than a clearance tag. Render nothing when
// the promo isn't applicable (callers pass already-resolved values).
// ============================================================

import React from "react";
import { promoLabel } from "../lib/launchPromo.js";

// The gold pill. `label` defaults to the configured promo label.
export function FoundingPriceBadge({ label, className = "" }) {
  return (
    <span
      className={`inline-block text-[0.6rem] tracking-[0.18em] uppercase px-2 py-0.5 rounded-full ${className}`}
      style={{ background: "var(--accent)", color: "#F5EFE3", fontWeight: 600 }}
    >
      {label || promoLabel()}
    </span>
  );
}

// A "From $35 → From $29" line for the catalog-driven shop cards.
// `fromLabel(price)` formats a "From $X" string (pass the i18n t-helper's
// output so it stays translated). Original price struck in muted gray,
// founding price in ink, plus the gold badge.
export function FoundingFromPrice({ normalLabel, foundingLabel, label, className = "" }) {
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}>
      <span className="text-sm line-through" style={{ color: "var(--text-muted, rgba(26,22,18,0.5))" }}>
        {normalLabel}
      </span>
      <span className="text-sm" style={{ fontWeight: 600, color: "var(--text-primary, #1A1612)" }}>
        {foundingLabel}
      </span>
      <FoundingPriceBadge label={label} />
    </span>
  );
}
