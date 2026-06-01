"use client";

// ============================================================
// SwipeableRow — gesture wrapper for cart-row swipe-to-reveal-Delete
// ============================================================
// Wraps a cart row. On touch devices, a leftward drag REVEALS a red
// "Delete" button — it does NOT delete on its own. The row snaps open
// (held), and the delete only commits when the customer taps the
// revealed Delete button. This mirrors the Apple Store / iOS Mail feel:
// a full swipe can't accidentally destroy a line item; deletion is
// always a deliberate second tap.
//
// Motion: the finger position and the snap-open/closed settle are a
// Framer Motion value (`x`) animated with a spring — that's the only
// thing Framer does here. The gesture DETECTION stays hand-rolled on
// touch events (axis-claim, multi-touch cancel, rubber-band, tap-to-
// close) because it's tuned for touch reliability; Framer just makes
// the release settle springy instead of a CSS ease.
//
// Gesture machine highlights:
//   - Axis claim: doesn't decide between horizontal/vertical intent
//     until movement exceeds CLAIM_DIST_PX; before that a tap doesn't
//     get misclassified as a tiny drag.
//   - Snap, don't commit: on release we spring to OPEN (revealing the
//     button) or CLOSED based on DELETE_THRESHOLD_PX. The off-screen
//     slide + onSwipeDelete callback only fire from the Delete tap.
//   - Tap-to-close: while open, tapping the row content (or swiping
//     back right) closes it instead of activating the row.
//   - Reduced-motion: when `prefers-reduced-motion` is set, bypasses
//     entirely and renders children as a fragment.
//   - Multi-touch: a second finger landing cancels the gesture
//     (prevents pinch-zoom from being read as a swipe).
//   - touchAction: pan-y on the inner div tells the browser "I handle
//     horizontal swiping; you keep the vertical scroll."
//
// Tunables live in CONFIG.SWIPE.
// ============================================================

import React, { useRef, useState } from "react";
import { m, useMotionValue, animate, useReducedMotion } from "framer-motion";
import { CONFIG } from "../data/config.js";
import { springSnappy, EASE_OUT } from "../lib/motion";

export function SwipeableRow({ onSwipeDelete, children }) {
  // Hooks first, unconditionally — the reduced-motion bypass returns AFTER
  // them so hook order stays stable if the OS setting flips at runtime.
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const [open, setOpen] = useState(false);
  const startRef = useRef(null);
  const baseRef = useRef(0);        // offset the gesture started from (0 closed, -REVEAL open)
  const intentRef = useRef(null);   // null | "horizontal" | "vertical"

  if (reduced) return <>{children}</>;

  const REVEAL = CONFIG.SWIPE.REVEAL_WIDTH_PX;      // width the row snaps open to
  const SNAP   = CONFIG.SWIPE.DELETE_THRESHOLD_PX;  // drag past this from base → snap open
  const CLAIM  = CONFIG.SWIPE.CLAIM_DIST_PX;

  // Spring the row to a stable resting state (open = button revealed, or closed).
  const settle = (toOpen) => {
    setOpen(toOpen);
    animate(x, toOpen ? -REVEAL : 0, springSnappy);
  };

  const onTouchStart = (e) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
    baseRef.current = open ? -REVEAL : 0;
    intentRef.current = null;
    x.stop();   // interrupt any in-flight settle so the finger takes over cleanly
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
      if (Math.abs(dx) < CLAIM && Math.abs(dy) < CLAIM) return;
      intentRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
    }
    if (intentRef.current !== "horizontal") return;

    // Track the finger between fully closed (0) and the reveal width.
    // A little rubber-band past the reveal width keeps it from feeling
    // hard-stopped but never opens further than the button.
    let next = baseRef.current + dx;
    if (next > 0) next = 0;
    if (next < -REVEAL) next = -REVEAL - (Math.abs(next) - REVEAL) * 0.3;
    x.set(next);
  };

  // Return to whatever stable state we were in. Used for interrupted
  // gestures (touchcancel from a system event, multi-touch → pinch).
  const cancelGesture = () => {
    settle(open);
    startRef.current = null;
    intentRef.current = null;
  };

  const onTouchEnd = () => {
    if (intentRef.current === "horizontal") {
      // Snap open only if dragged decisively left; otherwise snap shut.
      // When already open, require a real rightward pull-back to close.
      const at = x.get();
      const shouldOpen = open ? at < -REVEAL * 0.5 : at <= -SNAP;
      settle(shouldOpen);
    }
    startRef.current = null;
    intentRef.current = null;
  };

  // The deliberate, explicit delete — the only path that removes the row.
  // Slides fully off, then hands off to removeFromCart + undo toast.
  const handleDelete = () => {
    animate(x, -window.innerWidth, {
      duration: CONFIG.SWIPE.COMMIT_ANIM_MS / 1000,
      ease: EASE_OUT,
      onComplete: () => onSwipeDelete?.(),
    });
  };

  return (
    <div className="relative overflow-hidden">
      {/* Red Delete button revealed behind the row. Tapping it is the
          only thing that deletes — a swipe alone never does. */}
      <div className="absolute inset-y-0 right-0 flex" style={{ width: REVEAL }}>
        <button
          type="button"
          onClick={handleDelete}
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
          className="w-full h-full flex items-center justify-center"
          style={{ background: "#8B2C2C", color: "#F5EFE3" }}
          aria-label="Delete item from bag"
        >
          <span className="text-xs tracking-[0.2em] uppercase" style={{ fontWeight: 600 }}>
            Delete
          </span>
        </button>
      </div>
      <m.div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={cancelGesture}
        // While open, a tap on the row closes it instead of activating
        // anything inside — captured so child buttons don't fire first.
        onClickCapture={(e) => {
          if (open) { e.preventDefault(); e.stopPropagation(); settle(false); }
        }}
        style={{
          position: "relative",
          x,
          background: "var(--bg-page)",
          touchAction: "pan-y",
        }}
      >
        {children}
      </m.div>
    </div>
  );
}
