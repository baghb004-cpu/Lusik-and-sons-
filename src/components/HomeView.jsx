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
//   - Featured Categories strip (NEW — replaces the inline PDP)
//   - From Lusik's Workshop (photo grid)
//   - Pieces by commission (NEW teaser — replaces inline bib card)
//   - Our Story
//   - Testimonials + Customer Photos
//   - FAQ
//   - Get in Touch / Four Ways to Order
//   - By Post / Send a Letter (mailing address)
//   - Shipping & Tracking
//   - Stay Connected (newsletter)
// ============================================================

import React, { useEffect } from "react";
import { useT } from "../i18n/LangContext.jsx";
import { TrackingForm } from "./TrackingForm.jsx";
import { NewsletterSignup } from "./NewsletterSignup.jsx";
import { TestimonialsSection } from "./TestimonialsSection.jsx";
import { HeroSlideshow } from "./HeroSlideshow.jsx";
import { MoreFromWorkshop } from "./MoreFromWorkshop.jsx";
import { CustomerPhotosSection } from "./CustomerPhotosSection.jsx";
import { ArrowRight, MapPin, Plus, Heart, Instagram, Mail, Phone, Shield, ShoppingBag, Truck } from "./icons.jsx";
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
  return (
    <div className="fade-in">
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-12 lg:pt-20 pb-16 lg:pb-24">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-16 items-center">
          <div className="lg:col-span-5 slide-up min-w-0">
            <p className="text-xs tracking-[0.3em] uppercase mb-6" style={{ color: "#B08842" }}>Cypress, California</p>
            <h1 className="font-display text-5xl lg:text-7xl leading-[0.95] mb-8" style={{ fontWeight: 400, letterSpacing: "-0.02em" }}>
              {t("hero.headline")} <em style={{ fontWeight: 400 }}>{t("hero.headlineEm")}</em>.
            </h1>
            <p className="text-base lg:text-lg leading-relaxed mb-10 max-w-md" style={{ color: "#3D332A" }}>
              {t("hero.body")}<a href="mailto:hello@lusikandsons.com?subject=Custom letter request" className="underline" style={{ color: "#1A1612" }}>{t("hero.bodyEmailLink")}</a>{t("hero.bodyAfter")}
            </p>
            <div className="flex items-center gap-6">
              <button
                onClick={() => onNavigateProduct?.("blankets", "armenian-alphabet-blanket")}
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
                <HeroSlideshow className="w-full h-full" />
              </div>
              <div className="absolute -bottom-6 -left-6 px-6 py-4 hidden lg:block" style={{ background: "var(--bg-page)", border: "1px solid var(--border-default)" }}>
                <p className="text-xs tracking-[0.2em] uppercase mb-1" style={{ color: "#B08842" }}>{t("hero.callout1")}</p>
                <p className="font-display text-lg" style={{ fontWeight: 400 }}>{t("hero.callout2")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y py-8" style={{ borderColor: "rgba(26,22,18,0.08)", background: "rgba(176,136,66,0.04)" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-12">
          {[
            { Icon: Heart, label: "Hand cross-stitched", sub: "By Lusik herself" },
            { Icon: Shield, label: "Made to order", sub: "Your letter, your color" },
            { Icon: Truck, label: "Free US shipping", sub: "On orders over $150" },
            { Icon: Mail, label: "Custom requests", sub: "Welcome by message" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <item.Icon size={20} strokeWidth={1.25} style={{ color: "#B08842" }} />
              <div>
                <p className="text-sm" style={{ fontWeight: 500 }}>{item.label}</p>
                <p className="text-xs opacity-70">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

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
              Cross-stitched blankets, embroidered bibs, ceremonial towels, and small items for the very first days. Pick a path to explore.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5 lg:gap-6">
            {[
              {
                slug: "blankets",
                eyebrow: "Lusik's signature work",
                label: "Blankets",
                blurb: "Hand cross-stitched baby blankets — Armenian Ա Բ Գ or English A B C.",
                image: product.gallery[0],
              },
              {
                slug: "bibs",
                eyebrow: "Small piece, big heart",
                label: "Bibs",
                blurb: "Machine-embroidered with a personalized name — up to six letters.",
                image: PHOTO_BIB_ROMEO,
              },
              {
                slug: "towels",
                eyebrow: "For the milestone moments",
                label: "Towels & more",
                blurb: "Embroidered hand and ceremonial towels. Coming soon.",
                image: PHOTO_DATE_DETAIL,
              },
            ].map((cat) => (
              <button
                key={cat.slug}
                onClick={() => onNavigateCategory?.(cat.slug)}
                className="lg-button lg-shine text-left flex flex-col"
                aria-label={`Browse ${cat.label}`}
              >
                <div className="aspect-[4/5] overflow-hidden" style={{ borderBottom: "1px solid rgba(26,22,18,0.10)" }}>
                  <img src={cat.image} alt={cat.label} className="w-full h-full object-cover" loading="lazy" decoding="async" />
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
              See everything Lusik makes →
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
            Past blankets, <em style={{ fontWeight: 400 }}>real orders</em>.
          </h2>
          <p className="text-sm opacity-70 mt-3 leading-relaxed">
            A few examples of work Lusik has stitched recently — color variations, custom names and dates, and details up close.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4">
          <div className="aspect-square overflow-hidden">
            <img src={PHOTO_DATE_DETAIL} alt="Close-up of 07/05/24 birth date cross-stitched on blanket" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          </div>
          <div className="aspect-square overflow-hidden">
            <img src={PHOTO_PURPLE_SIDE} alt="Purple Armenian alphabet detail" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          </div>
          <div className="aspect-square overflow-hidden">
            <img src={PHOTO_YELLOWGREEN_2} alt="Yellow and green Armenian alphabet variation" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          </div>
          <div className="aspect-square overflow-hidden">
            <img src={PHOTO_BIB_STACK} alt="Stack of machine-embroidered bibs in different colors" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          </div>
          <div className="aspect-square overflow-hidden">
            <img src={PHOTO_BIB_PILE} alt="Pile of bibs and blanket showing yellow and green work" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          </div>
          <div className="aspect-square overflow-hidden">
            <img src={PHOTO_BIB_ROMEO} alt="Romeo bib with matching blue alphabet blanket" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          </div>
        </div>
      </section>

      {/* MoreFromWorkshop — coming-soon product cards strip from main. */}
      <MoreFromWorkshop />

      {/* COMMISSION / CUSTOM ORDERS TEASER
          ============================================================
          Previously embedded the full <CustomProductCard> bib
          configurator. With the /shop hierarchy in place, the bib
          lives at /shop/bibs/baby-bib. This section now teases that
          flow without the inline buy surface. */}
      <section id="commission" className="py-20 lg:py-28" style={{ background: "var(--bg-elevated)", borderTop: "1px solid var(--border-default)", borderBottom: "1px solid var(--border-default)" }}>
        <div className="max-w-5xl mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: "#B08842" }}>Pieces by commission</p>
              <h2 className="font-display text-4xl lg:text-5xl mb-6" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
                Send us <em style={{ fontWeight: 400 }}>a name</em>.
              </h2>
              <p className="text-base lg:text-lg opacity-80 leading-relaxed mb-8">
                Lusik machine-embroiders a short name onto a soft white baby bib — up to five or six letters, since the bib's surface is small. One size, fits most babies. Made to order.
              </p>
              <button
                onClick={() => onNavigateProduct?.("bibs", "baby-bib")}
                className="lg-button-ink lg-shine inline-flex items-center gap-3 px-6 py-3 text-sm tracking-wide"
                style={{ fontWeight: 500 }}
              >
                Personalize a bib <ArrowRight size={16} strokeWidth={1.5} />
              </button>
              <p className="mt-4">
                <button
                  onClick={() => onNavigateCategory?.("bibs")}
                  className="text-[0.65rem] tracking-[0.25em] uppercase underline underline-offset-4 hover:opacity-70"
                  style={{ color: "#1A1612", fontWeight: 500 }}
                >
                  Or see all bibs →
                </button>
              </p>
            </div>
            <div className="aspect-square overflow-hidden">
              <img
                src={PHOTO_BIB_STACK}
                alt="A stack of personalized bibs in different colors"
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>

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
              From Armenia, to Little Armenia, to a small home in Cypress.
            </h2>
            <div className="space-y-5 text-base lg:text-lg leading-relaxed opacity-90">
              <p>
                Lusik came to Los Angeles from Armenia in the late 1970s. She lived in East Hollywood — what people call Little Armenia — and later moved to Orange County, where she lives today.
              </p>
              <p>
                Lusik buys the blankets and bibs from a maker she trusts. What she does is cross-stitch by hand. She does the first three letters of the alphabet — <span style={{ fontWeight: 500, color: "#B08842" }}>Ա, Բ, Գ</span> in Armenian, or <span style={{ fontWeight: 500, color: "#B08842" }}>A, B, C</span> in English. For other letters or special requests, please email her.
              </p>
              <p>
                The bib is different. The bib is machine-embroidered with a personalized name — short, just five or six letters at most. Anything longer doesn't fit comfortably on the small bib surface. It's the only piece in the shop she does by machine.
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
            { q: "How long does it take to make my blanket?", a: "Each blanket is made to order. Please allow 5–10 business days before it ships." },
            { q: "Which letters come on the blanket?", a: "Each blanket has three letters — Armenian (Ա, Բ, Գ) or English (A, B, C). The alphabet is stitched twice, along two parallel diagonals that run top-left to bottom-right, so six letter-squares appear across the blanket in total — three letters in one diagonal, the same three again in the other. You pick the alphabet on the product page. For other letters or special requests, please email Lusik at hello@lusikandsons.com." },
            { q: "Which way do the letters run?", a: "Top-left to bottom-right. Lusik stitches the alphabet along that one diagonal — she doesn't offer the mirrored direction. The middle letter is always in the center." },
            { q: "How do I tell you which alphabet I picked?", a: "Your choice goes through with the order. If you want anything different, message us on Instagram (@lusikandsons), call or text (760) 874-2333, or reply to your order confirmation email." },
            { q: "Is this safe for babies?", a: "Yes. The blanket is soft acrylic, machine-washable. Gentle cycle, cold water, and lay flat to dry." },
            { q: "What's the difference between the blanket and the bib?", a: "The blanket is hand cross-stitched by Lusik. The bib is machine-embroidered with a personalized name (up to five or six letters) — its surface is too small for counted cross-stitch to read well, so each piece gets the technique that suits its size." },
            { q: "Do you ship internationally?", a: "Not yet. We ship within the United States only." },
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
            <h2 className="font-display text-4xl lg:text-5xl mb-6" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>Four ways to order.</h2>
            <p className="text-base lg:text-lg opacity-80 leading-relaxed">
              Check out directly on this site, give us a call, message us on Instagram, or send an email for custom commissions and bulk gift orders.
            </p>
          </div>
          <div className="space-y-1">
            {[
              { Icon: ShoppingBag, label: "Shop online", detail: "Browse and check out", action: () => onNavigateShop?.() },
              { Icon: Phone, label: "Call us", detail: "(760) 874-2333", action: () => window.open("tel:+17608742333") },
              { Icon: Instagram, label: "DM on Instagram", detail: "@lusikandsons", action: () => window.open("https://instagram.com", "_blank", "noopener,noreferrer") },
              { Icon: Mail, label: "Email inquiry", detail: "hello@lusikandsons.com", action: () => window.open("mailto:hello@lusikandsons.com") },
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
                For handwritten orders, returns, gift notes, and heritage requests — Lusik retrieves mail from our local UPS Store mailbox in Buena Park.
              </p>
              <p className="text-sm opacity-60 italic mt-4 leading-relaxed">
                This is a mail-receiving address only — please don't visit in person.
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
                  When Lusik can collect your letter from the UPS Store.
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
            <h2 className="font-display text-4xl lg:text-5xl mb-6" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>Drop-off & tracking, made easy.</h2>
            <p className="text-base lg:text-lg opacity-80 leading-relaxed">
              Find your nearest carrier location, or track an order on its way. Direct links — no account required.
            </p>
          </div>
          <div className="space-y-8">
            <div>
              <p className="text-xs tracking-[0.2em] uppercase opacity-70 mb-4">Find a location near you</p>
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
              <p className="text-xs opacity-60 mt-3">Opens in Google Maps with locations near you.</p>
            </div>
            <TrackingForm />
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="py-20 lg:py-28" style={{ background: "rgba(176,136,66,0.08)" }}>
        <div className="max-w-3xl mx-auto px-6 lg:px-12 text-center">
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: "#B08842" }}>Stay Connected</p>
          <h2 className="font-display text-4xl lg:text-5xl mb-6" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>Be first to know.</h2>
          <p className="text-base lg:text-lg opacity-80 leading-relaxed mb-10 max-w-xl mx-auto">
            New letter colors, special edition pieces, and seasonal collections. About one email a month — never more, never spam.
          </p>
          <NewsletterSignup variant="hero" />
        </div>
      </section>
    </div>
  );
}
