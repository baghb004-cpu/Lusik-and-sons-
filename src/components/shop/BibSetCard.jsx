"use client";

// ============================================================
// BibSetCard — live buy surface for the hand cross-stitched
// heritage bib sets (Days-of-the-Week, Anushig, Bari Akhorzhak,
// Hye Em Yes).
// ============================================================
// Gallery on the left, configurator on the right — same shape as
// the placeholder product page, but with a real buy panel:
//
//   * Thread color via the shared BibColorPicker (Custom Name Bib
//     mechanic), when spec.buy.colorPicker is true. Hye Em Yes has
//     no picker — the flag colors ARE the design.
//   * Optional matching cap (spec.buy.cap), which switches the
//     productKey to the `-with-cap` SKU so the SERVER charges the
//     higher trusted price. The browser only ever sends the safe
//     productKey + options, never a raw price.
//   * Bari's cap carries the baby's name/initial — revealed only
//     when the cap is added.
//
// Adds through onAddCustom → buildCustomCartItem, so the chosen
// options land in the bag, the Stripe line-item description, and
// the order metadata. No color swatch *filter* is passed to the
// gallery — that selector was intentionally removed.
// ============================================================

import React, { useState, useRef } from "react";
import { ProductImageGallery } from "../ProductImageGallery.jsx";
import { ProductVariationNote } from "../ProductVariationNote.jsx";
import { BibColorPicker } from "./BibColorPicker.jsx";
import { SoldOutPanel } from "./SoldOutPanel.jsx";
import { Breadcrumbs } from "./Breadcrumbs.jsx";
import { ArrowRight } from "../icons.jsx";
import { useT, useLang } from "../../i18n/LangContext.jsx";
import { loc } from "../../i18n/localize.js";

// Strip any "⚠️ TODO_LUSIK: ..." trailer before showing a detail
// value to a customer (defense-in-depth; live copy shouldn't carry one).
function cleanText(text) {
  if (!text) return "";
  return text.split(/\s*⚠️\s*TODO_LUSIK\s*:?/i)[0].trim().replace(/\s{2,}/g, " ");
}

export function BibSetCard({ product, spec, trail, onAddCustom, onBuyNow, onCartFeedback, soldOut = false, notifyKey }) {
  const t = useT();
  const { lang } = useLang();
  const buy = spec.buy ?? {};
  const cap = buy.cap ?? null;

  const productName = loc(product, "name", lang);
  const description = cleanText(product.description);
  const details = Array.isArray(product.details) ? product.details : [];

  // ── Selection state ─────────────────────────────────────
  const [colorMeta, setColorMeta] = useState(null);   // from BibColorPicker
  const [capSelected, setCapSelected] = useState(false);
  const [capName, setCapName] = useState("");

  const currentPrice = capSelected && cap ? cap.priceWithCap : spec.price;
  const currentKey = capSelected && cap ? cap.withKey : spec.key;
  const capNameMax = cap?.nameMax ?? 12;

  // Double-tap guard — same shape as CustomProductCard / ProductShowcase.
  const lastAddTsRef = useRef(0);
  const [adding, setAdding] = useState(false);

  // ── Payload (one source of truth for Add-to-Bag + Buy-it-now) ──
  const buildPayload = () => {
    const isMulti = Array.isArray(colorMeta?.letterColorList) && colorMeta.letterColorList.length > 0;
    const letterColor = colorMeta?.letterColor ?? null;
    const colorName = !buy.colorPicker
      ? null
      : isMulti
        ? colorMeta.letterColorList.map((c) => c.name).join("/")
        : (letterColor?.name ?? null);

    const trimmedCapName = capName.trim().slice(0, capNameMax);

    // Human-readable subtitle for the bag + Stripe description.
    const parts = [];
    if (buy.sizeLabel) parts.push(buy.sizeLabel);
    if (colorName) parts.push(colorName);
    if (cap && capSelected) {
      parts.push(t("bibSet.includesCap"));
      if (cap.nameInput && trimmedCapName) parts.push(`${t("bibSet.capNameLabel")}: "${trimmedCapName}"`);
    }
    const subtitleOverride = parts.join(" · ");

    return {
      productKey: currentKey,
      name: productName,
      price: currentPrice,
      size: buy.sizeLabel ?? null,
      customImage: product.coverImage ?? null,
      customImageName: null,
      subtitleOverride,
      customMetadata: {
        production: "hand_cross_stitch",
        set: buy.sizeLabel ?? null,
        thread_color_name: buy.colorPicker && !isMulti ? (letterColor?.name ?? null) : null,
        thread_color_hex:  buy.colorPicker && !isMulti ? (letterColor?.hex  ?? null) : null,
        thread_color_ref:  buy.colorPicker && !isMulti ? (letterColor?.dmc  ?? null) : null,
        thread_colors_multi: buy.colorPicker && isMulti
          ? colorMeta.letterColorList.map((c) => `${c.name} (${c.hex})`).join(" | ")
          : null,
        color_preset_key: buy.colorPicker ? (colorMeta?.activePresetKey ?? null) : null,
        cap_added: cap ? capSelected : false,
        cap_name: cap && capSelected && cap.nameInput && trimmedCapName ? trimmedCapName : null,
      },
    };
  };

  const fire = (e, handler) => {
    const now = Date.now();
    if (adding || now - lastAddTsRef.current < 600) return;
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
        {/* GALLERY — no colorway swatch filter (intentionally removed). */}
        <div className="min-w-0 w-full">
          <ProductImageGallery images={product.images} alt={productName} />
        </div>

        {/* CONFIGURATOR */}
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

          {/* Price — reflects the cap upcharge live. */}
          <div className="flex items-baseline gap-3 mb-2">
            <p className="text-3xl tabular-nums" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
              ${currentPrice}
            </p>
            {cap && capSelected && (
              <span className="text-xs opacity-60">{t("bibSet.includesCap")}</span>
            )}
          </div>

          <ProductVariationNote bib className="mb-6 mt-2" />

          {description && (
            <p className="text-base leading-relaxed mb-8 opacity-85">{description}</p>
          )}

          {/* SOLD OUT — replaces every buy control below with a warm
              "check back soon" + restock-notify panel. */}
          {soldOut && (
            <SoldOutPanel name={productName} productKey={notifyKey ?? spec.key} className="mb-8" />
          )}

          {/* ── THREAD COLOR (skipped for Hye Em Yes) ── */}
          {!soldOut && (buy.colorPicker ? (
            <div className="mb-6">
              <label className="text-[0.6rem] tracking-[0.3em] uppercase opacity-70 block mb-2">
                {t("bibSet.colorLabel")}
              </label>
              <BibColorPicker
                threadColors={buy.threadColors}
                colorPresets={buy.colorPresets}
                defaultPresetKey={buy.defaultPresetKey}
                sampleText="Աբգ"
                onChange={setColorMeta}
              />
            </div>
          ) : (
            <div className="mb-6 p-3 text-[0.8rem] leading-snug" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-strong)" }}>
              {t("bibSet.flagFixed")}
            </div>
          ))}

          {/* ── MATCHING CAP (when offered) ── */}
          {!soldOut && cap && (
            <div className="mb-6">
              <label className="text-[0.6rem] tracking-[0.3em] uppercase opacity-70 block mb-2">
                {t("bibSet.capHeading")}
              </label>
              <button
                type="button"
                onClick={() => setCapSelected((v) => !v)}
                aria-pressed={capSelected}
                className="w-full text-left px-4 py-3 text-sm flex items-center justify-between gap-3 transition"
                style={{
                  border: `1px solid ${capSelected ? "var(--ink)" : "var(--border-strong)"}`,
                  background: capSelected ? "var(--ink)" : "transparent",
                  color: capSelected ? "var(--text-on-ink)" : "var(--text-primary)",
                }}
              >
                <span>{t("bibSet.addCap")}</span>
                <span style={{ fontWeight: 500 }}>
                  {capSelected ? t("bibSet.capAdded") : t("bibSet.capUpcharge", { price: cap.upcharge })}
                </span>
              </button>

              {capSelected && cap.nameInput && (
                <div className="mt-3">
                  <label className="text-[0.6rem] tracking-[0.3em] uppercase opacity-70 block mb-2">
                    {t("bibSet.capNameLabel")}
                  </label>
                  <input
                    type="text"
                    value={capName}
                    onChange={(e) => setCapName(e.target.value)}
                    maxLength={capNameMax}
                    autoComplete="given-name"
                    autoCapitalize="words"
                    spellCheck={false}
                    placeholder={t("bibSet.capNamePlaceholder")}
                    className="w-full px-3 py-2.5 text-sm"
                    style={{
                      border: "1px solid var(--border-strong)",
                      background: "var(--bg-surface)",
                      color: "var(--text-primary)",
                      fontFamily: "Fraunces, serif",
                    }}
                    aria-label={t("bibSet.capNameLabel")}
                  />
                  <p className="text-[0.65rem] opacity-60 mt-1.5">{t("bibSet.capNameHint")}</p>
                </div>
              )}
            </div>
          )}

          {/* DETAILS */}
          {details.length > 0 && (
            <div className="mb-8 pt-6" style={{ borderTop: "1px solid rgba(26,22,18,0.10)" }}>
              <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-4" style={{ color: "var(--accent)", fontWeight: 600 }}>
                {t("placeholder.detailsHeading")}
              </p>
              <dl className="space-y-3">
                {details.map((row) => (
                  <div key={row.label} className="grid grid-cols-[7rem_1fr] gap-3 items-baseline">
                    <dt className="text-[0.65rem] tracking-[0.2em] uppercase opacity-60" style={{ fontWeight: 500 }}>{row.label}</dt>
                    <dd className="text-sm leading-relaxed opacity-90">{cleanText(row.value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {!soldOut && (<>
          {/* FINAL SALE note */}
          <div className="mb-4 p-2.5 text-[0.7rem] leading-snug flex items-start gap-2" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-strong)" }}>
            <span style={{ color: "var(--accent)", fontWeight: 600, letterSpacing: "0.05em" }}>{t("bib.finalSale")}</span>
            <span className="opacity-80">
              {t("bib.finalSaleBody")}{" "}
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

          {/* ADD TO BAG + BUY NOW */}
          <button
            onClick={(e) => fire(e, onAddCustom)}
            disabled={adding}
            aria-busy={adding}
            className="w-full py-4 text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition"
            style={{
              background: "var(--ink)", color: "var(--text-on-ink)",
              cursor: adding ? "wait" : "pointer", opacity: adding ? 0.6 : 1,
            }}
          >
            {t("common.addToCart")} — ${currentPrice} <ArrowRight size={14} strokeWidth={1.5} />
          </button>

          {onBuyNow && (
            <button
              onClick={(e) => fire(e, onBuyNow)}
              disabled={adding}
              aria-busy={adding}
              className="mt-2 w-full py-4 text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition"
              style={{
                background: "transparent", color: "var(--text-primary)",
                border: "1px solid var(--ink)",
                cursor: adding ? "wait" : "pointer", opacity: adding ? 0.6 : 1,
              }}
            >
              {t("bib.buyNow")}
            </button>
          )}
          </>)}
        </div>
      </div>
    </div>
  );
}
