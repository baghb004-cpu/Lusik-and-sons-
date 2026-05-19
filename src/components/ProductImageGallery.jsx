// ============================================================
// ProductImageGallery — carousel + optional color-picker filter
// ============================================================
// Replaces the previous ProductImageSlideshow. Two key changes:
//
//   1) Only ONE <img> is in the DOM at a time, keyed on src.
//      The previous version stacked all 61 images on top of
//      each other with opacity 0 on the inactive ones, which
//      tripped Chromium's lazy-load heuristic ("this image is
//      effectively invisible, don't bother fetching") and could
//      leave the gallery showing only slide 1 forever. With a
//      single rendered img, the browser just downloads the
//      current src on demand. We JS-preload neighbors so prev/
//      next feels instant.
//
//   2) Optional `colorways` prop renders a row of color swatch
//      buttons below the carousel. Clicking a swatch filters
//      the carousel to just that color's photos and jumps to
//      the first one. The arrow buttons cycle within the
//      filter; the counter shows "n of total in [color]".
//
// The hover-pause from the previous version is gone — it was
// firing on mobile touches and getting stuck in the paused
// state. The pause button alone is enough.
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "./icons.jsx";

const SLIDE_DURATION_MS = 6000;

export function ProductImageGallery({
  images,
  colorways,                 // optional
  alt = "Product photo",
  aspectClass = "aspect-[4/5]",
  className = "",
}) {
  // activeColorway: null = "All photos" mode; otherwise index into colorways[]
  const [activeColorway, setActiveColorway] = useState(null);
  // activeIdx is into the FILTERED list, not the raw images array.
  const [activeIdx, setActiveIdx] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const timerRef = useRef(null);
  const containerRef = useRef(null);

  // Compute the indices visible in the current filter. Memoized
  // because it's used to derive count and the current image src.
  const visibleIndices = useMemo(() => {
    if (activeColorway == null || !colorways) {
      return images.map((_, i) => i);
    }
    return colorways[activeColorway].indices;
  }, [activeColorway, colorways, images]);

  const count = visibleIndices.length;
  const safeIdx = activeIdx >= count ? 0 : activeIdx;
  const currentSrc = images[visibleIndices[safeIdx]];

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReduced(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else if (mq.addListener) mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else if (mq.removeListener) mq.removeListener(update);
    };
  }, []);

  // Auto-advance. Resets the 6s timer on every slide change so
  // a manual click gives the user a fresh window before the next
  // auto-flip.
  useEffect(() => {
    if (count < 2 || prefersReduced || userPaused) return undefined;
    timerRef.current = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % count);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(timerRef.current);
  }, [count, prefersReduced, userPaused, safeIdx]);

  // Preload the NEXT and PREVIOUS images in the current filter
  // so prev/next clicks are instant. We do this in JS rather
  // than via <img loading="eager"> tags so we don't have to
  // keep 61 invisible imgs in the DOM.
  useEffect(() => {
    if (typeof window === "undefined" || count < 2) return;
    const toPreload = new Set([
      visibleIndices[(safeIdx + 1) % count],
      visibleIndices[(safeIdx - 1 + count) % count],
      visibleIndices[(safeIdx + 2) % count],
    ]);
    toPreload.forEach((i) => {
      const img = new window.Image();
      img.src = images[i];
    });
  }, [safeIdx, count, visibleIndices, images]);

  // Keyboard navigation when the carousel has focus.
  useEffect(() => {
    const node = containerRef.current;
    if (!node || count < 2) return undefined;
    const onKey = (e) => {
      if (e.key === "ArrowLeft")  { e.preventDefault(); goPrev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
    };
    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  }, [count]);

  const goPrev = () => setActiveIdx((p) => (p - 1 + count) % count);
  const goNext = () => setActiveIdx((p) => (p + 1) % count);
  const togglePause = () => setUserPaused((p) => !p);
  const selectColorway = (idx) => {
    setActiveColorway(idx);
    setActiveIdx(0);
    // Resume playing when the user picks a filter — they're
    // engaged, they want the carousel moving again.
    setUserPaused(false);
  };

  if (!images || images.length === 0) return null;

  const buttonStyle = {
    background: "rgba(245, 239, 227, 0.92)",
    border: "1px solid rgba(26, 22, 18, 0.18)",
    color: "#1A1612",
    borderRadius: "999px",
    boxShadow: "0 2px 8px rgba(26, 22, 18, 0.18)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  };

  const activeLabel = activeColorway != null && colorways
    ? colorways[activeColorway].label
    : null;

  return (
    <div className={className}>
      {/* ============ Carousel ============ */}
      <div
        ref={containerRef}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${alt} — ${count} photo${count === 1 ? "" : "s"}${activeLabel ? ` in ${activeLabel}` : ""}`}
        className={`relative ${aspectClass} overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 lg-panel`}
        style={{
          background: "var(--bg-elevated, rgba(176,136,66,0.04))",
          outlineColor: "#B08842",
        }}
      >
        {/* The single visible image. `key` forces React to
            unmount the previous img and mount a new one on src
            change — the fade-in CSS class then animates the new
            one in from opacity 0. Honors reduced-motion by
            skipping the animation. */}
        <img
          key={currentSrc}
          src={currentSrc}
          alt={`${alt} (${safeIdx + 1} of ${count}${activeLabel ? `, ${activeLabel}` : ""})`}
          className={`absolute inset-0 w-full h-full object-cover ${prefersReduced ? "" : "fade-in"}`}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          draggable={false}
        />

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous photo"
              className="absolute top-1/2 -translate-y-1/2 left-3 lg:left-4 w-11 h-11 flex items-center justify-center"
              style={buttonStyle}
            >
              <ChevronLeft size={20} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next photo"
              className="absolute top-1/2 -translate-y-1/2 right-3 lg:right-4 w-11 h-11 flex items-center justify-center"
              style={buttonStyle}
            >
              <ChevronRight size={20} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={togglePause}
              aria-label={userPaused ? "Resume slideshow" : "Pause slideshow"}
              aria-pressed={userPaused}
              className="absolute bottom-3 right-3 lg:bottom-4 lg:right-4 w-11 h-11 flex items-center justify-center"
              style={buttonStyle}
            >
              {userPaused
                ? <Play size={18} strokeWidth={1.75} />
                : <Pause size={18} strokeWidth={1.75} />}
            </button>
            <div
              className="absolute bottom-3 left-3 lg:bottom-4 lg:left-4 px-3 py-1.5 text-[0.65rem] tracking-[0.15em] uppercase pointer-events-none"
              style={{ ...buttonStyle, fontWeight: 500 }}
              aria-live="polite"
            >
              {safeIdx + 1} / {count}{activeLabel && <span className="ml-1.5 opacity-60">· {activeLabel}</span>}
            </div>
          </>
        )}
      </div>

      {/* ============ Color picker ============ */}
      {colorways && colorways.length > 0 && (
        <div className="mt-5 lg:mt-6">
          <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-3" style={{ color: "#B08842", fontWeight: 600 }}>
            Choose a colorway
          </p>
          <div
            className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1"
            role="radiogroup"
            aria-label="Filter by color"
            style={{ scrollSnapType: "x mandatory" }}
          >
            <ColorSwatch
              label="All"
              swatch={{ gradient: ["#E8B5C7", "#BBA8D6", "#93B7D5", "#B5D9BC", "#E8D89B"] }}
              active={activeColorway == null}
              onClick={() => selectColorway(null)}
              count={images.length}
            />
            {colorways.map((cw, i) => (
              <ColorSwatch
                key={cw.label}
                label={cw.label}
                swatch={cw.swatch}
                active={activeColorway === i}
                onClick={() => selectColorway(i)}
                count={cw.indices.length}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ColorSwatch — one button in the color-picker row.
// Renders either a solid circle, a half-and-half dual, a conic
// gradient, or a neutral ring depending on the `swatch` shape.
// ============================================================
function ColorSwatch({ label, swatch, active, onClick, count }) {
  const baseClasses = "shrink-0 flex flex-col items-center gap-1.5 px-1 pt-1 transition-opacity";
  const opacity = active ? "opacity-100" : "opacity-70 hover:opacity-100";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={`${label}, ${count} photo${count === 1 ? "" : "s"}`}
      onClick={onClick}
      className={`${baseClasses} ${opacity}`}
      style={{ scrollSnapAlign: "start" }}
    >
      <span
        className="block"
        style={{
          width: 44,
          height: 44,
          borderRadius: "999px",
          border: active ? "2px solid #B08842" : "1px solid rgba(26,22,18,0.2)",
          boxShadow: active
            ? "0 0 0 3px rgba(176, 136, 66, 0.2)"
            : "inset 0 0 0 1px rgba(255, 255, 255, 0.4)",
          background: swatchBackground(swatch),
          transition: "box-shadow 0.18s ease, border-color 0.18s ease",
        }}
      />
      <span
        className="text-[0.65rem] tracking-[0.05em] whitespace-nowrap"
        style={{
          color: active ? "#1A1612" : "#3D332A",
          fontWeight: active ? 600 : 400,
        }}
      >
        {label}
      </span>
    </button>
  );
}

// Translates the swatch descriptor object into a CSS background.
function swatchBackground(swatch) {
  if (!swatch) return "#F5EFE3";
  if (swatch.color)    return swatch.color;
  if (swatch.dual)     return `linear-gradient(135deg, ${swatch.dual[0]} 0%, ${swatch.dual[0]} 50%, ${swatch.dual[1]} 50%, ${swatch.dual[1]} 100%)`;
  if (swatch.gradient) return `conic-gradient(from 90deg, ${swatch.gradient.join(", ")}, ${swatch.gradient[0]})`;
  if (swatch.neutral)  return "linear-gradient(135deg, #E8DFD0 0%, #D6C9B4 100%)";
  return "#F5EFE3";
}
