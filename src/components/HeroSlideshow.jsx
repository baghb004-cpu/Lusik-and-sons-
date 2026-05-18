// ============================================================
// HeroSlideshow — crossfade carousel of Lusik's work
// ============================================================
// Drop-in replacement for the static hero image. Auto-advances
// through 6 photos showing the range of Lusik's hand cross-stitch
// and machine embroidery work: full alphabet blankets, matching
// blanket+bib sets, days-of-the-week bib sets, framed home
// blessings, and cross-stitched baby hats.
//
// Design choices:
//   * Crossfade (opacity transition) rather than slide — quieter,
//     matches the Liquid Glass aesthetic of the rest of the site.
//   * 7000ms per slide, 1500ms crossfade duration. Slow enough to
//     read each photo, fast enough not to bore.
//   * No arrows, no dots — purely automatic per spec.
//   * Pause on hover (subtle UX kindness for desktop visitors).
//   * Respects prefers-reduced-motion — shows static first image
//     for users with accessibility setting enabled.
//   * First image eager-loaded, rest lazy + preloaded as they
//     come up, so the first paint is fast.
// ============================================================

import React, { useEffect, useRef, useState } from "react";

const HERO_PHOTOS = [
  {
    src: "/img/hero/01-full-alphabet-blanket.jpg",
    alt: "Full Armenian alphabet hand cross-stitched on a baby blanket by Lusik",
    // Source JPEG is sideways — letters read left-to-right when
    // the frame is rotated 90° counter-clockwise. Re-rotate on
    // display until the file itself is re-uploaded correctly.
    rotate: -90,
  },
  {
    src: "/img/hero/02-blanket-with-matching-bibs.jpg",
    alt: "Matching cross-stitched blanket and bib set by Lusik",
    // Source JPEG is sideways the OTHER way — needs 90° clockwise.
    rotate: 90,
  },
  {
    src: "/img/hero/03-bib-set-fan.jpg",
    alt: "Set of cross-stitched baby bibs arranged in a fan",
  },
  {
    src: "/img/hero/04-bib-cascade-pink-white.jpg",
    alt: "Pink and white hand-stitched bib set by Lusik",
  },
  {
    src: "/img/hero/05-framed-blessing.jpg",
    alt: "Framed Armenian home blessing cross-stitched by Lusik",
  },
  {
    src: "/img/hero/06-blue-baby-hat.jpg",
    alt: "Hand cross-stitched blue baby hat with Armenian alphabet trim",
  },
];

// Hero container is aspect-[4/3] (landscape). When an img is
// rotated 90° in either direction, the image's 4:3 rendered box
// becomes a 3:4 rectangle inside that container, leaving black
// gutters on the sides. Scaling by 4/3 ≈ 1.333 grows the rotated
// rectangle back out to fill the container — `object-cover` then
// crops the now-oversized image as needed.
const ROTATION_FILL_SCALE = 4 / 3;

const SLIDE_DURATION_MS = 7000;
const FADE_DURATION_MS = 1500;

export function HeroSlideshow({ className = "", style = {} }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const timerRef = useRef(null);

  // Detect prefers-reduced-motion and respect it.
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

  // Auto-advance timer. Skip entirely when paused or reduced-motion.
  useEffect(() => {
    if (prefersReduced || paused) return undefined;
    timerRef.current = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % HERO_PHOTOS.length);
    }, SLIDE_DURATION_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, prefersReduced]);

  // Preload the NEXT photo so the crossfade doesn't stutter.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextIdx = (activeIdx + 1) % HERO_PHOTOS.length;
    const img = new window.Image();
    img.src = HERO_PHOTOS[nextIdx].src;
  }, [activeIdx]);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={style}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Lusik's recent work"
    >
      {HERO_PHOTOS.map((photo, i) => {
        const needsRotation = photo.rotate === 90 || photo.rotate === -90;
        const transform = needsRotation
          ? `rotate(${photo.rotate}deg) scale(${ROTATION_FILL_SCALE})`
          : undefined;
        return (
          <img
            key={photo.src}
            src={photo.src}
            alt={photo.alt}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity: i === activeIdx ? 1 : 0,
              transition: prefersReduced ? "none" : `opacity ${FADE_DURATION_MS}ms ease-in-out`,
              ...(transform ? { transform, transformOrigin: "center center" } : {}),
            }}
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : "low"}
            decoding="async"
            aria-hidden={i !== activeIdx}
          />
        );
      })}
      {/* Soft Liquid-Glass bottom gradient — keeps the floating
          callout chip readable against any photo behind it. */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: "30%",
          background: "linear-gradient(180deg, rgba(245,239,227,0) 0%, rgba(245,239,227,0.18) 100%)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}
