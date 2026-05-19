// ============================================================
// ProductImageSlideshow — reusable image slideshow for product pages
// ============================================================
// Used initially by the cotton-yarn-blanket placeholder page,
// designed to be reusable on any product page that has multiple
// photos. Same crossfade aesthetic as the home HeroSlideshow,
// scaled down for the product context:
//
//   - Auto-advance every 6 seconds (faster than the 7s hero —
//     these are smaller in the layout, the customer reads each
//     frame quicker)
//   - Crossfade between slides (1200ms — slightly snappier than
//     hero's 1500ms)
//   - Prev / Next arrows on left + right edges, vertically centered
//   - Pause / Play toggle at the bottom-right
//   - Counter "n / total" at the bottom-left so users have
//     orientation in a long slideshow (e.g. 61 cotton-yarn photos)
//   - Keyboard arrow keys (Left / Right) advance when focused
//   - Honors prefers-reduced-motion (static, first slide only)
//   - Pauses on hover (desktop convenience)
//
// All controls are real <button>s with aria labels. The slideshow
// container has role="region" + aria-label so screen readers
// announce it as a discrete piece of content.
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "./icons.jsx";

const SLIDE_DURATION_MS = 6000;
const FADE_DURATION_MS  = 1200;

export function ProductImageSlideshow({
  images,
  alt = "Product photo",
  aspectClass = "aspect-[4/5]",
  className = "",
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  // hoverPaused = transient hover-to-pause; userPaused = sticky
  // pause from the Pause button. Slideshow only advances when
  // BOTH are false + reduced-motion is off.
  const [hoverPaused, setHoverPaused] = useState(false);
  const [userPaused, setUserPaused]   = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const containerRef = useRef(null);
  const timerRef     = useRef(null);

  const count = images?.length ?? 0;

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

  // Auto-advance. Resets whenever activeIdx changes, so a manual
  // prev/next click gives the user a fresh 6s before the next
  // auto-flip.
  useEffect(() => {
    if (count < 2) return undefined;
    if (prefersReduced || hoverPaused || userPaused) return undefined;
    timerRef.current = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % count);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(timerRef.current);
  }, [count, prefersReduced, hoverPaused, userPaused, activeIdx]);

  // Preload the NEXT photo so the crossfade doesn't stutter.
  useEffect(() => {
    if (typeof window === "undefined" || count < 2) return;
    const nextIdx = (activeIdx + 1) % count;
    const img = new window.Image();
    img.src = images[nextIdx];
  }, [activeIdx, count, images]);

  const goPrev = () => setActiveIdx((p) => (p - 1 + count) % count);
  const goNext = () => setActiveIdx((p) => (p + 1) % count);
  const togglePause = () => setUserPaused((p) => !p);

  // Left / Right arrow keys when the slideshow container is
  // focused or has focus within. Avoids hijacking the keys when
  // the user is typing in a nearby input.
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

  if (count === 0) return null;

  const buttonStyle = {
    background: "rgba(245, 239, 227, 0.85)",
    border: "1px solid rgba(26, 22, 18, 0.15)",
    color: "#1A1612",
    opacity: 0.88,
    borderRadius: "999px",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="region"
      aria-label={`${alt} — ${count} photo${count === 1 ? "" : "s"}`}
      aria-roledescription="carousel"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      className={`relative ${aspectClass} overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${className}`}
      style={{
        background: "var(--bg-elevated, rgba(176,136,66,0.04))",
        // Keyboard focus ring color, only visible on focus-visible.
        // The native ring is too aggressive against the cream palette.
        outlineColor: "#B08842",
      }}
    >
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={i === activeIdx ? `${alt} (${i + 1} of ${count})` : ""}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: i === activeIdx ? 1 : 0,
            transition: prefersReduced ? "none" : `opacity ${FADE_DURATION_MS}ms ease-in-out`,
          }}
          loading={i === 0 ? "eager" : "lazy"}
          fetchPriority={i === 0 ? "high" : "low"}
          decoding="async"
          aria-hidden={i !== activeIdx}
        />
      ))}

      {/* Controls only render when there's actually something to
          page through. A single-image gallery renders just the
          image, no buttons / counter. */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous photo"
            className="absolute top-1/2 -translate-y-1/2 left-3 lg:left-4 w-11 h-11 flex items-center justify-center hover:opacity-100 focus-visible:opacity-100"
            style={buttonStyle}
          >
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next photo"
            className="absolute top-1/2 -translate-y-1/2 right-3 lg:right-4 w-11 h-11 flex items-center justify-center hover:opacity-100 focus-visible:opacity-100"
            style={buttonStyle}
          >
            <ChevronRight size={20} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={togglePause}
            aria-label={userPaused ? "Resume slideshow" : "Pause slideshow"}
            aria-pressed={userPaused}
            className="absolute bottom-3 right-3 lg:bottom-4 lg:right-4 w-11 h-11 flex items-center justify-center hover:opacity-100 focus-visible:opacity-100"
            style={buttonStyle}
          >
            {userPaused
              ? <Play size={18} strokeWidth={1.75} />
              : <Pause size={18} strokeWidth={1.75} />}
          </button>

          {/* Counter — helps users know how far they are in a long
              slideshow (the cotton yarn blanket has 61 photos).
              Bottom-left, opposite the pause button. */}
          <div
            className="absolute bottom-3 left-3 lg:bottom-4 lg:left-4 px-3 py-1 text-[0.65rem] tracking-[0.15em] uppercase pointer-events-none"
            style={{
              ...buttonStyle,
              opacity: 0.82,
              borderRadius: "999px",
              fontWeight: 500,
              letterSpacing: "0.08em",
            }}
            aria-live="polite"
          >
            {activeIdx + 1} / {count}
          </div>
        </>
      )}
    </div>
  );
}
