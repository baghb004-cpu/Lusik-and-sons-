// ============================================================
// Theater — tiny, static, decorative set pieces (zero JS weight)
// ============================================================
// Both components render fixed markup; every bit of motion lives in
// src/styles/index.css (the THEATER block) as CSS scroll-driven
// animation, gated behind @supports + prefers-reduced-motion. They
// are aria-hidden decoration — screen readers and reduced-motion
// guests lose nothing.

import React from "react";

// All 38 letters of the Armenian alphabet (Mashtots' 36 + the two
// medieval additions) — the same letters Lusik stitches. Two copies
// make the CSS translateX(-50%) loop seamless.
const ALPHABET = "Ա Բ Գ Դ Ե Զ Է Ը Թ Ժ Ի Լ Խ Ծ Կ Հ Ձ Ղ Ճ Մ Յ Ն Շ Ո Չ Պ Ջ Ռ Ս Վ Տ Ր Ց Ւ Փ Ք Օ Ֆ ";

export function AlphabetMarquee({ className = "" }) {
  return (
    <div className={`alpha-marquee ${className}`} aria-hidden="true">
      <div className="alpha-marquee-track">
        <span>{ALPHABET}</span>
        <span>{ALPHABET}</span>
      </div>
    </div>
  );
}

// A row of cross-stitch X's that draws itself in on scroll (the
// pathLength="1" normalization lets the CSS dash animation be a
// plain 1 → 0 regardless of the real geometry).
export function StitchDivider({ className = "", style }) {
  // Eleven stitches, 20px apart: each X is two 12px strokes.
  const xs = Array.from({ length: 11 }, (_, i) => i * 20);
  const d = xs.map((x) => `M${x} 12 l12 -12 M${x} 0 l12 12`).join(" ");
  return (
    <svg
      className={`stitch-divider ${className}`}
      style={style}
      viewBox="0 0 212 12"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} pathLength="1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
