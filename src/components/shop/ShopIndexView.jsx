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

import React, { useState, useRef } from "react";
import { CATALOG } from "../../data/catalog.js";
import { JOURNAL_POSTS } from "../../data/journalPosts.js";
import { Breadcrumbs } from "./Breadcrumbs.jsx";
import { HelpDecidingSection } from "./HelpDecidingSection.jsx";
import { ArrowRight, Heart, Home, Sparkles } from "../icons.jsx";

// ------------------------------------------------------------
// FEATURED_PIECES — the curated mobile "Featured pieces" set.
// Hardcoded on purpose: the copy here (eyebrow / tagline / price
// label) is intentional editorial framing, NOT derived from
// CATALOG. Re-deriving would lose the hand-written voice and the
// "By direct order" treatment for the commission-only crib
// blanket. If Lusik adds artwork or changes a price, edit here.
// All three image paths verified present under public/img/.
// ------------------------------------------------------------
const FEATURED_PIECES = [
  {
    categorySlug: "blankets",
    slug: "armenian-alphabet-blanket",
    eyebrow: "Lusik's signature",
    name: "The Armenian Alphabet Blanket",
    tagline: "Ա Բ Գ, hand cross-stitched corner to corner.",
    price: "From $65",
    image: "/img/abc-blanket/cover.jpg",
  },
  {
    categorySlug: "blankets",
    slug: "cotton-yarn-blanket",
    eyebrow: "The heirloom",
    name: "The Cotton Alphabet Crib Blanket",
    tagline: "Every letter of the Armenian alphabet, all thirty-six.",
    // Placeholder priced at $245, sold by commission — surface
    // the commission framing rather than a clickable "From" price.
    price: "By direct order · $245",
    image: "/img/cotton-yarn/cover.jpg",
  },
  {
    categorySlug: "bibs",
    slug: "baby-bib",
    eyebrow: "For every day",
    name: "The Custom Name Bib",
    tagline: "Your child's name, in Armenian or English.",
    price: "From $22",
    image: "/img/bib-examples/01.jpg",
  },
];

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

// ------------------------------------------------------------
// FeaturedPieceCard — one large Apple-Products "feature card":
// full-bleed product photo on top, an editorial body below with
// eyebrow / name / tagline and a footer that pairs the price with
// a "View" pill. "View" (not "Buy") because every piece needs the
// product page to pick colors / name / layout before checkout.
// ------------------------------------------------------------
function FeaturedPieceCard({ piece, onTap }) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`View ${piece.name}`}
      className="block w-full text-left"
      style={{
        background: "var(--bg-surface, #FFFFFF)",
        border: "1px solid var(--border-soft, rgba(26,22,18,0.08))",
        borderRadius: 20,
        boxShadow: "0 2px 12px rgba(26,22,18,0.07)",
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      <img
        src={piece.image}
        alt={piece.name}
        loading="lazy"
        style={{ width: "100%", height: 260, objectFit: "cover", display: "block" }}
      />
      <div style={{ padding: "18px 20px 20px" }}>
        <p
          className="text-[0.6rem] tracking-[0.3em] uppercase mb-2"
          style={{ color: "#B08842" }}
        >
          {piece.eyebrow}
        </p>
        <h3
          className="font-display mb-1.5"
          style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary, #1A1612)" }}
        >
          {piece.name}
        </h3>
        <p className="text-sm opacity-70 leading-relaxed">
          {piece.tagline}
        </p>
        <div className="flex items-center justify-between" style={{ marginTop: 14 }}>
          <span
            className="text-sm"
            style={{ fontWeight: 500, color: "var(--text-primary, #1A1612)" }}
          >
            {piece.price}
          </span>
          {/* Pill is purely visual — the whole card is the button. */}
          <span
            className="text-sm rounded-full"
            style={{
              background: "var(--text-primary, #1A1612)",
              color: "#F5EFE3",
              padding: "10px 22px",
              fontWeight: 500,
            }}
          >
            View
          </span>
        </div>
      </div>
    </button>
  );
}

// ------------------------------------------------------------
// JournalCard — one editorial card in the horizontal "From the
// Journal" carousel. Journal posts have no photography, so this
// is an all-text card: gold "Journal" eyebrow, post title, a
// line-clamped excerpt that flexes to fill, and a gold "Read"
// footer. Fixed width so the next card peeks at the page edge.
// ------------------------------------------------------------
function JournalCard({ post, onTap }) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`Read ${post.title}`}
      className="flex flex-col text-left"
      style={{
        flexShrink: 0,
        width: 300,
        minHeight: 210,
        scrollSnapAlign: "start",
        background: "var(--bg-surface, #FFFFFF)",
        border: "1px solid var(--border-soft, rgba(26,22,18,0.08))",
        borderRadius: 20,
        boxShadow: "0 2px 12px rgba(26,22,18,0.07)",
        padding: 20,
      }}
    >
      <p
        className="text-[0.6rem] tracking-[0.3em] uppercase mb-3"
        style={{ color: "#B08842" }}
      >
        Journal
      </p>
      <h3
        className="font-display mb-2"
        style={{
          fontSize: "1.3rem",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          lineHeight: 1.2,
          color: "var(--text-primary, #1A1612)",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {post.title}
      </h3>
      <p
        className="text-sm opacity-70 leading-relaxed"
        style={{
          flex: 1,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {post.excerpt}
      </p>
      <p
        className="text-[0.7rem] tracking-[0.15em] uppercase"
        style={{ color: "#B08842", marginTop: 12, fontWeight: 500 }}
      >
        Read · {post.readMinutes} min
      </p>
    </button>
  );
}

// ------------------------------------------------------------
// DIFFERENCE_SLIDES — the "Lusik & Sons difference" value-prop
// carousel (mirrors the Apple Store app's "The Apple Store
// difference" centered statements). Each slide is a single brand
// promise with an icon and a deep link into the relevant surface.
// `action` is mapped to a navigation callback in ShopIndexView so
// this data array stays free of component wiring.
// ------------------------------------------------------------
const DIFFERENCE_SLIDES = [
  {
    icon: Heart,
    text: "Made to order, made to last. Every stitch set down by Lusik's own hand.",
    linkLabel: "Shop the blankets",
    action: "blankets",
  },
  {
    icon: Home,
    text: "From her home in Cypress, California — stitched for yours.",
    linkLabel: "Read Lusik's journal",
    action: "journal",
  },
  {
    icon: Sparkles,
    text: "Your child's name and birth year, woven into the cloth — in Armenian or English.",
    linkLabel: "Personalize a blanket",
    action: "alphabet-blanket",
  },
];

// ------------------------------------------------------------
// DifferenceCarousel — full-width scroll-snap carousel of the
// brand-promise slides, with Apple-style pagination dots below
// (the active dot stretches into a pill). The active index tracks
// the scroll position so the dots stay in sync with a swipe.
// ------------------------------------------------------------
function DifferenceCarousel({ onSlideAction }) {
  const [active, setActive] = useState(0);
  const trackRef = useRef(null);

  const handleScroll = () => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setActive((prev) => (prev === i ? prev : i));
  };

  return (
    <section className="mb-10">
      <h2
        className="font-display mb-5 px-6"
        style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary, #1A1612)" }}
      >
        The Lusik &amp; Sons difference
      </h2>
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex"
        style={{
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {DIFFERENCE_SLIDES.map((slide, i) => {
          const Ico = slide.icon;
          return (
            <div
              key={i}
              className="flex flex-col items-center text-center px-8"
              style={{ flex: "0 0 100%", scrollSnapAlign: "center", paddingTop: 8, paddingBottom: 8 }}
            >
              <div
                className="flex items-center justify-center"
                style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(176,136,66,0.10)", marginBottom: 18 }}
              >
                <Ico size={28} strokeWidth={1.5} style={{ color: "#B08842" }} />
              </div>
              <p
                className="font-display"
                style={{ fontSize: "1.3rem", fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.01em", color: "var(--text-primary, #1A1612)", maxWidth: 320 }}
              >
                {slide.text}
              </p>
              <button
                type="button"
                onClick={() => onSlideAction?.(slide.action)}
                className="text-sm flex items-center gap-1.5"
                style={{ color: "#B08842", fontWeight: 500, marginTop: 16 }}
              >
                {slide.linkLabel} <ArrowRight size={14} strokeWidth={1.75} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center" style={{ gap: 7, marginTop: 20 }}>
        {DIFFERENCE_SLIDES.map((_, i) => (
          <span
            key={i}
            aria-hidden="true"
            style={{
              height: 7,
              width: i === active ? 20 : 7,
              borderRadius: 4,
              transition: "width 0.25s ease, background 0.25s ease",
              background: i === active ? "var(--text-primary, #1A1612)" : "rgba(26,22,18,0.22)",
            }}
          />
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------
// "Shop the collection" 2-column product grid (mirrors the Apple
// Store app's "Shop for your devices" grid). Built from CATALOG so
// prices stay in sync — only products that have real photography
// appear (towels + baby goods are skipped until Lusik delivers
// photos). The Custom Name Bib has no cover image of its own, so
// it borrows a representative bib-examples shot.
// ------------------------------------------------------------
const PRODUCT_IMAGE_FALLBACK = { "baby-bib": "/img/bib-examples/01.jpg" };

function buildGridItems() {
  const items = [];
  for (const category of Object.values(CATALOG)) {
    for (const p of category.products) {
      const image = p.coverImage || PRODUCT_IMAGE_FALLBACK[p.slug];
      if (!image) continue; // no real photo yet → leave it out
      let priceLabel;
      if (p.priceFrom && p.status === "live") priceLabel = `From $${p.priceFrom}`;
      else if (p.priceFrom) priceLabel = `$${p.priceFrom} · by order`;
      else priceLabel = "Made to order";
      items.push({
        categorySlug: category.slug,
        slug: p.slug,
        name: p.name,
        image,
        priceLabel,
        swatches: (p.colorways || []).slice(0, 5).map((c) => c.swatch),
      });
    }
  }
  return items;
}

const GRID_ITEMS = buildGridItems();

// Render any catalog swatch shape ({color} / {dual:[a,b]} /
// {gradient:[...]}) as a CSS background for a small dot.
function swatchBackground(s) {
  if (!s) return "transparent";
  if (s.color) return s.color;
  if (s.dual) return `linear-gradient(135deg, ${s.dual[0]} 0 50%, ${s.dual[1]} 50% 100%)`;
  if (s.gradient) return `conic-gradient(from 90deg, ${s.gradient.join(", ")})`;
  return "transparent";
}

function ProductGridCard({ item, onTap }) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`View ${item.name}`}
      className="flex flex-col text-left"
    >
      <div
        style={{
          background: "var(--bg-surface, #FFFFFF)",
          border: "1px solid var(--border-soft, rgba(26,22,18,0.08))",
          borderRadius: 18,
          boxShadow: "0 1px 6px rgba(26,22,18,0.06)",
          overflow: "hidden",
          aspectRatio: "1 / 1",
        }}
      >
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
      <h3
        className="font-display"
        style={{ fontSize: "0.98rem", fontWeight: 600, lineHeight: 1.25, letterSpacing: "-0.01em", color: "var(--text-primary, #1A1612)", marginTop: 12 }}
      >
        {item.name}
      </h3>
      <p className="text-sm" style={{ color: "var(--text-muted, rgba(26,22,18,0.65))", marginTop: 4 }}>
        {item.priceLabel}
      </p>
      {item.swatches.length > 0 && (
        <div className="flex items-center" style={{ gap: 6, marginTop: 10 }}>
          {item.swatches.map((s, i) => (
            <span
              key={i}
              aria-hidden="true"
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: swatchBackground(s),
                border: "1px solid rgba(26,22,18,0.12)",
                display: "inline-block",
              }}
            />
          ))}
        </div>
      )}
    </button>
  );
}

export function ShopIndexView({ onNavigateHome, onNavigateCategory, onNavigateProduct, onNavigateJournalPost, onNavigateJournal }) {
  // Map a DifferenceCarousel slide action to the right navigation.
  const handleDifferenceAction = (action) => {
    if (action === "blankets") onNavigateCategory?.("blankets");
    else if (action === "journal") onNavigateJournal?.();
    else if (action === "alphabet-blanket") onNavigateProduct?.("blankets", "armenian-alphabet-blanket");
  };

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

        {/* "Featured pieces" — a vertical stack of large Apple-style
            product feature cards for the curated set (signature
            blanket, heirloom crib blanket, name bib). Each card
            deep-links to its product page. */}
        <section className="px-6 mb-10">
          <h2
            className="font-display mb-4"
            style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary, #1A1612)" }}
          >
            Featured pieces
          </h2>
          {FEATURED_PIECES.map((piece) => (
            <FeaturedPieceCard
              key={`${piece.categorySlug}/${piece.slug}`}
              piece={piece}
              onTap={() => onNavigateProduct?.(piece.categorySlug, piece.slug)}
            />
          ))}
        </section>

        {/* "The Lusik & Sons difference" — full-width value-prop
            carousel with pagination dots, modeled on the Apple Store
            app's "The Apple Store difference" centered statements. */}
        <DifferenceCarousel onSlideAction={handleDifferenceAction} />

        {/* "Shop the collection" — a 2-column product grid (Apple's
            "Shop for your devices"): square photo tile, name, price,
            and color swatches where the product has colorways. Built
            from CATALOG so every card deep-links to a real product. */}
        <section className="px-6 mb-12">
          <h2
            className="font-display mb-5"
            style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary, #1A1612)" }}
          >
            Shop the collection
          </h2>
          <div className="grid grid-cols-2" style={{ rowGap: 22, columnGap: 16 }}>
            {GRID_ITEMS.map((item) => (
              <ProductGridCard
                key={`${item.categorySlug}/${item.slug}`}
                item={item}
                onTap={() => onNavigateProduct?.(item.categorySlug, item.slug)}
              />
            ))}
          </div>
        </section>

        {/* "From the Journal" — a horizontal editorial carousel of
            every journal post. Same edge-flush + trailing-pad trick
            as the category strip so the last card and the peek of
            the next scroll fully into view. */}
        <section className="mb-10">
          <h2
            className="font-display mb-4 px-6"
            style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary, #1A1612)" }}
          >
            From the Journal
          </h2>
          <div
            className="flex"
            style={{
              gap: 14,
              overflowX: "auto",
              scrollSnapType: "x proximity",
              WebkitOverflowScrolling: "touch",
              paddingLeft: 24,
              paddingRight: 24,
              paddingBottom: 4,
            }}
          >
            {JOURNAL_POSTS.map((post) => (
              <JournalCard
                key={post.slug}
                post={post}
                onTap={() => onNavigateJournalPost?.(post.slug)}
              />
            ))}
          </div>
        </section>

        {/* "Need help deciding?" — the Specialist-contact block:
            placeholder photo, reassurance line, and one-tap Text /
            Call / Email circles. (Video call held until we pick a
            mechanism.) */}
        <HelpDecidingSection />
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
