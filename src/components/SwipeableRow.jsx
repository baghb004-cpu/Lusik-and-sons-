// ============================================================
// SwipeableRow — gesture wrapper for cart-row left-swipe-to-delete
// ============================================================
// Wraps a cart row. On touch devices, a leftward drag past
// CONFIG.SWIPE.DELETE_THRESHOLD_PX commits a delete via the
// `onSwipeDelete` callback (which the parent uses to call
// removeFromCart + show an undo toast).
//
// Gesture machine highlights:
//   - Axis claim: doesn't decide between horizontal/vertical
//     intent until movement exceeds CLAIM_DIST_PX; before that
//     a tap doesn't get misclassified as a tiny drag.
//   - Reduced-motion: when `prefers-reduced-motion` is set,
//     bypasses entirely and renders children as a fragment.
//   - Multi-touch: a second finger landing cancels the gesture
//     (prevents pinch-zoom from being read as a delete).
//   - touchAction: pan-y on the inner div tells the browser
//     "I handle horizontal scrolling; you keep the vertical."
//
// MIRRORED FROM index.html (~line 5042). Tunables live in
// CONFIG.SWIPE.
// ============================================================

import React, { useState, useRef } from "react";
import { CONFIG } from "../data/config.js";

export function SwipeableRow({ onSwipeDelete, children }) {
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState(false);
  const startRef = useRef(null);
  const intentRef = useRef(null); // null | "horizontal" | "vertical"

  const reducedMotion = typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return <>{children}</>;

  const DELETE_THRESHOLD = -CONFIG.SWIPE.DELETE_THRESHOLD_PX; // sign is negative since rows swipe leftward
  const CLAIM_DIST       = CONFIG.SWIPE.CLAIM_DIST_PX;

  const onTouchStart = (e) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
    intentRef.current = null;
    setAnimating(false);
  };

  const onTouchMove = (e) => {
    if (!startRef.current) return;
    // Bail on multi-touch (a pinch starts as touches[0] but adding a
    // second finger should not continue counting as a swipe).
    if (e.touches.length > 1) {
      cancelGesture();
      return;
    }
    const t = e.touches[0];
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;

    if (intentRef.current === null) {
      if (Math.abs(dx) < CLAIM_DIST && Math.abs(dy) < CLAIM_DIST) return;
      intentRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
    }
    if (intentRef.current !== "horizontal") return;

    // Only allow leftward drag (rightward would reveal nothing).
    setDragX(Math.min(0, dx));
  };

  // Spring back to rest without committing. Used both for a normal
  // release that didn't pass threshold AND for interrupted gestures
  // (touchcancel from a system event, multi-touch promotion to pinch).
  const cancelGesture = () => {
    setAnimating(true);
    setDragX(0);
    startRef.current = null;
    intentRef.current = null;
  };

  const onTouchEnd = () => {
    if (intentRef.current === "horizontal") {
      setAnimating(true);
      if (dragX < DELETE_THRESHOLD) {
        // Animate the row off-screen, then call the delete handler. The
        // existing toast() infrastructure in App handles the undo.
        setDragX(-9999);
        setTimeout(() => onSwipeDelete?.(), CONFIG.SWIPE.COMMIT_ANIM_MS);
      } else {
        setDragX(0);
      }
    }
    startRef.current = null;
    intentRef.current = null;
  };

  return (
    <div className="relative overflow-hidden">
      {/* Red delete backdrop — fades in proportionally with the drag */}
      <div
        className="absolute inset-0 flex items-center justify-end pr-6 pointer-events-none"
        style={{
          background: "#8B2C2C",
          opacity: dragX < 0 ? Math.min(1, Math.abs(dragX) / 80) : 0,
        }}
        aria-hidden="true"
      >
        <span className="text-xs tracking-[0.2em] uppercase" style={{ color: "#F5EFE3", fontWeight: 500 }}>
          Delete
        </span>
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={cancelGesture}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: animating ? "transform 0.18s ease-out" : "none",
          background: "var(--bg-page)",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}
