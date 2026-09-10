"use client";

// ============================================================
// COMPARE SLIDER — the render, and a piece Lusik actually made
// ============================================================
// SITE_OVERHAUL_HANDOFF.md PR 8: "the compare slider (stage versus the
// closest real photo, using the existing ProductImageGallery photos)".
//
// It exists to answer the question a 3D preview raises and cannot answer
// on its own: is that what it really looks like? Wiping between the
// render and a photograph of a finished piece answers it in about a
// second, and it answers honestly — if the render flatters the product,
// this is where a customer finds out, which is the point.
//
// Off by default. The stage underneath is draggable, and a permanent
// handle sitting on top of it would fight that; a customer who wants the
// comparison asks for it. When it is on, the photograph covers the right
// of the frame and the wipe is driven by a real range input, so it works
// with a keyboard and reads correctly to a screen reader without any
// aria invention.
//
// The canvas is never touched: the photograph is an overlay with a
// clip-path. Clipping a live WebGL canvas would mean resizing its
// drawing buffer as the slider moves.
// ============================================================

import React, { useId, useState } from "react";
import { useT } from "../../i18n/LangContext.jsx";
import { galleryRotationStyle } from "../../lib/galleryRotation";

/**
 * @param {object} props
 * @param {React.ReactNode} props.children the stage (or its fallback)
 * @param {string | null} props.photo      the photograph to wipe to
 * @param {number} [props.photoIndex]      its index in the gallery, for the rotation band-aid
 * @param {React.ReactNode} [props.controls] other "how to look at it" controls,
 *   rendered in the same row as the compare toggle so the two do not end up
 *   in separate places on the page saying similar things
 * @param {string} [props.className]
 */
export function CompareSlider({ children, photo, photoIndex = 0, controls = null, className = "" }) {
  const t = useT();
  const [on, setOn] = useState(false);
  const [split, setSplit] = useState(50);
  const sliderId = useId();

  // Nothing to compare against. The stage stands on its own rather than
  // offering a control that would reveal an empty frame — but the other
  // controls still belong on the page.
  if (!photo) {
    return (
      <div className={className}>
        {children}
        {controls && <div className="mt-3">{controls}</div>}
      </div>
    );
  }

  return (
    <div className={className}>
      <div style={{ position: "relative" }}>
        {children}

        {on && (
          <>
            {/* The photograph, clipped from the left. aria-hidden because
                the slider below already names what is being compared, and
                a screen reader meeting the same photo twice on the page
                (the gallery has it too) learns nothing new. */}
            <img
              src={photo}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{
                clipPath: `inset(0 0 0 ${split}%)`,
                ...galleryRotationStyle(photoIndex),
              }}
            />
            {/* The seam. Decorative: the input below is the control. */}
            <div
              aria-hidden="true"
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{ left: `${split}%`, width: 2, background: "var(--bg-page)", boxShadow: "0 0 0 1px rgba(26,22,18,0.35)" }}
            />
            <span
              aria-hidden="true"
              className="absolute top-2 right-2 px-2 py-1 text-[0.55rem] tracking-[0.15em] uppercase pointer-events-none"
              style={{ background: "rgba(26,22,18,0.7)", color: "#F5EFE3" }}
            >
              {t("compare.photoBadge")}
            </span>
            <span
              aria-hidden="true"
              className="absolute top-2 left-2 px-2 py-1 text-[0.55rem] tracking-[0.15em] uppercase pointer-events-none"
              style={{ background: "rgba(26,22,18,0.7)", color: "#F5EFE3" }}
            >
              {t("compare.renderBadge")}
            </span>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {controls}
        <button
          type="button"
          onClick={() => setOn((v) => !v)}
          aria-pressed={on}
          className="px-3 py-1.5 text-[0.65rem] tracking-[0.15em] uppercase transition"
          style={{
            background: on ? "var(--ink)" : "transparent",
            color: on ? "var(--text-on-ink)" : "var(--text-primary)",
            border: `1px solid ${on ? "var(--ink)" : "var(--border-strong)"}`,
          }}
        >
          {t("compare.toggle")}
        </button>

      </div>

      {on && (
          <div className="mt-3">
            <label htmlFor={sliderId} className="block text-[0.6rem] tracking-[0.25em] uppercase mb-1.5" style={{ color: "var(--text-muted)" }}>
              {t("compare.sliderLabel")}
            </label>
            <input
              id={sliderId}
              type="range"
              min={0}
              max={100}
              step={1}
              value={split}
              onChange={(e) => setSplit(Number(e.target.value))}
              className="w-full"
              aria-valuetext={t("compare.valueText", { percent: split })}
            />
            <p className="text-[0.65rem] mt-1.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {t("compare.caption")}
            </p>
          </div>
      )}
    </div>
  );
}
