"use client";

// ============================================================
// CustomProductCard — bib customizer
// ============================================================
// Picker for the personalized bib: name input, color preset
// selector, single-color override. Builds the cart entry shape
// the server-side trusted-products map expects ('bib').
//
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import { ProductTemplate } from "./ProductTemplate.jsx";
import { ArrowRight } from "./icons.jsx";
import { ProductVariationNote } from "./ProductVariationNote.jsx";
import { ExpandableText } from "./ExpandableText.jsx";
import { SoldOutPanel } from "./shop/SoldOutPanel.jsx";
import { PurchaseCard } from "./shop/PurchaseCard.jsx";
import { MobilePurchaseBar } from "./shop/MobilePurchaseBar.jsx";
import { useT, useLang } from "../i18n/LangContext.jsx";
import { loc } from "../i18n/localize.js";
import { foundingPriceForKey } from "../lib/launchPromo.js";
import { FoundingPriceBadge } from "./FoundingPriceBadge.jsx";
// PHOTO_BIB_ROMEO + PHOTO_BIB_STACK imports removed -- the Romeo
// empty-state image and the thread-range reference strip were
// both removed at user request. They'll be replaced by a real
// photo slideshow on the bib product page in a follow-up PR.
import { PRODUCT } from "../data/product.js";

export function CustomProductCard({ config, onAddCustom, onBuyNow, onCartFeedback, soldOut = false, notifyKey, immersive = false }) {
  const t = useT();
  const { lang } = useLang();
  const [customName, setCustomName] = useState("");
  const [size, setSize] = useState("");
  const [error, setError] = useState("");

  // Launch-promo founding price (null when dormant/over). effectivePrice
  // is what the browser shows AND puts in the cart, so display + cart +
  // the server charge all agree.
  const foundingPrice = foundingPriceForKey(config.key, config.price);
  const effectivePrice = foundingPrice ?? config.price;

  // ============================================================
  // BIB COLOR PICKER STATE
  // ============================================================
  // The bib's name renders in a customer-chosen thread color. We
  // gracefully no-op the picker if a future product config omits
  // threadColors / colorPresets.
  const supportsColor = Array.isArray(config.threadColors) && config.threadColors.length > 0
    && Array.isArray(config.colorPresets) && config.colorPresets.length > 0;

  const defaultPreset = supportsColor
    ? (config.colorPresets.find(p => p.key === config.defaultPresetKey) ?? config.colorPresets[0])
    : null;

  // Resolve a thread-color entry by DMC code. Looks in the bib's own palette
  // first; falls back to the main blanket palette (PRODUCT.threadColors) so
  // Armenian Flag's red/blue/orange — which aren't in the bib's curated 8 —
  // can still be looked up.
  const resolveThreadColor = (dmcCode) => {
    if (!dmcCode) return null;
    return (config.threadColors?.find(c => c.dmc === dmcCode))
      ?? (PRODUCT.threadColors?.find(c => c.dmc === dmcCode))
      ?? null;
  };

  const initialLetterColor = supportsColor
    ? (resolveThreadColor(defaultPreset.letter) ?? config.threadColors[0])
    : null;
  const initialLetterColors = supportsColor && Array.isArray(defaultPreset.letterColors)
    ? defaultPreset.letterColors.map(resolveThreadColor).filter(Boolean)
    : null;

  const [letterColor, setLetterColor] = useState(initialLetterColor);
  const [letterColorList, setLetterColorList] = useState(initialLetterColors);
  const [colorMode, setColorMode] = useState("preset");        // "preset" | "custom"
  const [activePresetKey, setActivePresetKey] = useState(supportsColor ? defaultPreset.key : null);

  // Apply a preset: sets letter color + optionally a per-letter color list.
  const applyBibPreset = (preset) => {
    const single = resolveThreadColor(preset.letter);
    if (single) setLetterColor(single);
    if (Array.isArray(preset.letterColors)) {
      const resolved = preset.letterColors.map(resolveThreadColor).filter(Boolean);
      setLetterColorList(resolved);
    } else {
      setLetterColorList(null);
    }
    setActivePresetKey(preset.key);
    setColorMode("preset");
  };

  // Manual color pick drops the preset + any multi-color list.
  const setBibCustomColor = (c) => {
    setLetterColor(c);
    setLetterColorList(null);
    setActivePresetKey(null);
    setColorMode("custom");
  };

  const maxNameLength = config.maxNameLength ?? 6;
  const cleanName = customName.trim();
  const canAdd = !!size && cleanName.length > 0 && cleanName.length <= maxNameLength;

  // Double-tap guard — same shape as ProductShowcase's add-to-cart.
  // A frustrated double-tap on a slow phone would otherwise stack qty=2.
  const lastAddTsRef = useRef(0);
  const [adding, setAdding] = useState(false);

  // Validate the bib config, setting an inline error and returning false on
  // failure. Shared by Add-to-Bag and express Buy-it-now.
  const validateBib = () => {
    if (!size) { setError(t("bib.errSize")); return false; }
    if (cleanName.length === 0) { setError(t("bib.errName")); return false; }
    if (cleanName.length > maxNameLength) { setError(t("bib.errTooLong", { n: maxNameLength })); return false; }
    return true;
  };

  // Build the onAddCustom / onBuyNow payload (cart subtitle + canonical color
  // metadata for Lusik's order record). One source of truth for both paths.
  const buildBibPayload = () => {
    const isMulti = Array.isArray(letterColorList) && letterColorList.length > 0;
    const colorDesc = !supportsColor
      ? ""
      : isMulti
        ? ` · ${letterColorList.map(c => c.name).join("/")}`
        : ` · ${letterColor?.name ?? ""}`;
    return {
      productKey: config.key,
      // founding price during the launch promo, else normal (keeps the
      // cart + checkout summary in step with what the server charges)
      name: config.name,
      price: effectivePrice,
      size,
      customImage: null,
      customImageName: null,
      subtitleOverride: `"${cleanName}" · ${size}${colorDesc}`,
      customMetadata: {
        production: "machine_embroidery_name",
        personalized_name: cleanName,
        size,
        // Color metadata — null fields when no color picker exists, which
        // keeps order data clean for non-color products. For single-color
        // bibs the *_multi field is null; for Armenian Flag it lists the
        // ordered hex+name list of letter colors.
        thread_color_name: !isMulti && letterColor ? letterColor.name : null,
        thread_color_hex:  !isMulti && letterColor ? letterColor.hex  : null,
        thread_color_ref:  !isMulti && letterColor ? letterColor.dmc  : null,
        thread_colors_multi: isMulti
          ? letterColorList.map(c => `${c.name} (${c.hex})`).join(" | ")
          : null,
        color_preset_key: activePresetKey ?? null,
      },
    };
  };

  const handleAdd = (e) => {
    const now = Date.now();
    if (adding || now - lastAddTsRef.current < 600) return;
    if (!validateBib()) return;
    lastAddTsRef.current = now;
    setAdding(true);
    window.setTimeout(() => setAdding(false), 600);

    if (e?.currentTarget && onCartFeedback) {
      const r = e.currentTarget.getBoundingClientRect();
      onCartFeedback(r.left + r.width / 2, r.top + r.height / 2);
    }

    onAddCustom(buildBibPayload());

    // Reset for next custom order
    setCustomName("");
    setSize("");
    setError("");
  };

  // Express checkout — same validated payload, but routes straight to Stripe
  // instead of the bag (no cart-feedback burst since we navigate away).
  const handleBuyNow = () => {
    const now = Date.now();
    if (adding || now - lastAddTsRef.current < 600) return;
    if (!validateBib()) return;
    lastAddTsRef.current = now;
    setAdding(true);
    window.setTimeout(() => setAdding(false), 600);
    onBuyNow?.(buildBibPayload());
  };

  return (
    <div
      className={immersive ? "flex flex-col" : "flex flex-col h-full lg:grid lg:grid-cols-2 lg:items-start lg:h-auto"}
      style={immersive ? undefined : { background: "var(--bg-page)", border: "1px solid var(--border-default)" }}
    >
      {/* Preview area with template — sticks on lg+ so the bib stays in view
          while the customer scrolls through name / color / size below.
          `lg:top-24` clears the sticky nav (~80px) with breathing room. */}
      <div className="relative aspect-square overflow-hidden lg:sticky lg:top-24 lg:self-start" style={{ background: "linear-gradient(135deg, #FAF6EC 0%, #EFE7D6 100%)" }}>
        <ProductTemplate
          customName={customName}
          nameColor={supportsColor && !letterColorList ? letterColor?.hex : null}
          nameColors={supportsColor && letterColorList ? letterColorList.map(c => c.hex) : null}
        />
        {/* Empty-state placeholder — hides as soon as the customer types.
            Shows a simple "type a name to preview yours" hint over the
            faint bib template. The previous Romeo example photo was
            removed at user request (will be replaced by a real photo
            slideshow elsewhere on the page in a follow-up). */}
        {cleanName.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 pointer-events-none">
            <div className="text-center">
              <p className="text-xs opacity-70 italic">{t("bib.previewHint")}</p>
            </div>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-5 lg:p-6 flex flex-col flex-1 gap-4">
        <div>
          <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-2" style={{ color: "var(--accent-text)" }}>{loc(config, "tagline", lang)}</p>
          <h3 className="font-display text-2xl mb-1" style={{ fontWeight: 500 }}>{loc(config, "name", lang)}</h3>
          <ExpandableText text={config.description} clampLines={2} textClassName="text-sm opacity-70 leading-relaxed" />
          <p className="font-display text-xl mt-3 flex items-baseline flex-wrap gap-x-2.5 gap-y-1" style={{ fontWeight: 500 }}>
            {foundingPrice != null && (
              <span className="line-through" style={{ fontWeight: 400, color: "var(--text-muted, rgba(26,22,18,0.45))" }}>${config.price}</span>
            )}
            <span>${effectivePrice}</span>
            {foundingPrice != null && <FoundingPriceBadge className="self-center" />}
          </p>
          <p className="text-[0.65rem] opacity-70 mt-1.5">
            {t("pdp.madeToOrderEyebrow")}
          </p>
          {/* Photos are samples — bibs especially may use a different neck
              closure than older example photos show. */}
          <ProductVariationNote bib className="mt-4" />
        </div>

        {/* Personalized name input */}
        <div>
          <label className="text-[0.6rem] tracking-[0.3em] uppercase opacity-70 block mb-2">
            {t("bib.step1Name")}
          </label>
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            maxLength={maxNameLength}
            autoComplete="given-name"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t("bib.namePlaceholder")}
            className="w-full px-3 py-2.5 text-sm"
            style={{
              border: "1px solid var(--border-strong)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              fontFamily: "Fraunces, serif",
            }}
            aria-label={t("bib.nameAria")}
          />
          <p className="text-[0.65rem] opacity-70 mt-1.5">
            {t("bib.upToLetters", { n: maxNameLength, len: cleanName.length })}
          </p>
          <p className="text-[0.6rem] opacity-70 italic mt-1">
            {t("bib.previewOnly")}
          </p>
        </div>

        {/* BIB COLOR PICKER — preset/custom toggle, curated palette, Lusik's
            named presets, multi-color Armenian Flag option. Compact because
            the bib is a $22 item — color matters but shouldn't dominate. */}
        {supportsColor && (
          <div>
            <label className="text-[0.6rem] tracking-[0.3em] uppercase opacity-70 block mb-2">
              {t("bib.step2Color")}
            </label>

            {/* Mode toggle: Presets vs Custom */}
            <div className="flex gap-2 mb-3 text-xs">
              <button
                type="button"
                onClick={() => setColorMode("preset")}
                className="px-3 py-1.5 transition"
                style={{
                  background: colorMode === "preset" ? "var(--ink)" : "transparent",
                  color: colorMode === "preset" ? "var(--text-on-ink)" : "var(--text-primary)",
                  border: "1px solid var(--border-strong)",
                }}
              >
                {t("bib.lusiksPicks")}
              </button>
              <button
                type="button"
                onClick={() => setColorMode("custom")}
                className="px-3 py-1.5 transition"
                style={{
                  background: colorMode === "custom" ? "var(--ink)" : "transparent",
                  color: colorMode === "custom" ? "var(--text-on-ink)" : "var(--text-primary)",
                  border: "1px solid var(--border-strong)",
                }}
              >
                {t("bib.pickYourOwn")}
              </button>
            </div>

            {/* PRESETS MODE — five Lusik picks (Boys/Girls/Unisex/Purple/
                Armenian Flag). Each renders a tiny swatch with the customer's
                actual typed name (or "Aa" placeholder) in the preset's color
                so they can preview what their name will look like. */}
            {colorMode === "preset" && (
              <div className="grid grid-cols-2 gap-2">
                {config.colorPresets.map((preset) => {
                  const single = resolveThreadColor(preset.letter);
                  const multi = Array.isArray(preset.letterColors)
                    ? preset.letterColors.map(resolveThreadColor).filter(Boolean)
                    : null;
                  if (!single) return null;
                  const selected = activePresetKey === preset.key;
                  // Sample shown in the swatch — actual customer name if they
                  // typed one, otherwise a placeholder "Aa". Limits to 4 chars
                  // so it always fits inside the small swatch.
                  const sample = (customName.trim() || "Aa").slice(0, 4);
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => applyBibPreset(preset)}
                      className="text-left p-2 transition flex items-center gap-2"
                      style={{
                        background: selected ? "var(--ink)" : "transparent",
                        color: selected ? "var(--text-on-ink)" : "var(--text-primary)",
                        border: `1px solid ${selected ? "var(--ink)" : "var(--border-strong)"}`,
                      }}
                      title={preset.description}
                      aria-pressed={selected}
                    >
                      {/* Sample swatch — shows the name preview in the preset's color. */}
                      <div
                        className="flex items-center justify-center flex-shrink-0"
                        style={{
                          width: "30px", height: "30px",
                          background: "#FFFFFF",
                          border: "1px solid rgba(26,22,18,0.15)",
                          fontFamily: "Fraunces, serif",
                          fontSize: "0.7rem",
                          fontWeight: 500,
                          lineHeight: 1,
                          letterSpacing: "-0.5px",
                        }}
                      >
                        {multi ? (
                          // Per-letter colors: render each character in its own color.
                          sample.split("").map((ch, idx) => (
                            <span key={idx} style={{ color: multi[idx % multi.length].hex }}>{ch}</span>
                          ))
                        ) : (
                          <span style={{ color: single.hex }}>{sample}</span>
                        )}
                      </div>
                      <p className="text-[0.7rem] leading-tight flex-1 min-w-0" style={{ fontWeight: 500 }}>
                        {preset.label}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* CUSTOM MODE — flat row of 8 swatches, customer taps one. */}
            {colorMode === "custom" && (
              <div>
                <div className="flex flex-wrap gap-1.5">
                  {config.threadColors.map((c) => {
                    const selected = letterColor?.dmc === c.dmc;
                    return (
                      <button
                        key={c.dmc}
                        type="button"
                        onClick={() => setBibCustomColor(c)}
                        className="transition relative"
                        style={{
                          width: "28px", height: "28px",
                          background: c.hex,
                          border: selected ? "2px solid #1A1612" : "1px solid rgba(26,22,18,0.2)",
                          outline: selected ? "1px solid #F5EFE3" : "none",
                          outlineOffset: "-3px",
                        }}
                        aria-label={c.name}
                        aria-pressed={selected}
                        title={c.name}
                      />
                    );
                  })}
                </div>
                <p className="text-[0.65rem] opacity-70 mt-1.5">
                  {t("bib.selected")} <span style={{ fontWeight: 500 }}>{letterColor?.name ?? "—"}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs" style={{ color: "var(--error)" }}>{error}</p>}

        {/* Size picker — name input is step 1, color (if present) is step 2,
            so size is step 2 or 3 accordingly. */}
        <div>
          <label className="text-[0.6rem] tracking-[0.3em] uppercase opacity-70 block mb-2">
            {t("bib.chooseSize", { step: supportsColor ? "3." : "2." })}
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {config.sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className="text-left px-3 py-2 text-xs transition"
                style={{
                  border: `1px solid ${size === s ? "var(--ink)" : "var(--border-default)"}`,
                  background: size === s ? "var(--ink)" : "transparent",
                  color: size === s ? "var(--text-on-ink)" : "var(--text-primary)",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Final-sale reminder — same callout pattern used on the blanket
            PDP, sized down to fit the bib card. */}
        <div className="mt-auto p-2.5 text-[0.7rem] leading-snug flex items-start gap-2" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-strong)" }}>
          <span style={{ color: "var(--accent-text)", fontWeight: 600, letterSpacing: "0.05em" }}>{t("bib.finalSale")}</span>
          <span>
            {t("bib.finalSaleBody")}{" "}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("openPolicy", { detail: "finalSale" }))}
              className="underline hover:opacity-60"
              style={{ color: "var(--accent-text)" }}
            >
              {t("bib.readPolicy")}
            </button>.
          </span>
        </div>

        {soldOut ? (
          <SoldOutPanel name={loc(config, "name", lang)} productKey={notifyKey ?? config.key} className="mt-2" />
        ) : (<>
        {/* Add to Bag + Buy it now — inside the Apple-style purchase card
            (delivery & pickup details on top, buy buttons at the bottom) */}
        <PurchaseCard className={immersive ? "mt-2" : "hidden lg:block mt-2"}>
          <button
            onClick={handleAdd}
            disabled={!canAdd || adding}
            aria-busy={adding}
            className="w-full py-3 text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition"
            style={{
              background: canAdd ? "var(--ink)" : "var(--bg-subtle)",
              color: canAdd ? "var(--text-on-ink)" : "var(--text-muted)",
              cursor: canAdd && !adding ? "pointer" : (adding ? "wait" : "not-allowed"),
              opacity: adding ? 0.6 : 1,
            }}
          >
            {t("common.addToCart")} — ${effectivePrice} <ArrowRight size={14} strokeWidth={1.5} />
          </button>

          {/* Express checkout — straight to Stripe with this configured bib.
              Outlined secondary so the ink-filled Add to Bag stays primary. */}
          <button
            onClick={handleBuyNow}
            disabled={!canAdd || adding}
            aria-busy={adding}
            className="w-full py-3 text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition"
            style={{
              background: "transparent",
              color: canAdd ? "var(--text-primary)" : "var(--text-muted)",
              border: `1px solid ${canAdd ? "var(--ink)" : "var(--border-strong)"}`,
              cursor: canAdd && !adding ? "pointer" : (adding ? "wait" : "not-allowed"),
              opacity: adding ? 0.6 : 1,
            }}
          >
            {t("bib.buyNow")}
          </button>
        </PurchaseCard>
        </>)}
      </div>
      {/* Mobile buy sheet — persistent on mobile. Disabled until a name +
          size are chosen, mirroring the in-flow button. Suppressed in
          immersive mode (the immersive sheet is the buy surface there). */}
      {!soldOut && !immersive && (
        <MobilePurchaseBar
          visible
          disabled={!canAdd || adding}
          label={t("common.addToCart")}
          price={effectivePrice}
          onClick={handleAdd}
        />
      )}
    </div>
  );
}
