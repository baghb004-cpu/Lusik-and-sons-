// ============================================================
// ShopIndexView — /shop landing page
// ============================================================
// The "everything Lusik makes" hub. Renders two distinct layouts:
//
//   DESKTOP (hidden lg:block) — the original navigation surface:
//     the "Everything Lusik makes" heading + intro paragraph +
//     a vertical 2-column grid of large category cards, each
//     linking to /shop/<categorySlug>.
//
//   MOBILE (lg:hidden) — modeled on the Apple Store app's
//     "Products" tab: a horizontally-scrolling strip of small
//     category "title cards" followed by a "Discover what's new"
//     hero card for the newest product. The MobilePageHeader
//     already shows the big "Shop" title above this view, so the
//     mobile layout deliberately omits its own large heading.
//
// No product detail surfaces here on either layout — this is a
// navigation step, not a buying surface. The heavy lifting
// (product galleries, configurators) lives one level deeper.
// ============================================================

import React from "react";
import { CATALOG } from "../../data/catalog.js";
import { Breadcrumbs } from "./Breadcrumbs.jsx";
import { ArrowRight } from "../icons.jsx";

// Per-category cover image for the mobile title cards. Keyed by
// category slug. Towels + Baby have no real photography yet, so
// they intentionally have NO entry here — the card falls back to
// a cream placeholder tile (see CategoryCard) rather than render
// a broken <img>. Update this map (don't inline paths) when Lusik
// delivers category-level photos for those two.
const MOBILE_CATEGORY_IMAGE = {
  blankets: "/img/abc-blanket/cover.jpg",
  bibs: "/img/bib-examples/01.jpg",
  // towels: (no real photo yet → placeholder tile)
  // baby:   (no real photo yet → placeholder tile)
};

// ------------------------------------------------------------
// CategoryCard — one Apple-Products-style "title card" in the
// horizontal mobile strip. Fixed size, white surface, soft
// border + shadow; product image fills the upper portion, the
// category label sits centered below in the display font.
// ------------------------------------------------------------
function CategoryCard({ category, onTap }) {
  const image = MOBILE_CATEGORY_IMAGE[category.slug] || null;

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`Browse ${category.label}`}
      className="flex flex-col items-stretch text-center"
      style={{
        flexShrink: 0,
        width: 140,
        height: 175,
        scrollSnapAlign: "start",
        background: "var(--bg-surface, #FFFFFF)",
        border: "1px solid var(--border-soft, rgba(26,22,18,0.08))",
        borderRadius: 18,
        boxShadow: "0 1px 6px rgba(26,22,18,0.06)",
        overflow: "hidden",
        padding: 8,
      }}
    >
      {/* Image region — upper ~68% of the card. Real photo when we
          have one (object-contain so the piece is never cropped),
          otherwise a cream placeholder tile carrying the label so
          the customer never sees a broken-image glyph. */}
      <div
        className="flex items-center justify-center"
        style={{ flex: "0 0 68%", borderRadius: 12, overflow: "hidden" }}
      >
        {image ? (
          <img
            src={image}
            alt={category.label}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "contain", padding: 2 }}
          />
        ) : (
          <div
            className="flex items-center justify-center w-full h-full"
            style={{ background: "rgba(176,136,66,0.06)", borderRadius: 12 }}
          >
            <span
              className="font-display"
              style={{ fontSize: "0.95rem", fontWeight: 500, color: "var(--text-primary, #1A1612)", opacity: 0.75 }}
            >
              {category.label}
            </span>
          </div>
        )}
      </div>

      {/* Label region — centered display-font category name. */}
      <div className="flex items-center justify-center" style={{ flex: 1, paddingTop: 6 }}>
        <span
          className="font-display leading-tight"
          style={{ fontSize: "0.95rem", fontWeight: 500, color: "var(--text-primary, #1A1612)" }}
        >
          {category.label}
        </span>
      </div>
    </button>
  );
}

export function ShopIndexView({ onNavigateHome, onNavigateCategory, onNavigateProduct }) {
  return (
    <div className="fade-in">
      {/* ====================================================== */}
      {/* MOBILE — Apple "Products" tab style. No big heading     */}
      {/* (MobilePageHeader already renders "Shop" above this).   */}
      {/* ====================================================== */}
      <div className="lg:hidden">
        {/* Horizontal category card strip. The negative-margin /
            matching-padding trick lets the first card sit flush
            with the page edge while still allowing horizontal
            overscroll, and the trailing pad lets the last card
            (and the "peek" of the next) scroll fully into view. */}
        <section>
          <p
            className="text-[0.65rem] tracking-[0.25em] uppercase px-6 mb-3"
            style={{ color: "var(--text-muted, rgba(26,22,18,0.5))" }}
          >
            Browse by category
          </p>
          <div
            className="flex"
            style={{
              gap: 12,
              overflowX: "auto",
              scrollSnapType: "x proximity",
              WebkitOverflowScrolling: "touch",
              paddingLeft: 24,
              paddingRight: 24,
              paddingBottom: 4,
            }}
          >
            {Object.values(CATALOG).map((category) => (
              <CategoryCard
                key={category.slug}
                category={category}
                onTap={() => onNavigateCategory(category.slug)}
              />
            ))}
          </div>
        </section>

        {/* "Discover what's new" hero — the newest product: the
            Bari Akhorzhak Bib & Burp Cloth Set. One large rounded
            full-width card, full-bleed cover photo on top, name +
            one supporting line below. Tapping deep-links straight
            to the product page. */}
        <section className="px-6 mt-9 mb-10">
          <h2
            className="font-display mb-4"
            style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary, #1A1612)" }}
          >
            Discover what's new
          </h2>
          <button
            type="button"
            onClick={() => onNavigateProduct?.("bibs", "bari-akhorzhak-bib-burp-cloth-set")}
            aria-label="View The Bari Akhorzhak Bib & Burp Cloth Set"
            className="block w-full text-left"
            style={{
              background: "var(--bg-surface, #FFFFFF)",
              border: "1px solid var(--border-soft, rgba(26,22,18,0.08))",
              borderRadius: 20,
              boxShadow: "0 2px 12px rgba(26,22,18,0.07)",
              overflow: "hidden",
            }}
          >
            <img
              src="/img/bari-akhorzhak-set/cover.jpg"
              alt="The Bari Akhorzhak Bib & Burp Cloth Set"
              loading="lazy"
              style={{ width: "100%", height: 280, objectFit: "cover", display: "block" }}
            />
            <div style={{ padding: "18px 20px 20px" }}>
              <p
                className="text-[0.6rem] tracking-[0.3em] uppercase mb-2"
                style={{ color: "#B08842" }}
              >
                Newest
              </p>
              <h3
                className="font-display mb-1.5"
                style={{ fontSize: "1.25rem", fontWeight: 400, letterSpacing: "-0.01em", color: "var(--text-primary, #1A1612)" }}
              >
                The Bari Akhorzhak Bib &amp; Burp Cloth Set
              </h3>
              <p className="text-sm opacity-70 leading-relaxed">
                Two Armenian meal blessings, one matched set.
              </p>
            </div>
          </button>
        </section>
      </div>

      {/* ====================================================== */}
      {/* DESKTOP — unchanged original layout.                    */}
      {/* ====================================================== */}
      <div className="hidden lg:block max-w-6xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <Breadcrumbs trail={[
          { label: "Home", onClick: onNavigateHome },
          { label: "Shop" },
        ]} />

        <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "#B08842" }}>The shop</p>
        <h1 className="font-display text-4xl lg:text-6xl mb-4" style={{ fontWeight: 400, letterSpacing: "-0.02em" }}>
          Everything Lusik <em style={{ fontWeight: 400 }}>makes</em>.
        </h1>
        <p className="text-base lg:text-lg opacity-75 max-w-2xl leading-relaxed mb-12 lg:mb-16">
          Cross-stitched blankets for the crib. Embroidered bibs for the kitchen table. Ceremonial towels for the days that count. Small fabric objects for the very first weeks. Each piece by Lusik's own hand, from her home in Cypress, California — made to order, made to last. Pick a category to step in.
        </p>

        <div className="grid sm:grid-cols-2 gap-5 lg:gap-6">
          {Object.entries(CATALOG).map(([_, category], i) => {
            const total       = category.products.length;
            const liveCount   = category.products.filter((p) => p.status === "live").length;
            const subtitleParts = [];
            if (liveCount > 0)   subtitleParts.push(`${liveCount} available now`);
            if (total - liveCount > 0) subtitleParts.push(`${total - liveCount} coming soon`);

            return (
              <button
                key={category.slug}
                onClick={() => onNavigateCategory(category.slug)}
                className="lg-button lg-shine text-left p-6 lg:p-8 transition stagger-reveal"
                style={{ "--i": i }}
                aria-label={`Browse ${category.label}`}
              >
                <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-3" style={{ color: "#B08842" }}>
                  {category.eyebrow}
                </p>
                <h2 className="font-display text-2xl lg:text-3xl mb-2" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
                  {category.label}
                </h2>
                <p className="text-sm opacity-75 leading-relaxed mb-5">
                  {category.description}
                </p>
                <div className="flex items-center justify-between gap-3 pt-3" style={{ borderTop: "1px solid rgba(26,22,18,0.10)" }}>
                  <p className="text-[0.65rem] tracking-[0.2em] uppercase opacity-65">
                    {subtitleParts.join(" · ")}
                  </p>
                  <span className="text-[0.65rem] tracking-[0.2em] uppercase flex items-center gap-1.5" style={{ color: "#B08842", fontWeight: 500 }}>
                    Step in <ArrowRight size={12} strokeWidth={1.75} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
