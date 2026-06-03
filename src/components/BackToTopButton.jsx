"use client";

// ============================================================
// BackToTopButton — fixed-position scroll-to-top
// ============================================================
// Appears after ~600px of scroll (with hysteresis on hide so
// the button doesn't flicker at the boundary). Honors
// prefers-reduced-motion — auto-scrolls instantly instead of
// smoothly for users who've opted in.
//
// Passive scroll listener so the handler doesn't interfere
// with the browser's compositor pipeline on mobile.
//
// ============================================================

import React, { useState, useEffect } from "react";
import { ChevronUp } from "./icons.jsx";

export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // The scroll handler runs frequently — keep it cheap. No setState
    // unless the visibility ACTUALLY changes, otherwise React re-renders
    // on every scroll tick. The `?` comparison checks both directions:
    // becoming visible (scrollY > threshold + buffer) and becoming hidden
    // (scrollY < threshold - buffer), with a deadband between them to
    // avoid flicker at the boundary.
    const SHOW_THRESHOLD = 600;   // px — appear after roughly one screen
    const HIDE_THRESHOLD = 400;   // px — disappear with hysteresis

    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      setVisible((wasVisible) => {
        if (!wasVisible && y > SHOW_THRESHOLD) return true;
        if (wasVisible && y < HIDE_THRESHOLD) return false;
        return wasVisible;
      });
    };

    // Passive listener — tells the browser we won't preventDefault, so
    // scrolling stays fast on mobile. This matters for jank-free scrolling.
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();  // initialize state in case the page loaded already scrolled
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    // Respect users who've set "Reduce Motion" in their OS — smooth scroll
    // can cause motion sickness for some people. The media query check
    // returns true if the user has opted into reduced motion.
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`back-to-top ${visible ? "visible" : ""}`}
      aria-label="Back to top of page"
      title="Back to top"
    >
      <ChevronUp size={20} strokeWidth={1.75} />
    </button>
  );
}
