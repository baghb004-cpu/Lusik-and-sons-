"use client";

// ============================================================
// /welcome — where the printed card lands
// ============================================================
// SITE_OVERHAUL_HANDOFF.md PR 8 asks for "the landing page for the
// brochure QR: thank you, care, coupon activation link to /shop, send us
// a photo, follow on Instagram."
//
// Someone reading this is standing somewhere holding a piece of paper.
// So it answers, in order, the things a person holding that paper wants
// to know, and nothing else: how to order, why the colour on the card is
// not exactly the colour that arrives, how long it takes, what to do
// with a code, how to look after the piece, and where to find her.
//
// It carries the printed piece's voice, which means no em dashes: the
// card was set without them on purpose and a landing page that reads
// differently reads like a different shop.
//
// The lead times come from CONFIG.LEAD_TIMES through the same helper the
// product pages and the confirmation emails use, so this page cannot
// quote a number the shop has stopped working to. It states the time and
// never the reason, which is the owner's rule; a unit test holds it.
//
// Static: no engine, no state, no fetch. The one image is a poster the
// Loom already drew.
// ============================================================

import React from "react";
import { useT } from "../i18n/LangContext.jsx";
import { CONFIG } from "../data/config.js";
import { weeksLabel } from "../lib/leadTime.js";
import { ArrowRight, Instagram, Mail, Phone } from "./icons.jsx";

const INSTAGRAM_URL = "https://instagram.com";
const INSTAGRAM_HANDLE = "@lusikandsons";
const CONTACT_EMAIL = "hello@lusikandsons.com";

/** A card with an eyebrow, a heading and body copy. */
function Panel({ eyebrow, title, children }) {
  return (
    <section
      className="p-6 lg:p-8"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-2.5" style={{ color: "var(--accent-text)" }}>
        {eyebrow}
      </p>
      <h2 className="font-display text-xl lg:text-2xl mb-3 leading-snug" style={{ fontWeight: 400 }}>
        {title}
      </h2>
      <div className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {children}
      </div>
    </section>
  );
}

export function WelcomeView({ onNavigateShop, onPrefetch }) {
  const t = useT();

  // Three real numbers, read from the lead-time board rather than typed
  // here. The fastest piece, the blanket most people come for, and the
  // slowest thing in the shop, so nobody is surprised at either end.
  const times = [
    { key: "bib-single", label: t("welcome.timeBibs") },
    { key: "blanket-alphabet", label: t("welcome.timeBlanket") },
    { key: "blanket-full-alphabet", label: t("welcome.timeCrib") },
  ];

  const photoMailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t("welcome.photoSubject"))}`;

  return (
    <div className="fade-in max-w-5xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
      <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "var(--accent-text)" }}>
        {t("welcome.eyebrow")}
      </p>
      <h1 className="font-display text-4xl lg:text-6xl mb-5 leading-[1.05]" style={{ fontWeight: 400, letterSpacing: "-0.02em" }}>
        {t("welcome.title")}
      </h1>
      <p className="text-base lg:text-lg max-w-2xl leading-relaxed mb-8" style={{ color: "var(--text-secondary)" }}>
        {t("welcome.lede")}
      </p>

      {/* A poster the Loom drew, not a photograph. Kept small and left
          unframed: the poster has a transparent ground, so on the cream
          page the blanket simply sits there. Full width it pushed "how
          do I order" below the fold on a phone, and cropping it to a band
          left a lot of empty cloth around one row of letters.

          Decorative, hence the empty alt: the heading above already says
          what this page is. Sized in the markup so nothing shifts as it
          loads. */}
      <img
        src="/img/loom/alphabet-blanket.webp"
        alt=""
        aria-hidden="true"
        width={1200}
        height={900}
        decoding="async"
        className="w-full max-w-sm h-auto mb-10"
      />

      <div className="grid sm:grid-cols-2 gap-5 lg:gap-6">
        <Panel eyebrow={t("welcome.orderEyebrow")} title={t("welcome.orderTitle")}>
          <p className="mb-4">{t("welcome.orderBody")}</p>
          <ul className="space-y-3">
            <li>
              <a
                href={`tel:${CONFIG.TEXT_US.phone_e164}`}
                className="inline-flex items-center gap-2"
                style={{ color: "var(--accent-text)" }}
              >
                <Phone size={15} strokeWidth={1.5} />
                {CONFIG.TEXT_US.phone_display}
              </a>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigateShop?.()}
                onMouseEnter={() => onPrefetch?.("/shop")}
                onFocus={() => onPrefetch?.("/shop")}
                className="inline-flex items-center gap-2"
                style={{ color: "var(--accent-text)" }}
              >
                {t("welcome.orderOnline")}
                <ArrowRight size={14} strokeWidth={1.5} />
              </button>
            </li>
            <li>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
                style={{ color: "var(--accent-text)" }}
              >
                <Instagram size={15} strokeWidth={1.5} />
                {INSTAGRAM_HANDLE}
              </a>
            </li>
          </ul>
        </Panel>

        <Panel eyebrow={t("welcome.colorsEyebrow")} title={t("welcome.colorsTitle")}>
          <p>{t("welcome.colorsBody")}</p>
        </Panel>

        <Panel eyebrow={t("welcome.timeEyebrow")} title={t("welcome.timeTitle")}>
          <ul className="space-y-2 mb-4">
            {times.map((row) => (
              <li key={row.key} className="flex justify-between gap-4">
                <span>{row.label}</span>
                <span className="shrink-0 tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {weeksLabel(row.key)}
                </span>
              </li>
            ))}
          </ul>
          <p>{t("welcome.timeBody")}</p>
        </Panel>

        <Panel eyebrow={t("welcome.codeEyebrow")} title={t("welcome.codeTitle")}>
          <p className="mb-4">{t("welcome.codeBody")}</p>
          <button
            type="button"
            onClick={() => onNavigateShop?.()}
            onMouseEnter={() => onPrefetch?.("/shop")}
            onFocus={() => onPrefetch?.("/shop")}
            className="inline-flex items-center gap-2 px-5 py-3 text-[0.7rem] tracking-[0.2em] uppercase"
            style={{ background: "var(--ink)", color: "var(--text-on-ink)" }}
          >
            {t("welcome.codeCta")}
            <ArrowRight size={14} strokeWidth={1.5} />
          </button>
        </Panel>

        <Panel eyebrow={t("welcome.careEyebrow")} title={t("welcome.careTitle")}>
          <p>{t("welcome.careBody")}</p>
        </Panel>

        <Panel eyebrow={t("welcome.photoEyebrow")} title={t("welcome.photoTitle")}>
          <p className="mb-4">{t("welcome.photoBody")}</p>
          <a href={photoMailto} className="inline-flex items-center gap-2" style={{ color: "var(--accent-text)" }}>
            <Mail size={15} strokeWidth={1.5} />
            {CONTACT_EMAIL}
          </a>
        </Panel>
      </div>

      <p className="text-sm leading-relaxed mt-10 max-w-2xl" style={{ color: "var(--text-secondary)" }}>
        {t("welcome.closing")}
      </p>
    </div>
  );
}
