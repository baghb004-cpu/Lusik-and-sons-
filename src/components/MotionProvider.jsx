"use client";

// ============================================================
// MotionProvider — the app-wide Framer Motion boundary
// ============================================================
// Two jobs, both global:
//
//   1. LazyMotion(domAnimation, strict) — loads ONLY the DOM
//      animation feature set (enter/exit, variants, springs,
//      tap/hover/focus gestures). This is the lightweight half of
//      Framer Motion (~the same weight class as a small animation
//      lib); the heavy drag/layout-projection features are NOT
//      bundled. `strict` makes the codebase use the tree-shakeable
//      `m.*` components — a plain `motion.*` import would throw, which
//      keeps the lazy feature contract honest. Surfaces that need
//      finger-tracking (the cart swipe, the bottom-nav drag) do their
//      own touch handling and animate motion values, so they don't
//      pull in the drag feature.
//
//   2. MotionConfig reducedMotion="user" — honors the OS
//      "Reduce Motion" setting everywhere at once: Framer drops
//      transform/position animation and keeps opacity, so components
//      don't each have to re-check the media query. The glass material
//      (CSS) has its own prefers-reduced-motion rules already.
// ============================================================

import { LazyMotion, domAnimation, MotionConfig } from "framer-motion";

export function MotionProvider({ children }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
