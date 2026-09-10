"use client";

// ============================================================
// ProductChooser — three questions, one recommendation
// ============================================================
// SITE_OVERHAUL_HANDOFF.md PR 7: "HelpDecidingSection gains a
// three-question chooser (Who is it for, When do you need it, Armenian or
// English) that recommends a product."
//
// The rules live in src/lib/chooseProduct.js — plain JavaScript, unit
// tested — because this is advice a customer acts on. The important one
// is that a deadline REMOVES what cannot be finished in time rather than
// ranking it lower, and that the longest estimate is what decides.
//
// Nothing here is a lead-capture form. There is no email field, no "see
// your result" gate, and every answer can be changed. It is a shortcut
// through seven products, not a funnel.
// ============================================================

import React, { useId, useMemo, useState } from "react";
import { useT, useLang } from "../../i18n/LangContext.jsx";
import { loc } from "../../i18n/localize.js";
import { listCategories } from "../../data/catalog.js";
import { CONFIG } from "../../data/config.js";
import { productHeroImage } from "../../lib/productHeroImage.js";
import { PRODUCT } from "../../data/product.js";
import {
  LANGUAGE_OPTIONS, WHEN_OPTIONS, WHO_OPTIONS, chooseProduct, isAnswered,
} from "../../lib/chooseProduct.js";
import { ArrowRight } from "../icons.jsx";

/** Every live product, shaped the way the rules take it. */
function shopForChooser() {
  const weeks = CONFIG.LEAD_TIMES?.WEEKS ?? {};
  const fallback = CONFIG.LEAD_TIMES?.DEFAULT_WEEKS ?? [3, 5];
  const out = [];
  for (const category of listCategories()) {
    for (const product of category.products ?? []) {
      if (product.status !== "live") continue;
      const key = product.trustedKey ?? product.key;
      out.push({
        key,
        slug: product.slug,
        categorySlug: category.slug,
        priceFrom: product.priceFrom ?? undefined,
        weeks: weeks[key] ?? weeks[product.key] ?? fallback,
        product,
        category,
      });
    }
  }
  return out;
}

function Question({ label, options, value, onChange, labelFor }) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-[0.65rem] tracking-[0.25em] uppercase mb-2.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(selected ? null : option.key)}
              aria-pressed={selected}
              className="px-3.5 py-2 text-sm transition"
              style={{
                border: `1px solid ${selected ? "var(--ink)" : "var(--border-strong)"}`,
                background: selected ? "var(--ink)" : "transparent",
                color: selected ? "var(--text-on-ink)" : "var(--text-primary)",
              }}
            >
              {labelFor(option.key)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ProductChooser({ onNavigateProduct, onPrefetch, className = "" }) {
  const t = useT();
  const { lang } = useLang();
  const [answers, setAnswers] = useState({ who: null, when: null, language: null });
  // The shop page renders this twice — once in the mobile column, once in
  // the desktop one, both in the DOM and switched by CSS. A hardcoded id
  // would appear twice in the document, which is invalid and makes
  // aria-labelledby ambiguous for whichever copy is showing.
  const headingId = useId();

  const shop = useMemo(() => shopForChooser(), []);
  const result = useMemo(
    () => (isAnswered(answers) ? chooseProduct(shop, answers) : null),
    [shop, answers],
  );

  const set = (field) => (value) => setAnswers((prev) => ({ ...prev, [field]: value }));

  return (
    <section
      className={`px-6 lg:px-12 py-10 lg:py-14 ${className}`}
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      aria-labelledby={headingId}
    >
      <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "var(--accent-text)" }}>
        {t("chooser.eyebrow")}
      </p>
      <h2 id={headingId} className="font-display text-2xl lg:text-3xl mb-7 leading-tight" style={{ fontWeight: 400 }}>
        {t("chooser.title")}
      </h2>

      <div className="grid sm:grid-cols-3 gap-6 lg:gap-8">
        <Question
          label={t("chooser.whoLabel")}
          options={WHO_OPTIONS}
          value={answers.who}
          onChange={set("who")}
          labelFor={(key) => t(`chooser.who.${key}`)}
        />
        <Question
          label={t("chooser.whenLabel")}
          options={WHEN_OPTIONS}
          value={answers.when}
          onChange={set("when")}
          labelFor={(key) => t(`chooser.when.${key}`)}
        />
        <Question
          label={t("chooser.languageLabel")}
          options={LANGUAGE_OPTIONS}
          value={answers.language}
          onChange={set("language")}
          labelFor={(key) => t(`chooser.language.${key}`)}
        />
      </div>

      {/* aria-live so the answer is announced when it changes: a customer
          using a screen reader is three taps away and would otherwise
          have to go looking for what happened. */}
      <div className="mt-8" aria-live="polite">
        {result && <ChooserResult result={result} onNavigateProduct={onNavigateProduct} onPrefetch={onPrefetch} lang={lang} />}
      </div>
    </section>
  );
}

function ChooserResult({ result, onNavigateProduct, onPrefetch, lang }) {
  const t = useT();
  const { recommended, alternatives, excludedForTime } = result;

  if (!recommended) {
    // Nothing fits. Say so, and say what to do about it — the phone
    // number is on the page and Lusik does take commissions.
    return (
      <div className="p-5" style={{ border: "1px dashed var(--border-strong)" }}>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
          {t("chooser.nothingFits")}
        </p>
        <a
          href={`tel:${CONFIG.TEXT_US.phone_e164}`}
          className="inline-flex items-center gap-2 text-sm mt-3"
          style={{ color: "var(--accent-text)" }}
        >
          {t("chooser.callLusik", { phone: CONFIG.TEXT_US.phone_display })}
        </a>
      </div>
    );
  }

  const name = loc(recommended.product, "name", lang);
  const image = productHeroImage(recommended.product, { galleryFallback: PRODUCT.gallery?.[0] ?? null });
  const href = `/shop/${recommended.categorySlug}/${recommended.slug}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => onNavigateProduct?.(recommended.categorySlug, recommended.slug)}
        onMouseEnter={() => onPrefetch?.(href)}
        onFocus={() => onPrefetch?.(href)}
        aria-label={t("chooser.openRecommendation", { name })}
        className="w-full text-left flex gap-4 items-center p-4 transition"
        style={{ background: "var(--bg-page)", border: "1px solid var(--border-default)" }}
      >
        {image && (
          <img
            src={image}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="w-20 h-24 object-cover shrink-0"
          />
        )}
        <span className="min-w-0">
          <span className="block text-[0.65rem] tracking-[0.25em] uppercase mb-1" style={{ color: "var(--accent-text)" }}>
            {t("chooser.resultEyebrow")}
          </span>
          <span className="block font-display text-lg leading-snug" style={{ color: "var(--text-primary)" }}>
            {name}
          </span>
          <span className="block text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            {t("chooser.leadTime", { min: recommended.weeks[0], max: recommended.weeks[1] })}
          </span>
        </span>
        <ArrowRight size={18} strokeWidth={1.5} className="ml-auto shrink-0" style={{ color: "var(--accent-text)" }} />
      </button>

      {alternatives.length > 0 && (
        <p className="text-xs mt-3" style={{ color: "var(--text-secondary)" }}>
          {t("chooser.alsoConsider")}{" "}
          {alternatives.map((alt, i) => (
            <React.Fragment key={alt.key}>
              {i > 0 && ", "}
              <button
                type="button"
                onClick={() => onNavigateProduct?.(alt.categorySlug, alt.slug)}
                className="underline underline-offset-2"
                style={{ color: "var(--accent-text)" }}
              >
                {loc(alt.product, "name", lang)}
              </button>
            </React.Fragment>
          ))}
        </p>
      )}

      {excludedForTime > 0 && (
        /* Told, not hidden. Someone who has just been shown three pieces
           should know that others exist and why they were not offered —
           they may well move their date. */
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          {t("chooser.excludedForTime", { count: excludedForTime })}
        </p>
      )}
    </div>
  );
}
