// ============================================================
// TierToggle — the "Lighter version" switch (capability ladder)
// ============================================================
// Lets a visitor pick the lean tier by hand (fewer animations, lighter
// pages) or climb back to full on a device the ladder judged slow.
//
// Semantics of unchecking: if detection alone would already say "full",
// the choice is cleared (back to automatic, so a later 2G trip still
// gets the lighter site); only when detection would keep the visitor
// below full does unchecking store an explicit "full" (the climb-back
// case). The ladder never traps anyone in a tier they did not pick.
//
// Rendered in the desktop footer and in the mobile "More" strip on the
// For You page. A native checkbox: keyboard- and screen-reader-ready
// without extra ARIA. Renders nothing when CONFIG.TIERS.ENABLED is off.
// ============================================================
import React, { useId } from "react";
import { useT } from "../i18n/LangContext.jsx";
import { CONFIG } from "../data/config.js";
import { useTier } from "../lib/useTier";
import { setTierChoice, getDetectedTier } from "../lib/capability";

export function TierToggle({ className = "" }) {
  const t = useT();
  const tier = useTier();
  const id = useId();
  if (CONFIG.TIERS?.ENABLED === false) return null;
  const lighter = tier !== "full";
  const onChange = (e) => {
    if (e.target.checked) setTierChoice("lean");
    else setTierChoice(getDetectedTier() === "full" ? null : "full");
  };
  return (
    <label htmlFor={id} className={`flex items-start gap-2 cursor-pointer ${className}`} data-tier-toggle="">
      <input
        id={id}
        type="checkbox"
        checked={lighter}
        onChange={onChange}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-hint`}
        className="mt-[3px] h-4 w-4 flex-shrink-0 accent-[var(--accent)]"
      />
      <span className="flex flex-col">
        <span id={`${id}-title`} className="text-sm leading-tight">{t("footer.lighterVersion")}</span>
        <span id={`${id}-hint`} className="text-xs leading-snug opacity-70">{t("footer.lighterVersionHint")}</span>
      </span>
    </label>
  );
}
