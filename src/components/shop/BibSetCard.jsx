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
import { ExpandableText } from "../ExpandableText.jsx";
import { SoldOutPanel } from "./SoldOutPanel.jsx";
import { StickyMobileBuyBar } from "./StickyMobileBuyBar.jsx";
import { PurchaseCard } from "./PurchaseCard.jsx";
import { Breadcrumbs } from "./Breadcrumbs.jsx";
import { ArrowRight, Plus } from "../icons.jsx";
import { useInViewport } from "../../lib/useInViewport";
import { foundingPriceForKey } from "../../lib/launchPromo.js";
import { FoundingPriceBadge } from "../FoundingPriceBadge.jsx";
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
  // Color is chosen from the gallery's Apple color row (the photographed
  // colorways). Default to the first colorway; the gallery reports changes.
  const [colorway, setColorway] = useState(product.colorways?.[0] ?? null);
  const [capSelected, setCapSelected] = useState(false);
  const [capName, setCapName] = useState("");

  const currentPrice = capSelected && cap ? cap.priceWithCap : spec.price;
  const currentKey = capSelected && cap ? cap.withKey : spec.key;
  // Launch-promo founding price for the current variant (null when the
  // promo is dormant/over). effectivePrice is what the browser shows AND
  // puts in the cart, so display + cart + the server charge all agree.
  const foundingPrice = foundingPriceForKey(currentKey, currentPrice);
  const effectivePrice = foundingPrice ?? currentPrice;
  const capNameMax = cap?.nameMax ?? 12;

  // Double-tap guard — same shape as CustomProductCard / ProductShowcase.
  const lastAddTsRef = useRef(0);
  const [adding, setAdding] = useState(false);
  // Mobile sticky Add-to-Bag shows while the in-page button is off-screen.
  const [addBtnRef, addBtnInView] = useInViewport();

  // ── Payload (one source of truth for Add-to-Bag + Buy-it-now) ──
  const buildPayload = () => {
    const colorName = colorway?.label ?? null;
    const colorHex = colorway?.swatch?.color ?? colorway?.swatch?.dual?.[0] ?? null;

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
      price: effectivePrice,
      size: buy.sizeLabel ?? null,
      customImage: product.coverImage ?? null,
      customImageName: null,
      subtitleOverride,
      customMetadata: {
        production: "hand_cross_stitch",
        set: buy.sizeLabel ?? null,
        color_name: colorName,
        color_hex: colorHex,
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
        {/* GALLERY — Apple color row (name left, circles right) sits tight
            under the slideshow and drives both the photo and the order. */}
        <div className="min-w-0 w-full">
          <ProductImageGallery
            images={product.images}
            alt={productName}
            colorways={product.colorways}
            appleColorRow
            onColorwayChange={setColorway}
          />
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

          {/* Price — reflects the cap upcharge live, and the founding
              price during the launch promo (original struck + badge). */}
          <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1 mb-2">
            {foundingPrice != null && (
              <p className="text-2xl tabular-nums line-through" style={{ fontWeight: 400, color: "var(--text-muted, rgba(26,22,18,0.45))" }}>
                ${currentPrice}
              </p>
            )}
            <p className="text-3xl tabular-nums" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
              ${effectivePrice}
            </p>
            {foundingPrice != null && <FoundingPriceBadge className="self-center" />}
            {cap && capSelected && (
              <span className="text-xs opacity-60">{t("bibSet.includesCap")}</span>
            )}
          </div>

          <ProductVariationNote bib className="mb-6 mt-2" />

          {description && (
            <ExpandableText text={description} clampLines={2} className="mb-8" />
          )}

          {/* SOLD OUT — replaces every buy control below with a warm
              "check back soon" + restock-notify panel. */}
          {soldOut && (
            <SoldOutPanel name={productName} productKey={notifyKey ?? spec.key} className="mb-8" />
          )}

          {/* Color is chosen from the Apple color row under the gallery. */}

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

          {/* DETAILS · SIZE · CARE — collapsed by default (native
              <details> accordion, same pattern + rotate-on-open icon as
              the Alphabet Blanket) so the buy button stays high. */}
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

          {/* ADD TO BAG + BUY NOW — inside the Apple-style purchase card
              (delivery & pickup details on top, buy buttons at the bottom) */}
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
              {t("common.addToCart")} — ${effectivePrice} <ArrowRight size={14} strokeWidth={1.5} />
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
        price={effectivePrice}
        onClick={(e) => fire(e, onAddCustom)}
      />
    </div>
  );
}
