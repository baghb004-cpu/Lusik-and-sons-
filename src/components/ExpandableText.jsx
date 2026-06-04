"use client";

// ============================================================
// ExpandableText — clamp long copy to a few lines + "Read more"
// ============================================================
// Keeps product descriptions short so the buy button stays high on
// the page (especially on mobile). Collapsed, the text is clamped to
// `clampLines` via CSS line-clamp; "Read more" reveals the rest.
// The full text is always in the DOM (good for SEO + accessibility),
// just visually clamped.
// ============================================================

import React, { useState } from "react";
import { Plus, Minus } from "./icons.jsx";
import { useT } from "../i18n/LangContext.jsx";

export function ExpandableText({
  text,
  clampLines = 2,
  className = "",
  textClassName = "text-base leading-relaxed opacity-85",
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!text) return null;

  return (
    <div className={className}>
      <p
        className={textClassName}
        style={open ? undefined : {
          display: "-webkit-box",
          WebkitLineClamp: String(clampLines),
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {text}
      </p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-2 inline-flex items-center gap-1.5 text-[0.7rem] tracking-[0.15em] uppercase hover:opacity-70 transition"
        style={{ color: "var(--accent)", fontWeight: 600 }}
      >
        {open ? t("common.showLess") : t("common.readMore")}
        {open ? <Minus size={12} strokeWidth={2} /> : <Plus size={12} strokeWidth={2} />}
      </button>
    </div>
  );
}
