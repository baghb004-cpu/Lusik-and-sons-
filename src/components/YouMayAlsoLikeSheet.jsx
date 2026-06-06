"use client";

// ============================================================
// YouMayAlsoLikeSheet — Apple-style post-add upsell sheet
// ============================================================
// Opens the moment a product is added to the bag (driven by SiteChrome
// off SiteProvider's cartOpenSignal). Mirrors the Apple Store flow:
//   - a header with a back arrow (left), "You may also like" (center),
//     and a "Continue" pill (top-right) that proceeds to the bag
//   - a "✓ Product added to Bag" pill that fades away gracefully
//   - a grid of other live products the customer can explore + add
//
// Bottom sheet on mobile (slides up), centered modal on desktop. Tapping
// a card closes the sheet and navigates to that product (made-to-order
// items need their name/options chosen, so we send them to the product
// page to finish the add rather than adding blind).
// ============================================================

import React, { useEffect, useState } from "react";
import { getRecommendations } from "../lib/recommendations.js";
import { useT, useLang } from "../i18n/LangContext.jsx";
import { loc } from "../i18n/localize.js";

function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function YouMayAlsoLikeSheet({ open, addedKey, onClose, onContinue, onNavigateProduct }) {
  const t = useT();
  const { lang } = useLang();
  const [shown, setShown] = useState(false);     // drives the slide-up transition
  const [showAdded, setShowAdded] = useState(true); // the fading "added" pill

  // Slide-up on open; reset the "added" pill each time it opens, then fade it.
  useEffect(() => {
    if (!open) { setShown(false); return undefined; }
    setShowAdded(true);
    const raf = requestAnimationFrame(() => setShown(true));
    const fade = setTimeout(() => setShowAdded(false), 2200);
    return () => { cancelAnimationFrame(raf); clearTimeout(fade); };
  }, [open]);

  // Escape closes; lock body scroll while open.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  const recs = getRecommendations(addedKey, 4);

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center lg:justify-center" role="dialog" aria-modal="true" aria-label="Product added — you may also like">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(20,16,12,0.45)", opacity: shown ? 1 : 0, transition: "opacity 0.25s ease" }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="relative w-full lg:max-w-2xl flex flex-col rounded-t-3xl lg:rounded-3xl"
        style={{
          background: "var(--bg-surface, #FFFFFF)",
          maxHeight: "86vh",
          boxShadow: "0 -10px 40px rgba(26,22,18,0.22)",
          transform: shown ? "translateY(0)" : "translateY(28px)",
          opacity: shown ? 1 : 0,
          transition: "transform 0.3s ease, opacity 0.25s ease",
        }}
      >
        {/* Header: back (left) · title (center) · Continue (top-right) */}
        <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.back") || "Back"}
            className="flex items-center justify-center rounded-full"
            style={{ width: 40, height: 40, background: "var(--bg-subtle, rgba(26,22,18,0.06))", color: "var(--text-primary)" }}
          >
            <ChevronLeft />
          </button>
          <h2 className="font-display text-base lg:text-lg" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
            You may also like
          </h2>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-full px-5 py-2 text-sm"
            style={{ background: "var(--ink)", color: "var(--text-on-ink)", fontWeight: 600 }}
          >
            Continue
          </button>
        </div>

        {/* Fading "Product added to Bag" pill */}
        <div style={{ maxHeight: showAdded ? 60 : 0, opacity: showAdded ? 1 : 0, overflow: "hidden", transition: "max-height 0.4s ease, opacity 0.4s ease" }}>
          <div className="flex justify-center px-4 pt-4">
            <span
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
              style={{ background: "var(--accent-soft, #FAF1DF)", color: "var(--accent)", fontWeight: 600 }}
            >
              <Check /> Product added to Bag
            </span>
          </div>
        </div>

        {/* Recommendations */}
        <div className="overflow-y-auto px-4 pb-6 pt-4">
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            {recs.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => onNavigateProduct?.(p.categorySlug, p.slug)}
                className="text-left flex flex-col rounded-2xl overflow-hidden"
                style={{ border: "1px solid var(--border-soft)", background: "var(--bg-surface, #FFFFFF)" }}
              >
                <div className="w-full" style={{ aspectRatio: "1 / 1", overflow: "hidden", background: "var(--bg-subtle, #FBF6EC)" }}>
                  {/* plain img — these are static /img assets */}
                  <img src={p.image} alt={loc(p, "name", lang)} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                </div>
                <div className="p-3">
                  <p className="text-sm leading-snug" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                    {loc(p, "name", lang)}
                  </p>
                  {typeof p.priceFrom === "number" && (
                    <p className="text-xs mt-1" style={{ color: "var(--accent)", fontWeight: 500 }}>
                      {t("shop.from", { price: p.priceFrom })}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
