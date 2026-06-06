"use client";

// ============================================================
// CribBlanketCard — live buy surface for the Full Alphabet Crib
// Blanket (hand-knit, all 36 Armenian letters).
// ============================================================
// Body-color choice + an optional name (set into a free square, no
// upcharge). Single SKU `blanket-full-alphabet`; the chosen color +
// name ride in the bag, the Stripe line-item description, and the
// order metadata — never in the price, which the server controls.
// ============================================================

import React, { useState, useRef } from "react";
import { ProductImageGallery } from "../ProductImageGallery.jsx";
import { ProductVariationNote } from "../ProductVariationNote.jsx";
import { ExpandableText } from "../ExpandableText.jsx";
import { SoldOutPanel } from "./SoldOutPanel.jsx";
import { StickyMobileBuyBar } from "./StickyMobileBuyBar.jsx";
import { PurchaseCard } from "./PurchaseCard.jsx";
import { Breadcrumbs } from "./Breadcrumbs.jsx";
import { ArrowRight, Plus } from "../icons.jsx";
import { useInViewport } from "../../lib/useInViewport";
import { useT, useLang } from "../../i18n/LangContext.jsx";
import { loc } from "../../i18n/localize.js";

function cleanText(text) {
  if (!text) return "";
  return text.split(/\s*⚠️\s*TODO_LUSIK\s*:?/i)[0].trim().replace(/\s{2,}/g, " ");
}

export function CribBlanketCard({ product, spec, trail, onAddCustom, onBuyNow, onCartFeedback, soldOut = false, notifyKey }) {
  const t = useT();
  const { lang } = useLang();
  const buy = spec.buy ?? {};
  const colorways = Array.isArray(product.colorways) ? product.colorways : [];

  const productName = loc(product, "name", lang);
  const description = cleanText(product.description);
  const details = Array.isArray(product.details) ? product.details : [];
  const nameMax = buy.nameMax ?? 12;

  // The selected colorway (a catalog colorway object: { label, indices,
  // swatch }). The gallery's Apple color row owns the selection + photo
  // swap and reports it here; the order records the colorway by name.
  const [body, setBody] = useState(colorways[0] ?? null);
  const [name, setName] = useState("");

  const lastAddTsRef = useRef(0);
  const [adding, setAdding] = useState(false);
  // Mobile sticky Add-to-Bag shows while the in-page button is off-screen.
  const [addBtnRef, addBtnInView] = useInViewport();

  const buildPayload = () => {
    const trimmed = name.trim().slice(0, nameMax);
    const parts = [];
    if (buy.sizeLabel) parts.push(buy.sizeLabel);
    if (body) parts.push(`${body.label} body`);
    if (trimmed) parts.push(`"${trimmed}"`);
    return {
      productKey: spec.key,            // "blanket-full-alphabet"
      name: productName,
      price: spec.price,
      size: buy.sizeLabel ?? null,
      customImage: product.coverImage ?? spec.image ?? null,
      customImageName: null,
      subtitleOverride: parts.join(" · "),
      customMetadata: {
        production: "hand_knit_full_alphabet",
        body_color_name: body?.label ?? null,
        body_color_hex: body?.swatch?.color ?? body?.swatch?.dual?.[0] ?? null,
        personalized_name: trimmed || null,
      },
    };
  };

  const fire = (e, handler) => {
    const now = Date.now();
    if (adding || now - lastAddTsRef.current < 600) return;
    if (!body) return;
    lastAddTsRef.current = now;
    setAdding(true);
    window.setTimeout(() => setAdding(false), 600);
    if (e?.currentTarget && onCartFeedback) {
      const r = e.currentTarget.getBoundingClientRect();
      onCartFeedback(r.left + r.width / 2, r.top + r.height / 2);
    }
    handler(buildPayload());
  };

  return (
    <div className="fade-in max-w-6xl mx-auto px-6 lg:px-12 py-8 lg:py-12">
      <Breadcrumbs trail={trail} />

      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        <div className="min-w-0 w-full">
          <ProductImageGallery images={product.images} alt={productName} colorways={colorways} appleColorRow onColorwayChange={setBody} />
        </div>

        <div className="min-w-0 w-full">
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: "var(--accent)" }}>
            {t("pdp.madeToOrderEyebrow")}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl mb-3 leading-tight break-words" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
            {productName}
          </h1>
          {product.tagline && (
            <p className="text-base opacity-70 mb-6">{loc(product, "tagline", lang)}</p>
          )}

          <div className="flex items-baseline gap-3 mb-2">
            <p className="text-3xl tabular-nums" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
              ${spec.price}
            </p>
          </div>

          <ProductVariationNote className="mb-6 mt-2" />

          {description && (
            <ExpandableText text={description} clampLines={2} className="mb-8" />
          )}

          {/* SOLD OUT — replaces the body-color / name / buy controls. */}
          {soldOut && (
            <SoldOutPanel name={productName} productKey={notifyKey ?? spec.key} className="mb-8" />
          )}

          {/* Body color is chosen via the Apple-style color row under the
              gallery (name left, circles right) — see ProductImageGallery. */}

          {/* OPTIONAL NAME */}
          {!soldOut && buy.allowName && (
            <div className="mb-6">
              <label className="text-[0.6rem] tracking-[0.3em] uppercase opacity-70 block mb-2">
                {t("cribBlanket.nameLabel")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={nameMax}
                autoCapitalize="words"
                spellCheck={false}
                placeholder={t("cribBlanket.namePlaceholder")}
                className="w-full px-3 py-2.5 text-sm"
                style={{
                  border: "1px solid var(--border-strong)",
                  background: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  fontFamily: "Fraunces, serif",
                }}
                aria-label={t("cribBlanket.nameLabel")}
              />
              <p className="text-[0.65rem] opacity-60 mt-1.5">{t("cribBlanket.nameHint")}</p>
            </div>
          )}

          {/* DETAILS · SIZE · CARE — collapsed by default (native
              <details> accordion) so the buy button stays high. */}
          {details.length > 0 && (
            <details className="border-t border-b mb-8 group" style={{ borderColor: "rgba(26,22,18,0.1)" }}>
              <summary className="py-5 flex items-center justify-between cursor-pointer list-none">
                <span className="text-xs tracking-[0.2em] uppercase opacity-70" style={{ color: "var(--accent)" }}>
                  {t("placeholder.detailsHeading")}
                </span>
                <Plus size={16} strokeWidth={1.5} className="open-icon opacity-60" />
              </summary>
              <dl className="space-y-3 pb-5">
                {details.map((row) => (
                  <div key={row.label} className="grid grid-cols-[7rem_1fr] gap-3 items-baseline">
                    <dt className="text-[0.65rem] tracking-[0.2em] uppercase opacity-60" style={{ fontWeight: 500 }}>{row.label}</dt>
                    <dd className="text-sm leading-relaxed opacity-90">{cleanText(row.value)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}

          {!soldOut && (<>
          {/* FINAL SALE */}
          <div className="mb-4 p-2.5 text-[0.7rem] leading-snug flex items-start gap-2" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-strong)" }}>
            <span style={{ color: "var(--accent)", fontWeight: 600, letterSpacing: "0.05em" }}>{t("bib.finalSale")}</span>
            <span className="opacity-80">
              {t("pdp.finalSaleBody")}{" "}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("openPolicy", { detail: "finalSale" }))}
                className="underline hover:opacity-60"
                style={{ color: "var(--accent)" }}
              >
                {t("bib.readPolicy")}
              </button>.
            </span>
          </div>

          <PurchaseCard>
            <button
              ref={addBtnRef}
              onClick={(e) => fire(e, onAddCustom)}
              disabled={adding}
              aria-busy={adding}
              className="w-full py-4 text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition"
              style={{
                background: "var(--ink)", color: "var(--text-on-ink)",
                cursor: adding ? "wait" : "pointer", opacity: adding ? 0.6 : 1,
              }}
            >
              {t("common.addToCart")} — ${spec.price} <ArrowRight size={14} strokeWidth={1.5} />
            </button>

            {onBuyNow && (
              <button
                onClick={(e) => fire(e, onBuyNow)}
                disabled={adding}
                aria-busy={adding}
                className="w-full py-4 text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition"
                style={{
                  background: "transparent", color: "var(--text-primary)",
                  border: "1px solid var(--ink)",
                  cursor: adding ? "wait" : "pointer", opacity: adding ? 0.6 : 1,
                }}
              >
                {t("bib.buyNow")}
              </button>
            )}
          </PurchaseCard>
          </>)}
        </div>
      </div>

      {/* Mobile sticky Add-to-Bag — appears while the in-page button is
          scrolled out of view, hides when it's back. */}
      <StickyMobileBuyBar
        visible={!soldOut && !addBtnInView}
        label={t("common.addToCart")}
        price={spec.price}
        onClick={(e) => fire(e, onAddCustom)}
      />
    </div>
  );
}
