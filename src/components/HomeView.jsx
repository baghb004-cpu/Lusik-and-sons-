"use client";

// ============================================================
// HomeView — the home page (brand experience, not a catalog)
// ============================================================
// Post-/shop-routing refactor: HomeView is now a brand-story
// surface. The full product configurators (blanket showcase,
// bib customizer) have moved to their own routes:
//
//   /shop/blankets/armenian-alphabet-blanket   ← ProductShowcase
//   /shop/bibs/baby-bib                        ← CustomProductCard
//
// The home page still teases what Lusik makes via the Featured
// Categories strip near the top + the bib commission teaser
// further down, but every buy surface lives a click deeper.
//
// What's still on the home page:
//   - Hero
//   - Trust strip (4 icons)
//   - Featured Categories strip
//   - From Lusik's Workshop (photo grid)
//   - Our Story
//   - Testimonials + Customer Photos
//   - FAQ
//   - Get in Touch / Four Ways to Order
//   - By Post / Send a Letter (mailing address)
//   - Shipping & Tracking
//   - Stay Connected (newsletter)
// ============================================================

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useT } from "../i18n/LangContext.jsx";
import { TrackingForm } from "./TrackingForm.jsx";
import { NewsletterSignup } from "./NewsletterSignup.jsx";
import { TestimonialsSection } from "./TestimonialsSection.jsx";
import { HeroSlideshow } from "./HeroSlideshow.jsx";
import { CustomerPhotosSection } from "./CustomerPhotosSection.jsx";
import { ContactQuickMenu } from "./ContactQuickMenu.jsx";
import { CategoryCardImage } from "./CategoryCardImage.jsx";
import { ArrowRight, ChevronLeft, ChevronRight, MapPin, Plus, Heart, Instagram, Mail, Phone, Shield, ShoppingBag, Truck, Store, BookOpen, Sparkles, Send } from "./icons.jsx";
import { RecentlyViewedStrip } from "./RecentlyViewedStrip.jsx";
import { getRecentlyViewed } from "../lib/recentActivity.js";
import { galleryRotationStyle } from "../lib/galleryRotation";
// FAQ copy is CMS-managed (Content Studio /studio → "Site Content"), compiled
// from content/pages/faq.json by scripts/gen-pages.mjs. Static at build time.
import { CMS_PAGES } from "../data/pagesData.generated.js";
import {
  PHOTO_BIB_PILE,
  PHOTO_BIB_ROMEO,
  PHOTO_BIB_STACK,
  PHOTO_DATE_DETAIL,
  PHOTO_PURPLE_SIDE,
  PHOTO_YELLOWGREEN_2,
} from "../images/photos.js";

// Big, obvious "‹ For You" back control shown at the top of every promoted
// section page (Our Story, FAQ, …) on both mobile and desktop. Kept static
// (not sticky) so it never collides with the desktop sticky top-nav and so
// it's immune to the position bug inside the page-enter transform; on mobile
// the always-present bottom-nav "For You" tab is the persistent second way
// back, so a top-of-page control is plenty.
function SectionBackHeader({ onBack }) {
  const t = useT();
  return (
    <div
      className="border-b"
      style={{ background: "var(--bg-page)", borderColor: "var(--border-soft, rgba(26,22,18,0.08))" }}
    >
      <div className="max-w-7xl mx-auto px-4 lg:px-12 py-3 lg:py-4">
        <button
          type="button"
          onClick={() => onBack?.()}
          className="flex items-center gap-1 -ml-1 pr-4 py-1.5 active:opacity-60 transition-opacity"
          style={{ color: "var(--accent-text)", fontWeight: 600 }}
          aria-label={t("mobileNav.backToForYou")}
        >
          <ChevronLeft size={30} strokeWidth={2} />
          <span className="text-lg lg:text-xl">{t("mobileNav.forYou")}</span>
        </button>
      </div>
    </div>
  );
}

export function HomeView({
  product,
  // Shop navigation — passed down from App so every CTA on the
  // home page can deep-link into the new /shop hierarchy
  // without HomeView itself owning routing state.
  onNavigateShop,
  onNavigateCategory,
  onNavigateProduct,
  onNavigateJournal,
  // Section-page routing. When `pageSlug` is set, HomeView renders ONLY that
  // promoted section (Our Story / Workshop / FAQ / Contact / Shipping /
  // Newsletter) under a big "‹ For You" back header instead of the home
  // feed. `onNavigatePage(slug)` opens one; `onBackToForYou()` returns. This
  // is what shortens the home page on BOTH mobile and desktop — the heavy
  // sections live on their own pages now, reachable via the Explore cards
  // (mobile swipe / desktop grid) and the nav + footer links.
  pageSlug = null,
  onNavigatePage,
  onBackToForYou,
  // Opens a policy modal (finalSale | privacy | terms). The policy links used
  // to live only in the footer, which is now hidden on mobile — so on phones
  // they survive as small cards in the Explore "More" row below.
  onOpenPolicy,
  // Connection-guarded route prefetch (nav.prefetch) — warms a destination's
  // payload on hover/focus so tapping an Explore or product card feels instant.
  onPrefetch,
  // Mobile-only: on a return visit within the same session the App
  // collapses the home screen to an Apple Store "For You" layout —
  // the brand hero is dropped and the For-You sections lead. Desktop
  // ignores this entirely (the hero is always shown on lg+).
  simplified = false,
}) {
  const t = useT();
  // The Explore cards — the swipeable (mobile) / grid (desktop) entry points
  // to everything that used to live further down the home page. Each routes
  // to a real page so it's shareable + crawlable. Title/blurb come from i18n
  // so the cards translate with the rest of the site.
  const exploreCards = [
    { key: "shop",       title: t("explore.shop.title"),       blurb: t("explore.shop.blurb"),       Icon: Store,    go: () => onNavigateShop?.() },
    { key: "story",      title: t("explore.story.title"),      blurb: t("explore.story.blurb"),      Icon: Heart,    go: () => onNavigatePage?.("story") },
    { key: "workshop",   title: t("explore.workshop.title"),   blurb: t("explore.workshop.blurb"),   Icon: Sparkles, go: () => onNavigatePage?.("workshop") },
    { key: "journal",    title: t("explore.journal.title"),    blurb: t("explore.journal.blurb"),    Icon: BookOpen, go: () => onNavigateJournal?.() },
    { key: "faq",        title: t("explore.faq.title"),        blurb: t("explore.faq.blurb"),        Icon: Plus,     go: () => onNavigatePage?.("faq") },
    { key: "shipping",   title: t("explore.shipping.title"),   blurb: t("explore.shipping.blurb"),   Icon: Truck,    go: () => onNavigatePage?.("shipping") },
    { key: "contact",    title: t("explore.contact.title"),    blurb: t("explore.contact.blurb"),    Icon: Mail,     go: () => onNavigatePage?.("contact") },
    { key: "newsletter", title: t("explore.newsletter.title"), blurb: t("explore.newsletter.blurb"), Icon: Send,     go: () => onNavigatePage?.("newsletter") },
  ];
  const [contactMenuOpen, setContactMenuOpen] = useState(false);
  // Mirrors HeroSlideshow's activeIdx so the rotating caption in
  // the left-column text block stays in sync with the photo on
  // the right. Updated via the onIndexChange callback.
  const [heroIndex, setHeroIndex] = useState(0);
  // Device-local "recently viewed" memory (localStorage). Read once on
  // mount — feeds the mobile-only "Your recent activity" strip below the
  // hero. Empty for first-time visitors, who just see hero + curated card.
  // SSR-safe: localStorage is browser-only, so start empty — the server render
  // and the client's first render then agree (no hydration mismatch on the
  // "Recently viewed" strip). The effect loads the stored list right after
  // mount, so the strip still appears for returning visitors.
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  useEffect(() => {
    setRecentlyViewed(getRecentlyViewed());
  }, []);
  return (
    <div className="fade-in">
      {/* A promoted section page renders ONLY its one section, under the big
          "‹ For You" back header. The short For You home (pageSlug === null)
          renders the hero + For You feed + Explore cards below. */}
      {pageSlug && <SectionBackHeader onBack={onBackToForYou} />}

      {!pageSlug && (
      <>
      {/* Brand hero. On a simplified mobile return-visit it's hidden
          (hidden lg:block) so the "For You" sections lead, matching the
          Apple Store app. Desktop always renders it. */}
      <section className={`${simplified ? "hidden lg:block " : ""}max-w-7xl mx-auto px-6 lg:px-12 pt-12 lg:pt-20 pb-16 lg:pb-24`}>
        {/* The two-column hero starts at md (not lg): on the iPhone Fold's
            open 4:3 canvas the hero reads like a book spread — copy on the
            left page, the slideshow on the right. Phones stay stacked. */}
        <div className="grid md:grid-cols-12 gap-8 lg:gap-16 items-center">
          <div className="md:col-span-5 slide-up min-w-0">
            <p className="text-xs tracking-[0.3em] uppercase mb-6" style={{ color: "var(--text-primary)" }}>Southern California</p>
            <h1 className="font-display text-5xl lg:text-7xl leading-[0.95] mb-6" style={{ fontWeight: 400, letterSpacing: "-0.02em" }}>
              {t("hero.headline")} <em style={{ fontWeight: 400 }}>{t("hero.headlineEm")}</em>.
            </h1>
            {/* Rotating caption — one short italic line per hero
                slide. Keyed on heroIndex so React unmounts the old
                <p> and mounts a fresh one on each slide change,
                which re-fires the .fade-in animation and gives a
                clean visual handoff between captions. The translation
                array is fetched as an object via useT(); falls back
                to an empty string if a translation file is missing
                a caption at that index. */}
            {(() => {
              const captions = t("hero.captions");
              const list = Array.isArray(captions) ? captions : [];
              const caption = list[heroIndex % (list.length || 1)] ?? "";
              if (!caption) return null;
              return (
                <p
                  key={heroIndex}
                  className="fade-in text-base lg:text-lg italic mb-8 max-w-md"
                  style={{ color: "var(--text-primary)", fontWeight: 400, letterSpacing: "0.005em" }}
                  aria-live="polite"
                >
                  — {caption} —
                </p>
              );
            })()}
            {/* Body copy. Mobile drops the "Southern California" clause
                (the hero eyebrow above already carries it) via bodyShort;
                desktop keeps the full body unchanged. */}
            <p className="lg:hidden text-base leading-relaxed mb-10 max-w-md" style={{ color: "#3D332A" }}>
              {t("hero.bodyShort")}
            </p>
            <p className="hidden lg:block text-lg leading-relaxed mb-10 max-w-md" style={{ color: "#3D332A" }}>
              {t("hero.body")}
            </p>
            <div className="flex items-center gap-6">
              <button
                onClick={() => onNavigateShop?.()}
                className="lg-button-ink lg-shine px-8 py-4 text-sm tracking-wide flex items-center gap-3"
                style={{ fontWeight: 500 }}
              >
                {t("hero.shopCta")} <ArrowRight size={16} />
              </button>
              <button onClick={() => onNavigatePage?.("story")} className="text-sm tracking-wide underline underline-offset-4 hover:opacity-60">{t("hero.storyCta")}</button>
            </div>
          </div>
          <div className="md:col-span-7 slide-up stagger-2">
            <div className="relative">
              <div className="aspect-[4/3] overflow-hidden">
                <HeroSlideshow className="w-full h-full" onIndexChange={setHeroIndex} />
              </div>
              <div className="absolute -bottom-6 -left-6 px-6 py-4 hidden lg:block" style={{ background: "var(--bg-page)", border: "1px solid var(--border-default)" }}>
                <p className="text-xs tracking-[0.2em] uppercase mb-1" style={{ color: "var(--text-primary)" }}>{t("hero.callout1")}</p>
                <p className="font-display text-lg" style={{ fontWeight: 400 }}>{t("hero.callout2")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FOR YOU — mobile-only (lg:hidden)
          ============================================================
          Apple Store "For You" page, scaled to one maker's shop.
          Two parts, both phone-only so desktop is untouched:
            a) "We think you'll love" — a curated feature card. Always
               shown; features the live flagship blanket.
            b) "Your recent activity" — the same device-local recently-
               viewed strip the search page uses; only renders when the
               guest has actually viewed something.
          Sits right after the brand hero so the hero still leads. */}
      <section className={`lg:hidden px-6 ${simplified ? "pt-3" : "pt-2"} pb-10`}>
        {/* a) We think you'll love — curated feature card.
            Heading uses the Apple Store "For You" section style: large,
            bold, ink-colored, left-aligned (not the small gold eyebrow). */}
        <div className="mb-4">
          <p className="leading-tight" style={{ fontSize: "1.55rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            {t("forYou.weThink")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigateProduct?.("blankets", "armenian-alphabet-blanket")}
          onPointerEnter={() => onPrefetch?.("/shop/blankets/armenian-alphabet-blanket")}
          onFocus={() => onPrefetch?.("/shop/blankets/armenian-alphabet-blanket")}
          className="w-full flex items-center gap-4 text-left rounded-2xl p-3"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-soft)", boxShadow: "0 10px 26px -14px rgba(26,22,18,0.24)" }}
          aria-label={`${t("forYou.featuredName")} — ${t("forYou.selectedForYou")}`}
        >
          <div
            className="flex-shrink-0 overflow-hidden rounded-xl"
            style={{ width: 72, height: 72, background: "var(--bg-subtle, #F5EFE3)" }}
          >
            <Image
              src={product.gallery[0]}
              alt="The Armenian Alphabet Blanket"
              width={72}
              height={72}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[0.6rem] tracking-[0.2em] uppercase mb-1" style={{ color: "var(--text-primary)", fontWeight: 600 }}>
              ✦ {t("forYou.selectedForYou")}
            </p>
            <p className="font-display text-base leading-tight" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
              {t("forYou.featuredName")}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-primary)", fontWeight: 500 }}>{t("search.from", { price: 65 })}</p>
          </div>
          <ChevronRight size={18} strokeWidth={1.5} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        </button>

        {/* b) Your recent activity — only when the guest has viewed something */}
        {recentlyViewed.length > 0 && (
          <div className="mt-8">
            <RecentlyViewedStrip
              items={recentlyViewed}
              onTap={(categorySlug, slug) => onNavigateProduct?.(categorySlug, slug)}
              heading={t("forYou.recentActivity")}
              large
            />
          </div>
        )}
      </section>

      {/* ============================================================
          EXPLORE — the entry points to everything promoted off the
          home page. This is what keeps the home short instead of an
          infinite scroll: each card jumps to its own page (and back
          via the big "‹ For You" header / bottom-nav Home tab).
          Mobile: a horizontal swipe row (swipe left for more), Apple
          Store "Don't miss…" style. Desktop: a tidy grid.
          ============================================================ */}
      <section className="px-6 lg:px-12 max-w-7xl mx-auto pt-4 pb-12 lg:py-16">
        <p
          className="leading-tight mb-5 lg:mb-8"
          style={{ fontSize: "1.55rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }}
        >
          {t("forYou.exploreRest")}
        </p>

        {/* Mobile: horizontal snap carousel. Left edge sits flush to the page
            gutter (aligned with every other card section); only the RIGHT side
            bleeds to the screen edge (-mr-6) so the next card peeks, signalling
            "there's more" — the Apple Store pattern. */}
        {/* On the open-book canvas (iPhone Fold inner display / 768–1023px)
            the strip becomes a 4-up grid — all eight cards visible at once,
            two tidy rows, no horizontal scroll. Card width moves from the
            fixed 156px to the grid track (h stays for the square feel). */}
        <div className="lg:hidden -mr-6 md:mr-0 flex md:grid md:grid-cols-4 gap-3 md:gap-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory pb-2" style={{ scrollbarWidth: "none", scrollPaddingLeft: 0 }}>
          {exploreCards.map(({ key, title, blurb, Icon, go }) => (
            <button
              key={key}
              type="button"
              onClick={go}
              onPointerEnter={() => onPrefetch?.(`/${key}`)}
              onFocus={() => onPrefetch?.(`/${key}`)}
              className="snap-start flex-shrink-0 w-[156px] h-[156px] md:w-auto text-left rounded-2xl p-4 flex flex-col justify-between active:scale-[0.98] transition-transform"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-soft)", boxShadow: "0 8px 20px -12px rgba(26,22,18,0.22)" }}
              aria-label={`${title} — ${blurb}`}
            >
              <Icon size={24} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
              {/* Title reserves two lines so 1- and 2-line titles align the
                  same across the whole row (no more random heights). */}
              <div>
                <p className="font-display text-base leading-tight" style={{ fontWeight: 500, color: "var(--text-primary)", minHeight: "2.4em" }}>{title}</p>
                <p className="text-xs mt-1 opacity-65 leading-snug">{blurb}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Desktop: grid of the same cards. */}
        <div className="hidden lg:grid grid-cols-4 gap-5">
          {exploreCards.map(({ key, title, blurb, Icon, go }) => (
            <button
              key={key}
              type="button"
              onClick={go}
              onPointerEnter={() => onPrefetch?.(`/${key}`)}
              onFocus={() => onPrefetch?.(`/${key}`)}
              className="lg-button lg-shine text-left rounded-2xl p-6 flex flex-col gap-4 transition"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-soft)" }}
              aria-label={`${title} — ${blurb}`}
            >
              <Icon size={26} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
              <div>
                <p className="font-display text-xl leading-tight mb-1" style={{ fontWeight: 400, color: "var(--text-primary)" }}>{title}</p>
                <p className="text-sm opacity-70 leading-relaxed">{blurb}</p>
                <p className="text-[0.65rem] tracking-[0.2em] uppercase flex items-center gap-1.5 mt-3" style={{ color: "var(--accent)", fontWeight: 500 }}>
                  Open <ArrowRight size={12} strokeWidth={1.75} />
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Trust badges. Hidden on the simplified mobile return-visit
          (hidden lg:block) so the "For You" flow goes straight from
          recent activity into the categories, Apple-style. First visit
          and desktop keep the row. */}
      <section className={`${simplified ? "hidden lg:block " : ""}border-y py-8`} style={{ borderColor: "rgba(26,22,18,0.08)", background: "rgba(176,136,66,0.04)" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-12">
          {[
            { Icon: Heart, label: "Hand cross-stitched", sub: "Every stitch placed by Lusik" },
            { Icon: Shield, label: "Made to order", sub: "Your letter, your colors, your child" },
            { Icon: Truck, label: "Free U.S. shipping", sub: "On orders over $150" },
            // The 4th badge is the only interactive one — tapping it
            // opens the ContactQuickMenu (Email / Text). The others
            // stay as static info badges.
            { Icon: Mail, label: "Write to Lusik", sub: "She answers herself, usually within a day", action: "contact" },
          ].map((item, i) => {
            const isActionable = item.action === "contact";
            const Wrapper = isActionable ? "button" : "div";
            const wrapperProps = isActionable
              ? {
                  type: "button",
                  onClick: () => setContactMenuOpen(true),
                  "aria-haspopup": "dialog",
                  "aria-expanded": contactMenuOpen,
                  "aria-label": "Open contact options to email or text Lusik",
                  className:
                    "flex items-center gap-3 text-left transition-opacity hover:opacity-80 focus-visible:opacity-100 cursor-pointer",
                  style: { background: "transparent", border: 0, padding: 0 },
                }
              : { className: "flex items-center gap-3" };
            return (
              <Wrapper key={i} {...wrapperProps}>
                <item.Icon size={20} strokeWidth={1.25} style={{ color: "var(--accent)" }} />
                <div>
                  <p
                    className="text-sm flex items-center gap-1.5"
                    style={{ fontWeight: 500 }}
                  >
                    {item.label}
                    {isActionable && (
                      <ArrowRight
                        size={12}
                        strokeWidth={1.75}
                        style={{ color: "var(--accent)" }}
                        aria-hidden="true"
                      />
                    )}
                  </p>
                  <p className="text-xs opacity-70">{item.sub}</p>
                </div>
              </Wrapper>
            );
          })}
        </div>
      </section>

      {/* ── MOBILE-ONLY footer replacement ────────────────────────
          The desktop footer is hidden on phones for an app-style feel,
          so the policy links that lived only there survive here as
          small cards, followed by one quiet credit line. Everything
          else from the old footer (brand blurb, link columns, trust
          row, language/theme toggles) is intentionally gone on mobile:
          the toggles are in the top header and every other destination
          is a card above. Desktop keeps the full footer. */}
      <section className="lg:hidden px-6 pb-12 pt-2 max-w-7xl mx-auto">
        <p className="text-xs tracking-[0.25em] uppercase opacity-50 mb-3">{t("forYou.more")}</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: "finalSale", label: "Final Sale", Icon: ShoppingBag },
            { key: "privacy",   label: "Privacy",    Icon: Shield },
            { key: "terms",     label: "Terms",      Icon: BookOpen },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => onOpenPolicy?.(key)}
              className="rounded-2xl p-4 text-left active:scale-[0.98] transition-transform"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-soft)", boxShadow: "0 8px 20px -12px rgba(26,22,18,0.22)" }}
              aria-label={`${label} policy`}
            >
              <Icon size={20} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
              <p className="text-sm mt-2 leading-tight" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{label}</p>
            </button>
          ))}
        </div>
        <p className="text-[0.7rem] opacity-45 text-center mt-8 leading-relaxed">
          © {new Date().getFullYear()} Lusik &amp; Sons · Made in Southern California
        </p>
      </section>

      {/* Contact quick-menu — controlled by the "Custom requests"
          trust badge above. Renders nothing when closed. */}
      <ContactQuickMenu
        isOpen={contactMenuOpen}
        onClose={() => setContactMenuOpen(false)}
      />
      </>
      )}

      {/* ── PAGE: From Lusik's Workshop ─────────────────────────── */}
      {pageSlug === "workshop" && (
      <>
      {/* FROM LUSIK'S WORKSHOP — additional real product photos that aren't
          in the main gallery, showing the range of Lusik's work: different
          color schemes, the date-detail close-up, custom personalization
          examples (Luca with hearts), and a glimpse of her bib output. This
          builds trust by showing real outcomes from past orders. */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 py-16 lg:py-20">
        <div className="text-center mb-10 max-w-2xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "var(--accent)" }}>From Lusik's workshop</p>
          <h2 className="font-display text-3xl lg:text-4xl" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
            Past blankets, <em style={{ fontWeight: 400 }}>real families</em>.
          </h2>
          <p className="text-sm opacity-70 mt-3 leading-relaxed">
            A few of the pieces Lusik has stitched lately — names and dates, colors a parent picked because of a grandmother, details close enough to see the path the needle took.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4">
          {[
            { src: PHOTO_DATE_DETAIL, alt: "Close-up of 07/05/24 birth date cross-stitched on blanket" },
            { src: PHOTO_PURPLE_SIDE, alt: "Purple Armenian alphabet detail" },
            { src: PHOTO_YELLOWGREEN_2, alt: "Yellow and green Armenian alphabet variation" },
            { src: PHOTO_BIB_STACK, alt: "Stack of machine-embroidered bibs in different colors" },
            { src: PHOTO_BIB_PILE, alt: "Pile of bibs and blanket showing yellow and green work" },
            { src: PHOTO_BIB_ROMEO, alt: "Romeo bib with matching blue alphabet blanket" },
          ].map((photo, i) => (
            <div key={i} className="aspect-square overflow-hidden stagger-reveal relative" style={{ "--i": i }}>
              <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover" />
            </div>
          ))}
        </div>
      </section>
      </>
      )}

      {/* ── PAGE: Our Story (+ testimonials + customer photos) ──── */}
      {pageSlug === "story" && (
      <>
      <section id="story" className="py-20 lg:py-32" style={{ background: "var(--ink)", color: "var(--text-on-ink)" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 grid lg:grid-cols-12 gap-10 lg:gap-20 items-center">
          <div className="lg:col-span-6 lg:order-2 min-w-0">
            <div className="aspect-[4/5] overflow-hidden relative">
              {/* Fall back to gallery[0] if Lusik hasn't uploaded a 9th photo yet —
                  prevents a broken <img> if PRODUCT.gallery has fewer than 8 entries. */}
              <Image src={product.gallery[7] ?? product.gallery[0]} alt="Detail of cross-stitched alphabet block" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" style={galleryRotationStyle(7)} />
            </div>
          </div>
          <div className="lg:col-span-6 lg:order-1 min-w-0">
            <p className="text-xs tracking-[0.3em] uppercase mb-6" style={{ color: "var(--accent)" }}>Our Story</p>
            <h2 className="font-display text-4xl lg:text-5xl mb-8 leading-tight" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
              From Armenia, to Little Armenia, to a quiet house in Southern California.
            </h2>
            <div className="space-y-5 text-base lg:text-lg leading-relaxed opacity-90">
              <p>
                Lusik came to Los Angeles from Armenia in the late 1970s, with a cross-stitch hoop and the way of working her mother and grandmother had taught her. She lived in East Hollywood — what people there call Little Armenia — and later moved south to Orange County, where she lives and stitches today.
              </p>
              <p>
                What she does is cross-stitch by hand. On every blanket, the first three letters of the alphabet — <span style={{ fontWeight: 500, color: "var(--accent)" }}>Ա, Բ, Գ</span> in Armenian, or <span style={{ fontWeight: 500, color: "var(--accent)" }}>A, B, C</span> in English — placed one tiny X at a time onto soft cloth woven through with the Armenian pomegranate. For other letters, or a name you'd like spelled out, please write her directly. She always says yes.
              </p>
              <p>
                The bib is different. The bib is machine-embroidered with a personalized name — five or six letters, no more — because a bib lives in the washing machine three times a week and the name has to survive. The blanket goes in the crib. The bib goes to the table. Each piece gets the technique that fits the life it's going to have.
              </p>
              <p>
                Her sons built this website. Mom does the stitching. We do the typing.
              </p>
            </div>
            <div className="mt-10 pt-8" style={{ borderTop: "1px solid rgba(245,239,227,0.15)" }}>
              <p className="font-display text-2xl italic" style={{ fontWeight: 300 }}>— Lusik's sons</p>
              <p className="text-sm opacity-70 mt-1">Sons of the maker</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          TESTIMONIALS
          ============================================================
          Quiet trust signal — three quotes from customers. NOT a
          ratings widget; no stars, no Trustpilot scrape. The point
          is to land that real people have ordered this and felt
          something about it.

          ⚠️ TODO_LUSIK: the quotes below are placeholder content
          using realistic Armenian-American customer names. Before
          launch, swap them with actual quotes from customers who
          said yes to being quoted. Email Lusik to ask which of her
          past customers she'd be comfortable attributing this way;
          first name + city is the lightest-touch attribution that
          still feels credible.
          ============================================================ */}
      <TestimonialsSection />

      {/* ============================================================
          CUSTOMER PHOTOS / SOCIAL PROOF GALLERY
          ============================================================
          Photos of finished pieces in customer homes. Auto-hides
          (returns null) when CUSTOMER_PHOTOS is empty, so it shows
          nothing on launch until Lusik adds real entries. Pairs
          with the testimonials section — text + image, both
          quietly reinforcing "real people, real homes." */}
      <CustomerPhotosSection />
      </>
      )}

      {/* ── PAGE: Good Questions (FAQ) ─────────────────────────── */}
      {pageSlug === "faq" && (
      <section id="faq" className="max-w-4xl mx-auto px-6 lg:px-12 py-20 lg:py-28">
        <p className="text-xs tracking-[0.3em] uppercase mb-4 text-center" style={{ color: "var(--accent-text)" }}>{CMS_PAGES.faq.eyebrow}</p>
        <h2 className="font-display text-4xl lg:text-5xl mb-12 text-center" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>{CMS_PAGES.faq.title}</h2>
        <div className="space-y-1">
          {CMS_PAGES.faq.items.map((item, i) => (
            <details key={i} className="border-b group" style={{ borderColor: "rgba(26,22,18,0.1)" }}>
              <summary className="py-5 flex items-center justify-between cursor-pointer">
                <span className="font-display text-lg lg:text-xl" style={{ fontWeight: 400 }}>{item.q}</span>
                <Plus size={18} className="open-icon" />
              </summary>
              <p className="pb-5 opacity-80 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
      )}

      {/* ── PAGE: Contact Lusik (+ send a letter) ─────────────── */}
      {pageSlug === "contact" && (
      <section id="contact" className="max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-20">
          <div className="min-w-0">
            <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: "var(--accent)" }}>Get in Touch</p>
            <h2 className="font-display text-4xl lg:text-5xl mb-6" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>Four ways to reach Lusik.</h2>
            <p className="text-base lg:text-lg opacity-80 leading-relaxed">
              Check out directly on this site, give us a call, send a message on Instagram, or write an email — for custom commissions, family-name requests, bulk gift orders, or simply to ask Lusik a question. She or one of her sons writes back, usually within a day.
            </p>
          </div>
          <div className="space-y-1">
            {[
              { Icon: ShoppingBag, label: "Shop online", detail: "Browse and check out", action: () => onNavigateShop?.() },
              { Icon: Phone, label: "Call us", detail: "(760) 874-2333", action: () => window.open("tel:+17608742333") },
              { Icon: Instagram, label: "Message on Instagram", detail: "@lusikandsons", action: () => window.open("https://instagram.com", "_blank", "noopener,noreferrer") },
              { Icon: Mail, label: "Write Lusik directly", detail: "hello@lusikandsons.com", action: () => window.open("mailto:hello@lusikandsons.com") },
            ].map((c, i) => (
              <button key={i} onClick={c.action} className="w-full flex items-center gap-5 p-5 group hover:bg-[rgba(26,22,18,0.04)]" style={{ borderTop: i === 0 ? "1px solid rgba(26,22,18,0.1)" : "none", borderBottom: "1px solid rgba(26,22,18,0.1)" }}>
                <c.Icon size={22} strokeWidth={1.25} style={{ color: "var(--accent)" }} />
                <div className="flex-1 text-left">
                  <p className="font-display text-xl" style={{ fontWeight: 400 }}>{c.label}</p>
                  <p className="text-sm opacity-70">{c.detail}</p>
                </div>
                <ArrowRight size={18} strokeWidth={1.25} className="opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition" />
              </button>
            ))}
          </div>
        </div>

        {/* SEND A LETTER */}
        <div className="mt-20 lg:mt-24">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-20">
            <div className="min-w-0">
              <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: "var(--accent)" }}>By Post</p>
              <h3 className="font-display text-3xl lg:text-5xl mb-6" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
                Send a <em style={{ fontWeight: 400 }}>letter</em>.
              </h3>
              <p className="text-base lg:text-lg opacity-80 leading-relaxed">
                For handwritten orders, gift notes you'd like tucked into the box, family-name requests, and the slower kind of correspondence — Lusik checks mail at our local UPS Store mailbox in Buena Park.
              </p>
              <p className="text-sm opacity-70 italic mt-4 leading-relaxed">
                A mail-receiving address only — please don't visit in person. Lusik works from her kitchen, and that's a private one.
              </p>
            </div>
            <div className="p-6 lg:p-8" style={{ border: "1px solid rgba(26,22,18,0.15)", background: "rgba(255,255,255,0.35)" }}>
              <div className="flex items-start gap-3 mb-6">
                <MapPin size={20} strokeWidth={1.25} style={{ color: "var(--accent)", marginTop: "4px", flexShrink: 0 }} />
                <div>
                  <p className="font-display text-xl lg:text-2xl leading-tight" style={{ fontWeight: 500 }}>
                    Lusik <span style={{ color: "var(--accent)" }}>&</span> Sons
                  </p>
                  <p className="text-sm opacity-70 mt-0.5 mb-2">c/o The UPS Store</p>
                  <p className="text-base leading-relaxed">
                    5825 Lincoln Ave, Suite D<br />
                    Buena Park, CA 90620
                  </p>
                  <a href="https://www.google.com/maps/search/?api=1&query=5825+Lincoln+Ave+Ste+D+Buena+Park+CA+90620" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-3 text-sm underline hover:opacity-60">
                    Open in Maps <ArrowRight size={12} strokeWidth={1.5} />
                  </a>
                </div>
              </div>
              <div className="pt-5" style={{ borderTop: "1px solid rgba(26,22,18,0.12)" }}>
                <p className="text-xs tracking-[0.3em] uppercase mb-3 opacity-70">Mail pickup hours</p>
                <p className="text-xs opacity-70 italic mb-4 leading-relaxed">
                  The hours Lusik can stop by the UPS Store to gather your letter.
                </p>
                <div className="text-sm space-y-2">
                  {[
                    ["Monday – Friday", "9 AM – 7 PM"],
                    ["Saturday", "9 AM – 5 PM"],
                    ["Sunday", "Closed"],
                  ].map(([day, hours], i) => (
                    <div key={i} className="flex justify-between" style={{ opacity: hours === "Closed" ? 0.55 : 1 }}>
                      <span>{day}</span>
                      <span style={{ fontWeight: 500 }}>{hours}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ── PAGE: Shipping & Tracking ─────────────────────────── */}
      {pageSlug === "shipping" && (
      <section id="shipping" className="max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-28 border-t" style={{ borderColor: "rgba(26,22,18,0.1)" }}>
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-20">
          <div className="min-w-0">
            <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: "var(--accent)" }}>Shipping & Tracking</p>
            <h2 className="font-display text-4xl lg:text-5xl mb-6" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>How your piece gets home.</h2>
            <p className="text-base lg:text-lg opacity-80 leading-relaxed">
              Find the carrier office closest to you, or follow a piece already on its way. Direct links to USPS, UPS, and FedEx — no account required, no extra clicks.
            </p>
          </div>
          <div className="space-y-8">
            <div>
              <p className="text-xs tracking-[0.2em] uppercase opacity-70 mb-4">Find a carrier near you</p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => window.open("https://www.google.com/maps/search/USPS+near+me/", "_blank", "noopener,noreferrer")} className="py-5 px-3 text-sm border hover:bg-[rgba(26,22,18,0.04)] flex flex-col items-center gap-2" style={{ borderColor: "var(--text-primary)" }}>
                  <MapPin size={18} />
                  <span style={{ fontWeight: 500 }}>USPS</span>
                </button>
                <button onClick={() => window.open("https://www.google.com/maps/search/UPS+Store+near+me/", "_blank", "noopener,noreferrer")} className="py-5 px-3 text-sm border hover:bg-[rgba(26,22,18,0.04)] flex flex-col items-center gap-2" style={{ borderColor: "var(--text-primary)" }}>
                  <MapPin size={18} />
                  <span style={{ fontWeight: 500 }}>UPS</span>
                </button>
                <button onClick={() => window.open("https://www.google.com/maps/search/FedEx+near+me/", "_blank", "noopener,noreferrer")} className="py-5 px-3 text-sm border hover:bg-[rgba(26,22,18,0.04)] flex flex-col items-center gap-2" style={{ borderColor: "var(--text-primary)" }}>
                  <MapPin size={18} />
                  <span style={{ fontWeight: 500 }}>FedEx</span>
                </button>
              </div>
              <p className="text-xs opacity-70 mt-3">Opens Google Maps with the offices closest to you.</p>
            </div>
            <TrackingForm />
          </div>
        </div>
      </section>
      )}

      {/* ── PAGE: Stay Connected (newsletter) ─────────────────── */}
      {pageSlug === "newsletter" && (
      <section className="py-20 lg:py-28" style={{ background: "rgba(176,136,66,0.08)" }}>
        <div className="max-w-3xl mx-auto px-6 lg:px-12 text-center">
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: "var(--accent)" }}>Stay Connected</p>
          <h2 className="font-display text-4xl lg:text-5xl mb-6" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>The occasional note.</h2>
          <p className="text-base lg:text-lg opacity-80 leading-relaxed mb-10 max-w-xl mx-auto">
            When Lusik adds a new alphabet, a seasonal piece, or one of the placeholders finally goes live — we'll write you a short note. About one email a month. Never more, never anything we wouldn't send to our own mother.
          </p>
          <NewsletterSignup variant="hero" />
        </div>
      </section>
      )}
    </div>
  );
}
