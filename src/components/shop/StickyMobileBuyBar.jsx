"use client";

// ============================================================
// StickyMobileBuyBar — mobile-only, scroll-aware Add-to-Bag bar
// ============================================================
// Slides up from above the floating bottom-nav when the real in-page
// Add-to-Bag button is scrolled out of view, and slides away once it's
// back in view. Mobile only (lg:hidden); desktop never sees it.
//
// `position: fixed`, so it adds nothing to the document flow → zero CLS.
// It's mutually exclusive with the in-page button, so it never covers
// the real one and needs no extra page padding. Reuses the same add
// handler, so cart + Stripe behavior is unchanged.
// ============================================================

import React from "react";
import { ArrowRight } from "../icons.jsx";

export function StickyMobileBuyBar({ visible, label, price, onClick }) {
  return (
    <div
      className="lg:hidden fixed left-0 right-0 z-40 px-4"
      style={{
        // Sits just above the floating bottom-nav island.
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)",
        transform: visible ? "translateY(0)" : "translateY(180%)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.3s ease, opacity 0.25s ease",
        pointerEvents: visible ? "auto" : "none",
        willChange: "transform",
      }}
      aria-hidden={!visible}
    >
      <button
        type="button"
        onClick={onClick}
        tabIndex={visible ? 0 : -1}
        className="w-full py-3.5 text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-2"
        style={{
          background: "var(--ink)",
          color: "var(--text-on-ink)",
          borderRadius: "999px",
          boxShadow: "0 8px 24px rgba(26,22,18,0.22)",
        }}
      >
        {label} — ${price} <ArrowRight size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}
