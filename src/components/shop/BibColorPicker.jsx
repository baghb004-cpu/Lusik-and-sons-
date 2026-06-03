"use client";

// ============================================================
// BibColorPicker — the Custom Name Bib's thread-color mechanic,
// reusable across the hand cross-stitched heritage bib sets.
// ============================================================
// Same two-mode picker the live bib uses (CustomProductCard):
//   * "Lusik's Picks"  — five named presets, each shown as a tiny
//                        swatch with a sample glyph in the preset's
//                        color (multi-color for Armenian Flag).
//   * "Pick your own"  — a flat row of the curated thread swatches.
//
// Self-contained: owns its selection state and reports the current
// choice up through onChange({ letterColor, letterColorList,
// activePresetKey, colorMode }). The parent stores the latest report
// and folds it into the add-to-cart payload. Kept presentationally
// identical to CustomProductCard so every bib feels like one system.
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import { useT } from "../../i18n/LangContext.jsx";
import { PRODUCT } from "../../data/product.js";

export function BibColorPicker({ threadColors, colorPresets, defaultPresetKey, sampleText, onChange }) {
  const t = useT();

  // Resolve a thread-color entry by DMC code — the bib's own palette
  // first, then the blanket palette so Armenian Flag's red/blue/orange
  // (not in the curated 8) still resolve.
  const resolveThreadColor = (dmc) => {
    if (!dmc) return null;
    return (threadColors?.find((c) => c.dmc === dmc))
      ?? (PRODUCT.threadColors?.find((c) => c.dmc === dmc))
      ?? null;
  };

  const defaultPreset =
    (colorPresets.find((p) => p.key === defaultPresetKey) ?? colorPresets[0]);

  const initialLetterColor = resolveThreadColor(defaultPreset.letter) ?? threadColors[0];
  const initialLetterColors = Array.isArray(defaultPreset.letterColors)
    ? defaultPreset.letterColors.map(resolveThreadColor).filter(Boolean)
    : null;

  const [letterColor, setLetterColor] = useState(initialLetterColor);
  const [letterColorList, setLetterColorList] = useState(initialLetterColors);
  const [colorMode, setColorMode] = useState("preset");
  const [activePresetKey, setActivePresetKey] = useState(defaultPreset.key);

  // Report selection up. Fires on mount (so the parent has a valid
  // default before the customer touches anything) and on each change.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    onChangeRef.current?.({ letterColor, letterColorList, activePresetKey, colorMode });
  }, [letterColor, letterColorList, activePresetKey, colorMode]);

  const applyPreset = (preset) => {
    const single = resolveThreadColor(preset.letter);
    if (single) setLetterColor(single);
    setLetterColorList(
      Array.isArray(preset.letterColors)
        ? preset.letterColors.map(resolveThreadColor).filter(Boolean)
        : null,
    );
    setActivePresetKey(preset.key);
    setColorMode("preset");
  };

  const pickCustom = (c) => {
    setLetterColor(c);
    setLetterColorList(null);
    setActivePresetKey(null);
    setColorMode("custom");
  };

  const sample = (String(sampleText || "").trim() || "Aa").slice(0, 4);

  return (
    <div>
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

      {colorMode === "preset" && (
        <div className="grid grid-cols-2 gap-2">
          {colorPresets.map((preset) => {
            const single = resolveThreadColor(preset.letter);
            const multi = Array.isArray(preset.letterColors)
              ? preset.letterColors.map(resolveThreadColor).filter(Boolean)
              : null;
            if (!single) return null;
            const selected = activePresetKey === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset)}
                className="text-left p-2 transition flex items-center gap-2"
                style={{
                  background: selected ? "var(--ink)" : "transparent",
                  color: selected ? "var(--text-on-ink)" : "var(--text-primary)",
                  border: `1px solid ${selected ? "var(--ink)" : "var(--border-strong)"}`,
                }}
                title={preset.description}
                aria-pressed={selected}
              >
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

      {colorMode === "custom" && (
        <div>
          <div className="flex flex-wrap gap-1.5">
            {threadColors.map((c) => {
              const selected = letterColor?.dmc === c.dmc;
              return (
                <button
                  key={c.dmc}
                  type="button"
                  onClick={() => pickCustom(c)}
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
            {t("bib.selected")} <span style={{ fontWeight: 500 }}>{letterColor?.name ?? "—"}</span>
          </p>
        </div>
      )}
    </div>
  );
}
