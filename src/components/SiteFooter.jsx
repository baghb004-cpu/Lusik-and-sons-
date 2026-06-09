"use client";

// ============================================================
// SiteFooter — desktop (lg+) footer
// ============================================================
// Reproduces App.jsx's desktop <footer> for the Next chrome. Mobile hides it
// (lg:block) — phones reach these destinations via the For You cards + bottom
// nav. Navigation runs through next/navigation (useSiteNav); policy links call
// onOpenPolicy (the chrome owns the PolicyModal).
// ============================================================

import React from "react";
import { BetaTranslationBadge } from "./BetaTranslationBadge.jsx";
import { NewsletterSignup } from "./NewsletterSignup.jsx";
import { FooterLangToggle } from "./FooterLangToggle.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";
import { Phone, Instagram, Mail, MapPin, Check, Send } from "./icons.jsx";
import { useT } from "../i18n/LangContext.jsx";
import { useSiteNav } from "../state/useSiteNav.js";

export function SiteFooter({ onOpenPolicy }) {
  const t = useT();
  const nav = useSiteNav();
  const openPolicy = onOpenPolicy || (() => {});

  return (
    <footer className="hidden lg:block border-t mt-12 theme-surface" style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="grid md:grid-cols-12 gap-10 lg:gap-12">
          <div className="md:col-span-4">
            <p className="font-display text-2xl mb-3" style={{ fontWeight: 500 }}>
              Lusik <span style={{ color: "var(--accent)" }}>&</span> Sons
            </p>
            <p className="text-sm opacity-70 leading-relaxed mb-4">{t("footer.brand")}</p>
            <p className="text-xs opacity-75 italic font-display" style={{ fontWeight: 400 }}>{t("footer.tagline")}</p>
          </div>

          <div className="md:col-span-2">
            <p className="text-xs tracking-[0.3em] uppercase mb-4 opacity-70">{t("footer.shop")}</p>
            <div className="flex flex-col gap-2 text-sm">
              <button onClick={() => nav.goShopCategory("blankets")} className="text-left hover:opacity-60">{t("nav.blanket")}</button>
              <button onClick={() => nav.goShopCategory("bibs")} className="text-left hover:opacity-60">{t("nav.custom")}</button>
              <button onClick={() => nav.goPage("story")} className="text-left hover:opacity-60">{t("nav.story")}</button>
              <button onClick={nav.goJournal} className="text-left hover:opacity-60">Journal</button>
              <button onClick={() => nav.goPage("faq")} className="text-left hover:opacity-60">{t("nav.faq")}</button>
            </div>
          </div>

          <div className="md:col-span-3">
            <p className="text-xs tracking-[0.3em] uppercase mb-4 opacity-70">{t("footer.help")}</p>
            <div className="flex flex-col gap-2 text-sm">
              <button onClick={() => nav.goPage("shipping")} className="text-left hover:opacity-60">{t("footer.shippingTracking")}</button>
              <button onClick={() => openPolicy("finalSale")} className="text-left hover:opacity-60">{t("footer.finalSalePolicy")}</button>
              <button onClick={() => openPolicy("privacy")} className="text-left hover:opacity-60">{t("footer.privacyPolicy")}</button>
              {/* CPRA-required opt-out link — opens the privacy policy scrolled
                  to the live do-not-share switch (see PolicyModal). */}
              <button onClick={() => openPolicy("privacyChoices")} className="text-left hover:opacity-60">{t("footer.privacyChoices")}</button>
              <button onClick={() => openPolicy("terms")} className="text-left hover:opacity-60">{t("footer.termsOfService")}</button>
              <button onClick={() => nav.goPage("contact")} className="text-left hover:opacity-60">{t("footer.contactUs")}</button>
            </div>
          </div>

          <div className="md:col-span-3">
            <p className="text-xs tracking-[0.3em] uppercase mb-4 opacity-70">{t("footer.findUs")}</p>
            <div className="flex flex-col gap-2 text-sm">
              <a href="tel:+17608742333" className="hover:opacity-60 flex items-center gap-2"><Phone size={14} /> (760) 874-2333</a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-60 flex items-center gap-2"><Instagram size={14} /> @lusikandsons</a>
              <a href="mailto:hello@lusikandsons.com" className="hover:opacity-60 flex items-center gap-2"><Mail size={14} /> hello@lusikandsons.com</a>
            </div>
            <p className="text-xs opacity-75 mt-4 leading-relaxed">{t("footer.repliesNote")}</p>
          </div>
        </div>

        <BetaTranslationBadge />
        <div className="gold-line my-10" />
        <NewsletterSignup />

        <div className="grid sm:grid-cols-3 gap-4 mb-8 text-xs opacity-70">
          <div className="flex items-center gap-2.5"><MapPin size={14} strokeWidth={1.5} style={{ color: "var(--accent)", flexShrink: 0 }} /><span>{t("footer.trustMade")}</span></div>
          <div className="flex items-center gap-2.5"><Check size={14} strokeWidth={1.75} style={{ color: "var(--accent)", flexShrink: 0 }} /><span>{t("footer.trustSecure")}</span></div>
          <div className="flex items-center gap-2.5"><Send size={14} strokeWidth={1.5} style={{ color: "var(--accent)", flexShrink: 0 }} /><span>{t("footer.trustShips")}</span></div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs pt-6" style={{ borderTop: "1px solid var(--border-soft)" }}>
          <p className="opacity-75">{t("footer.copyright", { year: new Date().getFullYear() })}</p>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <FooterLangToggle />
            <ThemeToggle />
          </div>
          <p className="font-display italic opacity-75" style={{ fontWeight: 400 }}>
            <span>{t("footer.thanks")}</span> · {t("footer.thanksEn")} · {t("footer.madeWith")}
          </p>
        </div>

        <p className="text-[0.6rem] opacity-75 leading-relaxed pt-4 mt-4" style={{ borderTop: "1px solid rgba(26,22,18,0.05)" }}>
          All trademarks belong to their respective owners. Lusik &amp; Sons is not affiliated with, endorsed by, or sponsored by any of the companies mentioned on this site. See our <button onClick={() => openPolicy("terms")} className="underline hover:opacity-100">Terms of Service</button> for full details.
        </p>
      </div>
    </footer>
  );
}
