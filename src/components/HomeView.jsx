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
import { useT } from "../i18n/LangContext.jsx";
import { TrackingForm } from "./TrackingForm.jsx";
import { NewsletterSignup } from "./NewsletterSignup.jsx";
import { TestimonialsSection } from "./TestimonialsSection.jsx";
import { HeroSlideshow } from "./HeroSlideshow.jsx";
import { CustomerPhotosSection } from "./CustomerPhotosSection.jsx";
import { ContactQuickMenu } from "./ContactQuickMenu.jsx";
import { CategoryCardImage } from "./CategoryCardImage.jsx";
import { ArrowRight, ChevronRight, MapPin, Plus, Heart, Instagram, Mail, Phone, Shield, ShoppingBag, Truck } from "./icons.jsx";
import { RecentlyViewedStrip } from "./RecentlyViewedStrip.jsx";
import { getRecentlyViewed } from "../lib/recentActivity.js";
import { galleryRotationStyle } from "../lib/galleryRotation";
import {
  PHOTO_BIB_PILE,
  PHOTO_BIB_ROMEO,
  PHOTO_BIB_STACK,
  PHOTO_DATE_DETAIL,
  PHOTO_PURPLE_SIDE,
  PHOTO_YELLOWGREEN_2,
} from "../images/photos.js";

export function HomeView({
  product,
  scrollTo,
  // Shop navigation — passed down from App so every CTA on the
  // home page can deep-link into the new /shop hierarchy
  // without HomeView itself owning routing state.
  onNavigateShop,
  onNavigateCategory,
  onNavigateProduct,
}) {
  const t = useT();
  const [contactMenuOpen, setContactMenuOpen] = useState(false);
  // Mirrors HeroSlideshow's activeIdx so the rotating caption in
  // the left-column text block stays in sync with the photo on
  // the right. Updated via the onIndexChange callback.
  const [heroIndex, setHeroIndex] = useState(0);
  // Device-local "recently viewed" memory (localStorage). Read once on
  // mount — feeds the mobile-only "Your recent activity" strip below the
  // hero. Empty for first-time visitors, who just see hero + curated card.
  const [recentlyViewed, setRecentlyViewed] = useState(() => getRecentlyViewed());
  return (
    <div className="fade-in">
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-12 lg:pt-20 pb-16 lg:pb-24">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-16 items-center">
          <div className="lg:col-span-5 slide-up min-w-0">
            <p className="text-xs tracking-[0.3em] uppercase mb-6" style={{ color: "#B08842" }}>Cypress, California</p>
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
                  style={{ color: "#B08842", fontWeight: 400, letterSpacing: "0.005em" }}
                  aria-live="polite"
                >
                  — {caption} —
                </p>
              );
            })()}
            <p className="text-base lg:text-lg leading-relaxed mb-10 max-w-md" style={{ color: "#3D332A" }}>
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
              <button onClick={() => scrollTo("story")} className="text-sm tracking-wide underline underline-offset-4 hover:opacity-60">{t("hero.storyCta")}</button>
            </div>
          </div>
          <div className="lg:col-span-7 slide-up stagger-2">
            <div className="relative">
              <div className="aspect-[4/3] overflow-hidden">
                <HeroSlideshow className="w-full h-full" onIndexChange={setHeroIndex} />
              </div>
              <div className="absolute -bottom-6 -left-6 px-6 py-4 hidden lg:block" style={{ background: "var(--bg-page)", border: "1px solid var(--border-default)" }}>
                <p className="text-xs tracking-[0.2em] uppercase mb-1" style={{ color: "#B08842" }}>{t("hero.callout1")}</p>
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
      <section className="lg:hidden px-6 pt-2 pb-10">
        {/* a) We think you'll love — curated feature card */}
        <div className="mb-3">
          <p className="text-xs tracking-[0.2em] uppercase" style={{ color: "var(--text-muted)", fontWeight: 500 }}>
            We think you'll love
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigateProduct?.("blankets", "armenian-alphabet-blanket")}
          className="w-full flex items-center gap-4 text-left rounded-2xl p-3"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-soft)" }}
          aria-label="The Armenian Alphabet Blanket — selected for you"
        >
          <div
            className="flex-shrink-0 overflow-hidden rounded-xl"
            style={{ width: 72, height: 72, background: "var(--bg-subtle, #F5EFE3)" }}
          >
            <img
              src={product.gallery[0]}
              alt="The Armenian Alphabet Blanket"
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[0.6rem] tracking-[0.2em] uppercase mb-1" style={{ color: "#B08842", fontWeight: 600 }}>
              ✦ Selected for you
            </p>
            <p className="font-display text-base leading-tight" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
              The Armenian Alphabet Blanket
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--accent)", fontWeight: 500 }}>From $65</p>
          </div>
          <ChevronRight size={18} strokeWidth={1.5} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        </button>

        {/* b) Your recent activity — only when the guest has viewed something */}
        {recentlyViewed.length > 0 && (
          <div className="mt-8">
            <RecentlyViewedStrip
              items={recentlyViewed}
              onTap={(categorySlug, slug) => onNavigateProduct?.(categorySlug, slug)}
              heading="Your recent activity"
            />
          </div>
        )}
      </section>

      <section className="border-y py-8" style={{ borderColor: "rgba(26,22,18,0.08)", background: "rgba(176,136,66,0.04)" }}>
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
                <item.Icon size={20} strokeWidth={1.25} style={{ color: "#B08842" }} />
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
                        style={{ color: "#B08842" }}
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

      {/* Contact quick-menu — controlled by the "Custom requests"
          trust badge above. Renders nothing when closed. */}
      <ContactQuickMenu
        isOpen={contactMenuOpen}
        onClose={() => setContactMenuOpen(false)}
      />

      {/* ============================================================
          FEATURED CATEGORIES — a discovery strip, not a product list
          ============================================================
          Three category cards that link into the /shop hierarchy.
          We deliberately do NOT render the full ProductShowcase /
          bib configurator on the home page anymore — those live at
          their own /shop/<cat>/<slug> URLs. This strip is a "where
          to look next" cue, not a buying surface.

          Cards: Blankets (live), Bibs (live), Everything else (all
          remaining categories rolled into a single "Browse the shop"
          card). The customer chooses a path and goes deeper. */}
      <section className="border-y py-14 lg:py-20" style={{ borderColor: "var(--border-default)" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="max-w-2xl mx-auto text-center mb-10 lg:mb-14">
            <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "#B08842" }}>What Lusik makes</p>
            <h2 className="font-display text-3xl lg:text-5xl mb-3" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
              Hand work, <em style={{ fontWeight: 400 }}>by category</em>.
            </h2>
            <p className="text-base opacity-75 leading-relaxed">
              Cross-stitched blankets for the crib, embroidered bibs for the kitchen table, ceremonial towels for the days that count. Each piece picked up, finished, and folded by Lusik in her kitchen before it goes to your family.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5 lg:gap-6">
            {[
              {
                slug: "blankets",
                eyebrow: "Lusik's signature work",
                label: "Blankets",
                blurb: "Two crib blankets, both Armenian by heritage — the personalized one with three letters, and the full-alphabet one with all thirty-six.",
                // Two-image cycle: alphabet blanket cover + full-
                // alphabet blanket cover. The CategoryCardImage
                // component cycles between them on hover (desktop) or
                // auto-cycles on touch. Customer gets a preview of
                // both products in the category without clicking in.
                images: [
                  "/img/abc-blanket/cover.jpg",
                  "/img/full-alphabet/cover.jpg",
                ],
              },
              {
                slug: "bibs",
                eyebrow: "Small pieces, biggest hours",
                label: "Bibs",
                blurb: "Names on cloth, heritage on cloth, blessings on cloth — the small pieces that hold the busiest hours of a baby's day.",
                // Brisk slideshow on hover (desktop) or auto-cycle
                // (touch), cycling through 4 real past-customer bib
                // photos. Replaces the Romeo + blanket workshop shot
                // which had a blanket in the background.
                images: [
                  "/img/bib-examples/01.jpg",
                  "/img/bib-examples/02.jpg",
                  "/img/bib-examples/03.jpg",
                  "/img/bib-examples/04.jpg",
                ],
              },
              {
                slug: "towels",
                eyebrow: "For the days that count",
                label: "Towels & more",
                blurb: "The white baptism towel godparents bring to the font. The hand towel for the guest bath. The small fabric objects a family pulls out for the days they want to remember.",
                images: [PHOTO_DATE_DETAIL],
              },
            ].map((cat, i) => (
              <button
                key={cat.slug}
                onClick={() => onNavigateCategory?.(cat.slug)}
                className="lg-button lg-shine text-left flex flex-col stagger-reveal"
                style={{ "--i": i }}
                aria-label={`Browse ${cat.label}`}
              >
                <div className="aspect-[4/5] overflow-hidden" style={{ borderBottom: "1px solid rgba(26,22,18,0.10)" }}>
                  <CategoryCardImage images={cat.images} alt={cat.label} />
                </div>
                <div className="p-5">
                  <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-1.5" style={{ color: "#B08842" }}>{cat.eyebrow}</p>
                  <h3 className="font-display text-xl lg:text-2xl mb-2" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>{cat.label}</h3>
                  <p className="text-sm opacity-75 leading-relaxed mb-4">{cat.blurb}</p>
                  <p className="text-[0.65rem] tracking-[0.2em] uppercase flex items-center gap-1.5" style={{ color: "#B08842", fontWeight: 500 }}>
                    Explore <ArrowRight size={12} strokeWidth={1.75} />
                  </p>
                </div>
              </button>
            ))}
          </div>

          <div className="text-center mt-10">
            <button
              onClick={() => onNavigateShop?.()}
              className="text-[0.65rem] tracking-[0.25em] uppercase underline underline-offset-4 hover:opacity-70"
              style={{ color: "#1A1612", fontWeight: 500 }}
            >
              Walk through Lusik's whole shop →
            </button>
          </div>
        </div>
      </section>

      {/* FROM LUSIK'S WORKSHOP — additional real product photos that aren't
          in the main gallery, showing the range of Lusik's work: different
          color schemes, the date-detail close-up, custom personalization
          examples (Luca with hearts), and a glimpse of her bib output. This
          builds trust by showing real outcomes from past orders. */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 py-16 lg:py-20">
        <div className="text-center mb-10 max-w-2xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "#B08842" }}>From Lusik's workshop</p>
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
            <div key={i} className="aspect-square overflow-hidden stagger-reveal" style={{ "--i": i }}>
              <img src={photo.src} alt={photo.alt} className="w-full h-full object-cover" loading="lazy" decoding="async" />
            </div>
          ))}
        </div>
      </section>

      {/* MoreFromWorkshop / "Pieces by commission" coming-soon
          product grid — REMOVED. As products move from coming-soon
          to live in /shop/<category>, the dedicated "everything
          else" teaser became redundant. The Featured Categories
          strip above already routes customers to the full catalog. */}

      {/* COMMISSION / CUSTOM ORDERS TEASER — REMOVED
          ============================================================
          Removed at user request once the shop catalog filled out --
          the bib has its own /shop/bibs/baby-bib page now, and the
          ContactQuickMenu trust badge directly above already gives
          a clear "message Lusik for custom" path. A dedicated
          full-width teaser duplicated those two surfaces. */}

      <section id="story" className="py-20 lg:py-32" style={{ background: "var(--ink)", color: "var(--text-on-ink)" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 grid lg:grid-cols-12 gap-10 lg:gap-20 items-center">
          <div className="lg:col-span-6 lg:order-2 min-w-0">
            <div className="aspect-[4/5] overflow-hidden">
              {/* Fall back to gallery[0] if Lusik hasn't uploaded a 9th photo yet —
                  prevents a broken <img> if PRODUCT.gallery has fewer than 8 entries. */}
              <img src={product.gallery[7] ?? product.gallery[0]} alt="Detail of cross-stitched alphabet block" className="w-full h-full object-cover" style={galleryRotationStyle(7)} loading="lazy" decoding="async" />
            </div>
          </div>
          <div className="lg:col-span-6 lg:order-1 min-w-0">
            <p className="text-xs tracking-[0.3em] uppercase mb-6" style={{ color: "#C9A678" }}>Our Story</p>
            <h2 className="font-display text-4xl lg:text-5xl mb-8 leading-tight" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
              From Armenia, to Little Armenia, to a quiet house in Cypress.
            </h2>
            <div className="space-y-5 text-base lg:text-lg leading-relaxed opacity-90">
              <p>
                Lusik came to Los Angeles from Armenia in the late 1970s, with a cross-stitch hoop and the way of working her own grandmother had taught her. She lived in East Hollywood — what people there call Little Armenia — and later moved south to Orange County, where she lives and stitches today.
              </p>
              <p>
                What she does is cross-stitch by hand. On every blanket, the first three letters of the alphabet — <span style={{ fontWeight: 500, color: "#B08842" }}>Ա, Բ, Գ</span> in Armenian, or <span style={{ fontWeight: 500, color: "#B08842" }}>A, B, C</span> in English — placed one tiny X at a time onto soft cloth woven through with the Armenian pomegranate. For other letters, or a name you'd like spelled out, please write her directly. She always says yes.
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
              <p className="text-sm opacity-60 mt-1">Sons of the maker</p>
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

      <section id="faq" className="max-w-4xl mx-auto px-6 lg:px-12 py-20 lg:py-28">
        <p className="text-xs tracking-[0.3em] uppercase mb-4 text-center" style={{ color: "#B08842" }}>Frequently Asked</p>
        <h2 className="font-display text-4xl lg:text-5xl mb-12 text-center" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>Good questions.</h2>
        <div className="space-y-1">
          {[
            { q: "How long does it take to make my blanket?", a: "Each blanket is made to order — Lusik works on one at a time, the way her grandmother did. Plan on 5–10 business days from the day you order to the day it leaves her hands. If a specific date matters (a christening, a baby shower, a flight home to see family), tell us at checkout and we'll write back honestly about whether we can meet it." },
            { q: "Which letters come on the blanket?", a: "Three letters — Armenian (Ա, Բ, Գ) or English (A, B, C), you choose on the product page. The alphabet is stitched twice along two parallel diagonals running corner to corner, so six letter-squares cross the surface in total — three letters in one diagonal, the same three again in the other. For a different letter, an unusual combination, or a name you'd like spelled out in full, write Lusik directly at hello@lusikandsons.com. She always reads them herself." },
            { q: "Which way do the letters run?", a: "Top-left to bottom-right. Lusik stitches the alphabet along that one diagonal — she doesn't offer the mirrored direction. The middle letter sits at the heart of the blanket." },
            { q: "How do I tell you which alphabet I picked?", a: "Your choice travels through with the order. If anything needs to change after you've checked out, message us on Instagram (@lusikandsons), call or text (760) 874-2333, or reply to your order confirmation email — Lusik or one of her sons will read it." },
            { q: "Is this safe for babies?", a: "Yes. The blanket is soft acrylic, gentle enough for a newborn. Machine-washable on cold, gentle cycle, laid flat to dry — though for a piece you're hoping to keep for the next baby in the family, we'd recommend dry cleaning instead." },
            { q: "What's the difference between the blanket and the bib?", a: "The blanket is hand cross-stitched by Lusik. The bib is machine-embroidered with a personalized name — its surface is too small for counted cross-stitch to read well, and bibs live a harder life than blankets do (formula, oatmeal, the washing machine three times a week). Each piece gets the technique that fits the life it's going to have. There's a journal post explaining the difference if you'd like to read it." },
            { q: "Do you ship internationally?", a: "Not yet — only within the United States. We'll add more countries as the shop grows. If you have family abroad and want to send a piece, write us and we'll see what we can arrange." },
          ].map((item, i) => (
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

      <section id="contact" className="max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-20">
          <div className="min-w-0">
            <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: "#B08842" }}>Get in Touch</p>
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
                <c.Icon size={22} strokeWidth={1.25} style={{ color: "#B08842" }} />
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
              <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: "#B08842" }}>By Post</p>
              <h3 className="font-display text-3xl lg:text-5xl mb-6" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
                Send a <em style={{ fontWeight: 400 }}>letter</em>.
              </h3>
              <p className="text-base lg:text-lg opacity-80 leading-relaxed">
                For handwritten orders, gift notes you'd like tucked into the box, family-name requests, and the slower kind of correspondence — Lusik checks mail at our local UPS Store mailbox in Buena Park.
              </p>
              <p className="text-sm opacity-60 italic mt-4 leading-relaxed">
                A mail-receiving address only — please don't visit in person. Lusik works from her kitchen, and that's a private one.
              </p>
            </div>
            <div className="p-6 lg:p-8" style={{ border: "1px solid rgba(26,22,18,0.15)", background: "rgba(255,255,255,0.35)" }}>
              <div className="flex items-start gap-3 mb-6">
                <MapPin size={20} strokeWidth={1.25} style={{ color: "#B08842", marginTop: "4px", flexShrink: 0 }} />
                <div>
                  <p className="font-display text-xl lg:text-2xl leading-tight" style={{ fontWeight: 500 }}>
                    Lusik <span style={{ color: "#B08842" }}>&</span> Sons
                  </p>
                  <p className="text-sm opacity-60 mt-0.5 mb-2">c/o The UPS Store</p>
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
                <p className="text-xs opacity-60 italic mb-4 leading-relaxed">
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

      {/* SHIPPING & TRACKING */}
      <section id="shipping" className="max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-28 border-t" style={{ borderColor: "rgba(26,22,18,0.1)" }}>
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-20">
          <div className="min-w-0">
            <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: "#B08842" }}>Shipping & Tracking</p>
            <h2 className="font-display text-4xl lg:text-5xl mb-6" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>How your piece gets home.</h2>
            <p className="text-base lg:text-lg opacity-80 leading-relaxed">
              Find the carrier office closest to you, or follow a piece already on its way. Direct links to USPS, UPS, and FedEx — no account required, no extra clicks.
            </p>
          </div>
          <div className="space-y-8">
            <div>
              <p className="text-xs tracking-[0.2em] uppercase opacity-70 mb-4">Find a carrier near you</p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => window.open("https://www.google.com/maps/search/USPS+near+me/", "_blank", "noopener,noreferrer")} className="py-5 px-3 text-sm border hover:bg-[rgba(26,22,18,0.04)] flex flex-col items-center gap-2" style={{ borderColor: "#1A1612" }}>
                  <MapPin size={18} />
                  <span style={{ fontWeight: 500 }}>USPS</span>
                </button>
                <button onClick={() => window.open("https://www.google.com/maps/search/UPS+Store+near+me/", "_blank", "noopener,noreferrer")} className="py-5 px-3 text-sm border hover:bg-[rgba(26,22,18,0.04)] flex flex-col items-center gap-2" style={{ borderColor: "#1A1612" }}>
                  <MapPin size={18} />
                  <span style={{ fontWeight: 500 }}>UPS</span>
                </button>
                <button onClick={() => window.open("https://www.google.com/maps/search/FedEx+near+me/", "_blank", "noopener,noreferrer")} className="py-5 px-3 text-sm border hover:bg-[rgba(26,22,18,0.04)] flex flex-col items-center gap-2" style={{ borderColor: "#1A1612" }}>
                  <MapPin size={18} />
                  <span style={{ fontWeight: 500 }}>FedEx</span>
                </button>
              </div>
              <p className="text-xs opacity-60 mt-3">Opens Google Maps with the offices closest to you.</p>
            </div>
            <TrackingForm />
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="py-20 lg:py-28" style={{ background: "rgba(176,136,66,0.08)" }}>
        <div className="max-w-3xl mx-auto px-6 lg:px-12 text-center">
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: "#B08842" }}>Stay Connected</p>
          <h2 className="font-display text-4xl lg:text-5xl mb-6" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>The occasional note.</h2>
          <p className="text-base lg:text-lg opacity-80 leading-relaxed mb-10 max-w-xl mx-auto">
            When Lusik adds a new alphabet, a seasonal piece, or one of the placeholders finally goes live — we'll write you a short note. About one email a month. Never more, never anything we wouldn't send to our own mother.
          </p>
          <NewsletterSignup variant="hero" />
        </div>
      </section>
    </div>
  );
}
