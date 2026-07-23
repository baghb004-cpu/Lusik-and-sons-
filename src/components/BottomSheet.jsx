"use client";

// ============================================================
// BottomSheet — generic mobile bottom sheet
// ============================================================
// A panel that slides up from the bottom of the screen (same
// drawer easing as the side drawers, on the vertical axis), can
// be swiped down to dismiss, and does a one-time "breathing" nudge
// per `peekKey` on first open to teach the swipe. Provides its own
// grabber handle + white circular X close button; callers pass the
// scrollable body as children.
//
// Mobile only — the wrapper is `lg:hidden`. Desktop callers should
// render their own layout (e.g. the right-edge AuthDrawer / the
// full-page AccountView).
//
// Gesture + breathing logic mirror AuthDrawer.jsx, flipped from
// translateX to translateY. The slide-up entrance is the
// `.account-sheet` / `@keyframes sheetIn` rule in index.css.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { X } from "./icons.jsx";
import { useFocusTrap } from "../lib/useFocusTrap";
import { CONFIG } from "../data/config.js";

// Tracks which sheets have already shown their breathing hint this
// session (module scope, so it survives open/close but resets on reload).
const peekFired = new Set();

export function BottomSheet({ open, onClose, children, ariaLabel = "Dialog", peekKey = "default" }) {
  // --- SWIPE-DOWN-TO-DISMISS STATE (mirrors the cart/auth drawers) ---
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const dragStartRef = useRef(null);
  const dragIntentRef = useRef(null);   // null | "drag" | "scroll"
  const startScrollTopRef = useRef(0);
  const scrollRef = useRef(null);

  // --- "BREATHING" HINT STATE ---
  const [peekOffset, setPeekOffset] = useState(0);
  const [peekTransition, setPeekTransition] = useState("none");
  const timers = useRef([]);

  useEffect(() => {
    if (!open) {
      setDragY(0); setDragging(false); setClosing(false);
      setPeekOffset(0); setPeekTransition("none");
      dragStartRef.current = null; dragIntentRef.current = null;
      timers.current.forEach(clearTimeout); timers.current = [];
      return;
    }

    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);

    const reduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (!peekFired.has(peekKey) && !reduced) {
      // Wait for the 0.4s slide-in to finish, then nudge DOWN a touch
      // and spring back — teaching "you can pull this down to close".
      const t1 = setTimeout(() => {
        peekFired.add(peekKey);
        setPeekTransition("transform 0.18s ease-out");
        setPeekOffset(30);
        const t2 = setTimeout(() => {
          setPeekTransition("transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)");
          setPeekOffset(0);
          const t3 = setTimeout(() => setPeekTransition("none"), 470);
          timers.current.push(t3);
        }, 190);
        timers.current.push(t2);
      }, 520);
      timers.current.push(t1);
    } else {
      peekFired.add(peekKey);
    }

    return () => {
      document.removeEventListener("keydown", onKey);
      timers.current.forEach(clearTimeout); timers.current = [];
    };
  }, [open, onClose, peekKey]);

  const onTouchCancel = useCallback(() => {
    setDragging(false);
    setDragY(0);
    dragStartRef.current = null;
    dragIntentRef.current = null;
  }, []);

  const onTouchStart = useCallback((e) => {
    const t = e.touches[0];
    if (!t) return;
    dragStartRef.current = { x: t.clientX, y: t.clientY };
    dragIntentRef.current = null;
    startScrollTopRef.current = scrollRef.current ? scrollRef.current.scrollTop : 0;
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!dragStartRef.current) return;
    if (e.touches.length > 1) { onTouchCancel(); return; }
    const t = e.touches[0];
    const dx = t.clientX - dragStartRef.current.x;
    const dy = t.clientY - dragStartRef.current.y;

    if (dragIntentRef.current === null) {
      if (Math.abs(dx) < CONFIG.SWIPE.CLAIM_DIST_PX && Math.abs(dy) < CONFIG.SWIPE.CLAIM_DIST_PX) return;
      // Claim the gesture as a dismiss ONLY when it's a downward drag and
      // the content is already scrolled to the very top — otherwise it's
      // the user scrolling the sheet content, so let it through.
      const downward = Math.abs(dy) > Math.abs(dx) && dy > 0;
      dragIntentRef.current = (downward && startScrollTopRef.current <= 0) ? "drag" : "scroll";
    }
    if (dragIntentRef.current !== "drag") return;
    if (!dragging) setDragging(true);
    setDragY(Math.max(0, dy));
  }, [dragging, onTouchCancel]);

  const onTouchEnd = useCallback(() => {
    if (dragIntentRef.current === "drag") {
      setDragging(false);
      if (dragY > CONFIG.SWIPE.DISMISS_THRESHOLD_PX) {
        // Commit — slide the rest of the way down, then unmount.
        setClosing(true);
        setDragY(window.innerHeight);
        setTimeout(() => onClose(), CONFIG.SWIPE.COMMIT_ANIM_MS);
      } else {
        setDragY(0); // spring back
      }
    }
    dragStartRef.current = null;
    dragIntentRef.current = null;
  }, [dragY, onClose]);

  const trapRef = useFocusTrap(open);

  if (!open) return null;

  const translateY = dragY + peekOffset;
  const transition = dragging
    ? "none"
    : (peekTransition !== "none" ? peekTransition : "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)");

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div
        className="absolute inset-0 lg-scrim"
        style={{ opacity: closing ? 0 : 1, transition: "opacity 0.3s ease" }}
      />
      <div
        className="lg-panel-tall account-sheet vh-cap-92 relative w-full flex flex-col"
        style={{
          transform: `translateY(${translateY}px)`,
          transition,
          touchAction: "pan-y",
          borderRadius: "26px 26px 0 0",
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
      >
        {/* Close button — a DIRECT child of the full-width panel (which is
            `relative w-full`), positioned with INLINE styles, so its right
            edge is always the panel's right edge no matter what. Tailwind
            offset utilities are avoided here (an absolute element whose
            offsets don't apply falls back to the top-left and clips); the
            safe-area inset + min margin keep the bubble clear of notches and
            rounded display corners on every device. */}
        <button
          onClick={onClose}
          aria-label="Close"
          data-tooltip="Close"
          className="grid place-items-center rounded-full active:scale-95 transition-transform"
          style={{
            position: "absolute",
            top: 12,
            right: "max(16px, env(safe-area-inset-right, 0px))",
            width: 40, height: 40,
            zIndex: 10,
            background: "var(--bg-surface, #ffffff)",
            color: "var(--text-primary, #1A1612)",
            border: "1px solid var(--border-soft, rgba(26,22,18,0.1))",
            boxShadow: "0 4px 14px -4px rgba(26,22,18,0.3)",
          }}
        >
          <X size={20} strokeWidth={2.25} />
        </button>

        {/* Grabber handle */}
        <div className="pt-3 pb-2 flex-shrink-0">
          <div
            className="mx-auto rounded-full"
            style={{ width: 40, height: 5, background: "var(--border-default, rgba(26,22,18,0.2))" }}
          />
        </div>

        {/* Scrollable body */}
        <div
          ref={scrollRef}
          className="overflow-y-auto"
          style={{ overscrollBehaviorY: "contain", paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
