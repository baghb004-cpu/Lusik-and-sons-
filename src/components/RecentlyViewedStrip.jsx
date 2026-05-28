// ============================================================
// RecentlyViewedStrip — mobile horizontal "recently viewed" cards
// ============================================================
// Shared between the mobile Search page (MobileSearchView) and the
// mobile "Your recent activity" block on the home page (HomeView).
// Mirrors the Apple Store app's Recently Viewed strip: a horizontal
// scroll row of square product cards with the name clamped below.
//
// Mobile-only by construction — both call sites render it only inside
// lg:hidden surfaces, so this component carries no desktop styling.
//
// Props:
//   items    — array of { slug, categorySlug, name, image? }
//   onTap    — (categorySlug, slug) => void
//   onClear  — optional () => void; when present a "Clear" button
//              renders in the header row
//   heading  — section label text (e.g. "Recently Viewed")
//
// Renders nothing when there are no items.
// ============================================================

import React from "react";

export function RecentlyViewedStrip({ items = [], onTap, onClear, heading = "Recently Viewed", large = false }) {
  if (!items || items.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        {/* `large` renders the Apple Store "For You" section style (big,
            bold, ink). Default is the compact gold eyebrow used elsewhere
            (e.g. the search view), so only opt-in callers change. */}
        <p
          className={large ? "leading-tight" : "text-xs tracking-[0.2em] uppercase"}
          style={large
            ? { fontSize: "1.55rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }
            : { color: "var(--text-muted)", fontWeight: 500 }}
        >
          {heading}
        </p>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs"
            style={{ color: "var(--accent)", fontWeight: 500 }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Horizontal scroll strip. Negative margin + matching padding so
          the cards can scroll edge-to-edge within the page's 24px gutter
          without clipping the first/last card. */}
      <div
        className="flex gap-3 overflow-x-auto"
        style={{
          marginLeft: "-24px",
          marginRight: "-24px",
          paddingLeft: "24px",
          paddingRight: "24px",
          paddingBottom: "4px",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {items.map((item) => (
          <button
            key={item.slug}
            type="button"
            onClick={() => onTap?.(item.categorySlug, item.slug)}
            className="flex-shrink-0 text-left"
            style={{ width: 140 }}
          >
            <div
              className="overflow-hidden rounded-2xl"
              style={{
                aspectRatio: "1 / 1",
                background: "var(--bg-subtle, #F5EFE3)",
              }}
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name || ""}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
            </div>
            <p
              className="text-xs mt-2 leading-snug"
              style={{
                color: "var(--text-primary)",
                fontWeight: 500,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {item.name}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
