// ============================================================
// MobileBottomNav — Apple-style floating bottom tab bar (mobile)
// ============================================================
// A frosted, floating "liquid glass" island with up to 4 tabs +
// a detached search orb. Mirrors the iOS tab bar: icon + label,
// active tab tinted.
//
// Liquid-glass press gesture (the premium bit): touch-and-hold the
// pill and a glass "lens" appears beneath your finger, the pill
// swells slightly, and the focused tab's icon magnifies. Slide
// left/right and the lens glides between tabs with a springy,
// liquid feel, magnifying whichever tab it's over. Lift to select
// the focused tab. Mouse + keyboard fall back to plain clicks, so
// accessibility is unaffected.
// ============================================================

import React, { useMemo, useRef, useState, useCallback } from "react";
import { Home, Store, BookOpen, ShoppingBag, Search } from "./icons.jsx";

export function MobileBottomNav({ view, cartCount, onHome, onShop, onJournal, onCart, onSearch }) {
  const tabs = useMemo(() => ([
    { key: "home",    label: "For You",  Icon: Home,        action: onHome,    activeWhen: view === "home" },
    { key: "shop",    label: "Products", Icon: Store,       action: onShop,    activeWhen: view === "shop" || view === "shop-category" || view === "shop-product" },
    { key: "journal", label: "Journal",  Icon: BookOpen,    action: onJournal, activeWhen: view === "journal" },
    { key: "cart",    label: "Bag",      Icon: ShoppingBag, action: onCart,    activeWhen: view === "cart", badge: cartCount },
  ]), [view, cartCount, onHome, onShop, onJournal, onCart]);

  // --- LIQUID-GLASS PRESS/SLIDE GESTURE ---
  const pillRef = useRef(null);
  const tabRefs = useRef([]);
  const focusedRef = useRef(null);          // index under the finger (ref for activation)
  const gesturingRef = useRef(false);
  const [pressing, setPressing] = useState(false);
  const [focused, setFocused] = useState(null);
  const [lens, setLens] = useState({ left: 0, width: 64 });
  const [snap, setSnap] = useState(false);  // true = jump (no slide) on first touch-down

  // Which tab sits under a given clientX (nearest if past the ends).
  const indexFromX = useCallback((clientX) => {
    const els = tabRefs.current;
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right) return i;
      const d = Math.abs(clientX - (r.left + r.width / 2));
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }, []);

  // Sit the lens over tab `i` (a touch wider than the tab for the bubble feel).
  const positionLens = useCallback((i) => {
    const pill = pillRef.current;
    const el = tabRefs.current[i];
    if (!pill || !el) return;
    const pr = pill.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const pad = 4;
    setLens({ left: r.left - pr.left - pad, width: r.width + pad * 2 });
  }, []);

  const setFocus = useCallback((i) => {
    focusedRef.current = i;
    setFocused(i);
    positionLens(i);
  }, [positionLens]);

  const onPointerDown = useCallback((e) => {
    // Mouse + pen keep the native click path (and keyboard via onClick).
    // Only touch drives the magnifying lens gesture.
    if (e.pointerType !== "touch") return;
    e.preventDefault();                       // suppress the emulated click
    gesturingRef.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    setSnap(true);                            // jump under the finger, don't slide in
    setPressing(true);
    setFocus(indexFromX(e.clientX));
    // After the snap frame, re-enable the gliding transition for slides.
    requestAnimationFrame(() => requestAnimationFrame(() => setSnap(false)));
  }, [indexFromX, setFocus]);

  const onPointerMove = useCallback((e) => {
    if (!gesturingRef.current) return;
    const i = indexFromX(e.clientX);
    if (i !== focusedRef.current) setFocus(i);
  }, [indexFromX, setFocus]);

  const endGesture = useCallback((activate) => {
    if (!gesturingRef.current) return;
    gesturingRef.current = false;
    const i = focusedRef.current;
    setPressing(false);
    setFocused(null);
    focusedRef.current = null;
    if (activate && i != null) tabs[i]?.action?.();
  }, [tabs]);

  return (
    <nav className="lg-bottom-island lg:hidden" aria-label="Primary">
      <div
        ref={pillRef}
        className="lg-nav-pill"
        data-pressing={pressing ? "true" : "false"}
        style={{ order: 0, alignItems: "center", padding: "0 6px 0 16px", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => endGesture(true)}
        onPointerCancel={() => endGesture(false)}
        onPointerLeave={() => endGesture(false)}
      >
        {/* The magnifying glass lens — glides under the focused tab while
            pressing, fades out at rest. Sits BEHIND the icons (z-index 0). */}
        <div
          className="lg-nav-lens"
          aria-hidden="true"
          style={{
            transform: `translateX(${lens.left}px)`,
            width: lens.width,
            opacity: pressing ? 1 : 0,
            transition: snap ? "opacity 0.18s ease" : undefined,
          }}
        />

        {tabs.map((tab, i) => {
          const isActive = tab.activeWhen;
          const isFocused = focused === i;
          return (
            <button
              key={tab.key}
              ref={(el) => { tabRefs.current[i] = el; }}
              onClick={tab.action}
              className="lg-tab"
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              data-active={isActive ? "true" : "false"}
              data-focused={isFocused ? "true" : "false"}
              style={{ position: "relative" }}
            >
              <span className="lg-tab-icon" style={{ display: "inline-flex", position: "relative" }}>
                <tab.Icon size={22} strokeWidth={isActive || isFocused ? 2.2 : 1.7} />
                {tab.badge > 0 && (
                  <span className="lg-tab-badge" aria-hidden="true">{tab.badge}</span>
                )}
              </span>
              <span
                className="lg-tab-label"
                style={{ fontSize: "0.66rem", marginTop: "3px", fontWeight: isActive ? 600 : 500, letterSpacing: "0.01em" }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Detached search orb — separate circle to the right, matching the
          Apple Store app's standalone search button. */}
      <button className="lg-nav-orb" onClick={onSearch} aria-label="Search">
        <Search size={22} strokeWidth={1.8} />
      </button>
    </nav>
  );
}
