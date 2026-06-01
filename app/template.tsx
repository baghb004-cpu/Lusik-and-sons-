"use client";

// ============================================================
// template.tsx — per-navigation page transition
// ============================================================
// Next.js re-mounts a route's template on every navigation (unlike
// layout.tsx, which persists). That makes this the clean place for an
// ENTER animation: each page settles in with a small rise + fade while
// the chrome (nav, header, drawers in SiteChrome) stays put — the Apple
// "content moves, frame holds" feel.
//
// Enter-only by design: App Router has already swapped in the new page
// by the time navigation completes, so there's no reliable "old page" to
// animate out. A subtle, fast enter reads as premium without fighting the
// router. Reduced-motion is handled globally by MotionProvider's
// <MotionConfig reducedMotion="user"> (the rise is dropped, the fade
// stays), so this needs no media-query check of its own.
// ============================================================

import { m } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";
import { fadeRise } from "../src/lib/motion";

// Module-scoped: false during SSR and the very first client render, then true
// for the rest of the session. Resets on a full page load (fresh module).
let navigated = false;

export default function Template({ children }: { children: ReactNode }) {
  // First paint (SSR + hydration) renders at the visible target via
  // initial={false}, so content is never hidden behind JS and crawlers see it.
  // Only client-side navigations (subsequent template mounts) play the enter.
  const isFirstPaint = useRef(!navigated);
  useEffect(() => {
    navigated = true;
  }, []);

  return (
    <m.div
      initial={isFirstPaint.current ? false : "hidden"}
      animate="show"
      variants={fadeRise}
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </m.div>
  );
}
