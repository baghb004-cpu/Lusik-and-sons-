// ============================================================
// CustomProductCard — bib customizer
// ============================================================
// Picker for the personalized bib: name input, color preset
// selector, single-color override. Builds the cart entry shape
// the server-side trusted-products map expects ('bib').
//
// MIRRORED FROM index.html (~line 9480).
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import { ProductTemplate } from "./ProductTemplate.jsx";
import { ArrowRight } from "./icons.jsx";
import { PHOTO_BIB_ROMEO, PHOTO_BIB_STACK } from "../images/photos.js";
import { PRODUCT } from "../data/product.js";

export function CustomProductCard({ config, onAddCustom, onCartFeedback }) {
  const [customName, setCustomName] = useState("");
  const [size, setSize] = useState("");
  const [error, setError] = useState("");

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

  const handleAdd = (e) => {
    const now = Date.now();
    if (adding || now - lastAddTsRef.current < 600) return;
    if (!size) { setError("Please choose a size."); return; }
    if (cleanName.length === 0) { setError("Please type a name to embroider."); return; }
    if (cleanName.length > maxNameLength) { setError(`Name must be ${maxNameLength} letters or fewer — the bib is small.`); return; }
    lastAddTsRef.current = now;
    setAdding(true);
    window.setTimeout(() => setAdding(false), 600);

    if (e?.currentTarget && onCartFeedback) {
      const r = e.currentTarget.getBoundingClientRect();
      onCartFeedback(r.left + r.width / 2, r.top + r.height / 2);
    }

    // Build a friendly color description for the cart subtitle and
    // record canonical color metadata for Lusik's order record.
    const isMulti = Array.isArray(letterColorList) && letterColorList.length > 0;
    const colorDesc = !supportsColor
      ? ""
      : isMulti
        ? ` · ${letterColorList.map(c => c.name).join("/")}`
        : ` · ${letterColor?.name ?? ""}`;
    onAddCustom({
      productKey: config.key,
      name: config.name,
      price: config.price,
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
    });

    // Reset for next custom order
    setCustomName("");
    setSize("");
    setError("");
  };

  return (
    <div className="flex flex-col h-full lg:grid lg:grid-cols-2 lg:items-start lg:h-auto" style={{ background: "var(--bg-page)", border: "1px solid var(--border-default)" }}>
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
            Shows a real "Romeo" bib so the first impression is an actual
            embroidered piece, not a schematic SVG. */}
        {cleanName.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 pointer-events-none">
            <div className="w-28 lg:w-32 aspect-square overflow-hidden mb-3 shadow-sm" style={{ border: "1px solid rgba(26,22,18,0.08)" }}>
              <img
                src={PHOTO_BIB_ROMEO}
                alt="Real example — a blue cursive 'Romeo' bib stitched by Lusik"
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="text-center">
              <p className="text-[0.6rem] tracking-[0.3em] uppercase opacity-50">Real example — 'Romeo'</p>
              <p className="text-xs opacity-50 mt-1 italic">Type a name to preview yours</p>
            </div>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-5 lg:p-6 flex flex-col flex-1 gap-4">
        <div>
          <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-2" style={{ color: "#B08842" }}>{config.tagline}</p>
          <h3 className="font-display text-2xl mb-1" style={{ fontWeight: 500 }}>{config.name}</h3>
          <p className="text-sm opacity-70 leading-relaxed">{config.description}</p>
          <p className="font-display text-xl mt-3" style={{ fontWeight: 500 }}>
            ${config.price}
          </p>
          <p className="text-[0.65rem] opacity-60 mt-1.5">
            Made to order · Cypress, CA
          </p>
        </div>

        {/* Personalized name input */}
        <div>
          <label className="text-[0.6rem] tracking-[0.3em] uppercase opacity-70 block mb-2">
            1. Personalized name
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
            placeholder="e.g. Anna"
            className="w-full px-3 py-2.5 text-sm"
            style={{
              border: "1px solid var(--border-strong)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              fontFamily: "Fraunces, serif",
            }}
            aria-label="Personalized name to embroider"
          />
          <p className="text-[0.65rem] opacity-60 mt-1.5">
            Up to {maxNameLength} letters · {cleanName.length}/{maxNameLength}
          </p>
          <p className="text-[0.6rem] opacity-50 italic mt-1">
            Preview only — actual embroidery font may differ slightly.
          </p>
        </div>

        {/* BIB COLOR PICKER — preset/custom toggle, curated palette, Lusik's
            named presets, multi-color Armenian Flag option. Compact because
            the bib is a $22 item — color matters but shouldn't dominate. */}
        {supportsColor && (
          <div>
            <label className="text-[0.6rem] tracking-[0.3em] uppercase opacity-70 block mb-2">
              2. Thread color
            </label>

            {/* Real-thread reference strip — a stack of finished bibs in every
                preset color, so the customer can see what Lusik's actual
                threads look like before they commit to a swatch. The
                pomegranate-cream backdrop of the photo keeps it visually
                consistent with the site's warm palette. */}
            <div className="mb-3 flex items-center gap-3">
              <div className="w-20 h-20 flex-shrink-0 overflow-hidden" style={{ border: "1px solid rgba(26,22,18,0.1)" }}>
                <img
                  src={PHOTO_BIB_STACK}
                  alt="A stack of Lusik's bibs showing the full range of thread colors"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <p className="text-[0.65rem] opacity-65 leading-snug italic">
                Lusik's real thread range — each color below is one she has on the spool. Slight variation between bibs is part of how each one is made.
              </p>
            </div>

            {/* Mode toggle: Presets vs Custom */}
            <div className="flex gap-2 mb-3 text-xs">
              <button
                type="button"
                onClick={() => setColorMode("preset")}
                className="px-3 py-1.5 transition"
                style={{
                  background: colorMode === "preset" ? "#1A1612" : "transparent",
                  color: colorMode === "preset" ? "#F5EFE3" : "#1A1612",
                  border: "1px solid rgba(26,22,18,0.2)",
                }}
              >
                Lusik's Picks
              </button>
              <button
                type="button"
                onClick={() => setColorMode("custom")}
                className="px-3 py-1.5 transition"
                style={{
                  background: colorMode === "custom" ? "#1A1612" : "transparent",
                  color: colorMode === "custom" ? "#F5EFE3" : "#1A1612",
                  border: "1px solid rgba(26,22,18,0.2)",
                }}
              >
                Pick your own
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
                        background: selected ? "#1A1612" : "transparent",
                        color: selected ? "#F5EFE3" : "#1A1612",
                        border: `1px solid ${selected ? "#1A1612" : "rgba(26,22,18,0.2)"}`,
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
                <p className="text-[0.65rem] opacity-50 mt-1.5">
                  Selected: <span style={{ fontWeight: 500 }}>{letterColor?.name ?? "—"}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs" style={{ color: "#8B2C2C" }}>{error}</p>}

        {/* Size picker — name input is step 1, color (if present) is step 2,
            so size is step 2 or 3 accordingly. */}
        <div>
          <label className="text-[0.6rem] tracking-[0.3em] uppercase opacity-70 block mb-2">
            {supportsColor ? "3." : "2."} Choose a size
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {config.sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className="text-left px-3 py-2 text-xs transition"
                style={{
                  border: `1px solid ${size === s ? "#1A1612" : "rgba(26,22,18,0.12)"}`,
                  background: size === s ? "#1A1612" : "transparent",
                  color: size === s ? "#F5EFE3" : "#1A1612",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Final-sale reminder — same callout pattern used on the blanket
            PDP, sized down to fit the bib card. */}
        <div className="mt-auto p-2.5 text-[0.7rem] leading-snug flex items-start gap-2" style={{ background: "rgba(176,136,66,0.08)", border: "1px solid rgba(176,136,66,0.25)" }}>
          <span style={{ color: "#B08842", fontWeight: 600, letterSpacing: "0.05em" }}>FINAL SALE —</span>
          <span className="opacity-80">
            Embroidered specifically for you. No returns, exchanges, or refunds.{" "}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("openPolicy", { detail: "finalSale" }))}
              className="underline hover:opacity-60"
              style={{ color: "#B08842" }}
            >
              Read the full policy
            </button>.
          </span>
        </div>

        {/* Add to cart */}
        <button
          onClick={handleAdd}
          disabled={!canAdd || adding}
          aria-busy={adding}
          className="mt-2 w-full py-3 text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition"
          style={{
            background: canAdd ? "#1A1612" : "rgba(26,22,18,0.15)",
            color: canAdd ? "#F5EFE3" : "rgba(26,22,18,0.5)",
            cursor: canAdd && !adding ? "pointer" : (adding ? "wait" : "not-allowed"),
            opacity: adding ? 0.6 : 1,
          }}
        >
          Add to cart — ${config.price} <ArrowRight size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
