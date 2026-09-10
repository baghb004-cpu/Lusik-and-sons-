"use client";

// ============================================================
// HOME v3 — the storyboarded scenes
// ============================================================
// SITE_OVERHAUL_HANDOFF.md section 4 storyboards the home page as a
// sequence of scenes rather than a wall of sections. Three of them are
// new; the rest of the storyboard is already on the page (the hero, the
// story, the testimonials, the Explore cards) and is left exactly where
// it is, because the e2e suite and the mobile bottom nav both navigate
// through the Explore cards' aria-labels.
//
//   Seven pieces      — every live product, in a row you can push along
//   How ordering works — three steps, dated by the real lead-time engine
//   From the journal   — the two most recent posts
//
// All three are behind CONFIG.HOME_V3 so the page can be put back with
// one flag if Lusik does not like it.
//
// Nothing here invents copy about the products: names, taglines and
// photographs come from the catalog, the dates come from the lead-time
// engine that the product pages and the transactional emails already
// use, and the posts come from the journal.
// ============================================================

import React, { useEffect, useState } from "react";
import { useT, useLang } from "../../i18n/LangContext.jsx";
import { loc } from "../../i18n/localize.js";
import { listCategories } from "../../data/catalog.js";
// The generated search index. It carries every article's full body,
// which is more than two cards need — but it is already in the shared
// layout chunk for the site search, so reading it here costs nothing.
import { JOURNAL_POSTS } from "../../data/journalPostsData.js";
import { getLeadTime, slowestKey } from "../../lib/leadTime.js";
import { ArrowRight } from "../icons.jsx";
import { useTilt3D } from "../../lib/useTilt3D";
import { productHeroImage } from "../../lib/productHeroImage.js";
import { PRODUCT } from "../../data/product.js";

/**
 * Every product a customer can actually buy, with the category it lives
 * under so a card can link to it.
 *
 * Read from the catalog rather than listed here: a product going live in
 * the Studio should appear on the home page without a code change, and a
 * hardcoded list would quietly go stale the first time one did.
 */
export function livePieces() {
  const out = [];
  for (const category of listCategories()) {
    for (const product of category.products ?? []) {
      if (product.status !== "live") continue;
      out.push({ product, category });
    }
  }
  return out;
}

function pieceImage(product) {
  // Shared with the category grid: the Custom Name Bib has no cover
  // photograph, and picking one here separately is how this card first
  // rendered as an empty grey box in a row of real product photos.
  return productHeroImage(product, { galleryFallback: PRODUCT.gallery?.[0] ?? null });
}

// ============================================================
// Scene: seven pieces
// ============================================================

function PieceCard({ product, category, onNavigateProduct, onPrefetch }) {
  const { lang } = useLang();
  const t = useT();
  const tilt = useTilt3D();
  const name = loc(product, "name", lang);
  const image = pieceImage(product);

  return (
    <button
      type="button"
      ref={tilt}
      onClick={() => onNavigateProduct?.(category.slug, product.slug)}
      onMouseEnter={() => onPrefetch?.(`/shop/${category.slug}/${product.slug}`)}
      onFocus={() => onPrefetch?.(`/shop/${category.slug}/${product.slug}`)}
      aria-label={t("home.pieceCardLabel", { name })}
      className="t3d-card group snap-start shrink-0 w-[68vw] sm:w-[19rem] text-left"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      <div className="aspect-[4/5] overflow-hidden" style={{ background: "rgba(26,22,18,0.05)" }}>
        {image && (
          /* A plain img, not next/image: these are already-sized product
             photographs and the row is horizontally scrolled, so the
             layout does not depend on the intrinsic size. */
          <img
            src={image}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        )}
      </div>
      <div className="p-4">
        <p className="font-display text-lg leading-snug" style={{ color: "var(--text-primary)" }}>
          {name}
        </p>
        {product.tagline && (
          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {loc(product, "tagline", lang)}
          </p>
        )}
      </div>
    </button>
  );
}

export function SevenPiecesScene({ onNavigateProduct, onNavigateShop, onPrefetch }) {
  const t = useT();
  const pieces = livePieces();
  if (pieces.length === 0) return null;

  return (
    <section className="t3d-scene py-14 lg:py-20" aria-labelledby="home-pieces-heading">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "var(--accent-text)" }}>
          {t("home.piecesEyebrow")}
        </p>
        <div className="flex items-end justify-between gap-6 mb-7">
          <h2 id="home-pieces-heading" className="font-display text-3xl lg:text-4xl leading-tight" style={{ fontWeight: 400 }}>
            {pieces.length === 1
              ? t("home.piecesTitleOne")
              : t("home.piecesTitle", { count: pieces.length })}
          </h2>
          <button
            type="button"
            onClick={() => onNavigateShop?.()}
            className="hidden sm:inline-flex items-center gap-2 text-sm shrink-0 pb-1"
            style={{ color: "var(--accent-text)" }}
          >
            {t("home.piecesAll")}
            <ArrowRight size={15} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Flush to the left edge on phones so the row reads as something
          you push along rather than a grid that got cut off. */}
      <div className="overflow-x-auto scrollbar-none">
        <div className="flex gap-4 px-6 lg:px-12 max-w-7xl mx-auto snap-x snap-mandatory pb-2">
          {pieces.map(({ product, category }) => (
            <PieceCard
              key={product.slug}
              product={product}
              category={category}
              onNavigateProduct={onNavigateProduct}
              onPrefetch={onPrefetch}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Scene: how ordering works
// ============================================================

/**
 * Three steps, with the dates the lead-time engine gives — the same
 * engine the product pages, the bag and the confirmation emails use.
 *
 * The dates are computed AFTER mount, never during render. Product routes
 * are prerendered, so a date baked at build time would be stale by the
 * time anyone read it and would mismatch on hydration. Until then the
 * step carries the timeless weeks range, which is true whenever it is
 * read.
 */
export function HowOrderingWorksScene() {
  const t = useT();
  const [dates, setDates] = useState(null);

  useEffect(() => {
    // The slowest live piece decides the promise, because Lusik sends an
    // order as one parcel. Quoting the fastest would be a promise the
    // shop cannot keep for most of what is in it.
    const keys = livePieces().map(({ product }) => product.trustedKey ?? product.key);
    setDates(getLeadTime(slowestKey(keys)));
  }, []);

  const steps = [
    { key: "choose", title: t("home.stepChooseTitle"), body: t("home.stepChooseBody") },
    {
      key: "made",
      title: t("home.stepMadeTitle"),
      body: dates
        ? t("home.stepMadeBodyDated", { start: dates.startBy })
        : t("home.stepMadeBody"),
    },
    {
      key: "arrives",
      title: t("home.stepArrivesTitle"),
      body: dates
        ? t("home.stepArrivesBodyDated", { arrives: dates.arrives })
        : t("home.stepArrivesBody"),
    },
  ];

  return (
    <section
      className="py-14 lg:py-20"
      style={{ background: "var(--ink)", color: "var(--text-on-ink)" }}
      aria-labelledby="home-ordering-heading"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "var(--accent-on-ink)" }}>
          {t("home.orderingEyebrow")}
        </p>
        <h2 id="home-ordering-heading" className="font-display text-3xl lg:text-4xl mb-9 leading-tight" style={{ fontWeight: 400 }}>
          {t("home.orderingTitle")}
        </h2>
        <ol className="grid sm:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, i) => (
            <li key={step.key}>
              <p
                className="text-xs tracking-[0.3em] uppercase mb-3 tabular-nums"
                style={{ color: "var(--accent-on-ink)" }}
              >
                {String(i + 1).padStart(2, "0")}
              </p>
              <p className="font-display text-xl mb-2" style={{ fontWeight: 400 }}>{step.title}</p>
              <p
                className="text-sm leading-relaxed"
                /* data-live-dates: the visual suite masks this, because a
                   real date changes every day and would fail the baseline
                   for a page that has not changed. */
                data-live-dates={step.key === "choose" ? undefined : ""}
              >
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ============================================================
// Scene: from the journal
// ============================================================

export function FromTheJournalScene({ onNavigateJournal, onNavigateJournalPost, onPrefetch }) {
  const t = useT();
  const posts = JOURNAL_POSTS.slice(0, 2);
  if (posts.length === 0) return null;

  return (
    <section className="t3d-scene py-14 lg:py-20" aria-labelledby="home-journal-heading">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "var(--accent-text)" }}>
          {t("home.journalEyebrow")}
        </p>
        <div className="flex items-end justify-between gap-6 mb-7">
          <h2 id="home-journal-heading" className="font-display text-3xl lg:text-4xl leading-tight" style={{ fontWeight: 400 }}>
            {t("home.journalTitle")}
          </h2>
          <button
            type="button"
            onClick={() => onNavigateJournal?.()}
            className="hidden sm:inline-flex items-center gap-2 text-sm shrink-0 pb-1"
            style={{ color: "var(--accent-text)" }}
          >
            {t("home.journalAll")}
            <ArrowRight size={15} strokeWidth={1.5} />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {posts.map((post) => (
            <JournalCard
              key={post.slug}
              post={post}
              onOpen={() => onNavigateJournalPost?.(post.slug)}
              onPrefetch={() => onPrefetch?.(`/journal/${post.slug}`)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function JournalCard({ post, onOpen, onPrefetch }) {
  const t = useT();
  const tilt = useTilt3D();
  return (
    <button
      type="button"
      ref={tilt}
      onClick={onOpen}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      aria-label={t("home.journalCardLabel", { title: post.title })}
      className="t3d-card text-left p-6 h-full"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      <p className="text-[0.65rem] tracking-[0.25em] uppercase mb-3" style={{ color: "var(--text-muted)" }}>
        {t("home.journalReadMinutes", { minutes: post.readMinutes })}
      </p>
      <p className="font-display text-xl leading-snug mb-2" style={{ color: "var(--text-primary)" }}>
        {post.title}
      </p>
      <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {post.excerpt}
      </p>
    </button>
  );
}
