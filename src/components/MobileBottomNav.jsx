// ============================================================
// MobileBottomNav — Apple-Store-style floating glass tab bar
// ============================================================
// A frosted-glass rounded pill that floats at the bottom of the
// phone viewport. Five tabs completing the Apple Store 5-tab
// pattern: Home, Shop, Journal, Cart, Search.
//
// Account access is NO LONGER in the bottom nav — it lives in
// the avatar circle inside MobilePageHeader (already wired).
//
// The active tab is highlighted with a brighter "lens" panel that:
//
//   - Slides between tabs with a soft spring on activation
//   - During a touch-and-drag, follows the finger across the bar
//   - On release, snaps to the nearest tab AND triggers it if the
//     user dragged onto a different tab (otherwise stays put)
//   - Magnifies the icon directly under it by ~1.18x (and adjacent
//     icons by ~1.06x) for a chromatic-aberration / lens feel
//
// Implementation notes:
//   - The bar's position: fixed comes from .lg-bottom-island in
//     styles/index.css (a Tailwind `fixed` class would work too —
//     left as a CSS class so the styling and the position stay in
//     one place).
//   - Lens position is computed in pixels off the container's
//     bounding rect so the touch math doesn't fight CSS percentages.
//   - Touch handlers use { passive: true } where possible. The
//     touchmove handler calls preventDefault() ONLY while we've
//     claimed the gesture as a horizontal drag (move distance >= 6px)
//     so vertical scrolling on the rest of the page still works.
//   - Accessibility: every tab is still a real <button> with its own
//     onClick. The lens is decorative — keyboard / screen-reader
//     users get the existing nav behavior unchanged.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Home, Store, BookOpen, ShoppingBag, Search } from "./icons.jsx";

export function MobileBottomNav({ view, cartCount, onHome, onShop, onJournal, onCart, onSearch }) {
  // Tab definitions, indexed left-to-right. `activeWhen` decides where
  // the lens settles when no touch is active. Order is load-bearing:
  // changing it would change where the lens snaps when there's no
  // active tab (defaults to index 0, Home).
  const tabs = useMemo(() => ([
    { key: "home",    label: "Home",    Icon: Home,        action: onHome,    activeWhen: view === "home" },
    { key: "shop",    label: "Shop",    Icon: Store,       action: onShop,    activeWhen: view === "shop" || view === "shop-category" || view === "shop-product" },
    { key: "journal", label: "Journal", Icon: BookOpen,    action: onJournal, activeWhen: view === "journal" },
    { key: "cart",    label: "Cart",    Icon: ShoppingBag, action: onCart,    activeWhen: false, badge: cartCount },
    { key: "search",  label: "Search",  Icon: Search,      action: onSearch,  activeWhen: view === "search" },
  ]), [view, cartCount, onHome, onShop, onJournal, onCart, onSearch]);

  // Index the lens should rest on. Falls back to 0 (Home) if no
  // tab matches the current view.
  const baseIndex = useMemo(() => {
    const i = tabs.findIndex((t) => t.activeWhen);
    return i < 0 ? 0 : i;
  }, [tabs]);

  const navRef = useRef(null);
  // Track-x state: lensIndex is the slot (snapped position) and
  // dragOffset is the px nudge during an active touch. When idle,
  // dragOffset is 0 and lensIndex === baseIndex.
  const [lensIndex,  setLensIndex]  = useState(baseIndex);
  const [dragOffset, setDragOffset] = useState(0);
  const [pressed,    setPressed]    = useState(false);
  // Stays true between touchmove > 6px and touchend; gates the
  // preventDefault inside the move handler.
  const draggingRef = useRef(false);
  const startXRef   = useRef(0);
  const startYRef   = useRef(0);
  // The tab the touch finger is CURRENTLY over (regardless of where
  // it started). Used to magnify the under-finger icon.
  const [hoverIndex, setHoverIndex] = useState(null);

  // Keep the lens in sync with the active view as long as the user
  // isn't actively touching the bar. While touching, the view-change
  // shouldn't yank the lens out from under their finger.
  useEffect(() => {
    if (!pressed) setLensIndex(baseIndex);
  }, [baseIndex, pressed]);

  // Honor "Reduce Motion". When enabled we skip the spring transition
  // on the lens (CSS does the rest via the @media query).
  const reducedMotion = useMemo(() => (
    typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ), []);

  const tabCount = tabs.length;

  // Given a clientX, return the tab index whose slot contains it.
  // Clamps to [0, tabCount-1] so a slight overshoot at either end
  // still selects the edge tab.
  const xToIndex = useCallback((clientX) => {
    const rect = navRef.current?.getBoundingClientRect();
    if (!rect) return baseIndex;
    const x = clientX - rect.left;
    const slot = rect.width / tabCount;
    const raw = Math.floor(x / slot);
    return Math.max(0, Math.min(tabCount - 1, raw));
  }, [baseIndex, tabCount]);

  // Convert clientX to a continuous dragOffset (px from the active
  // tab slot's center). Used by the lens transform so it tracks the
  // finger smoothly between slots.
  const xToOffset = useCallback((clientX, fromIndex) => {
    const rect = navRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const slot = rect.width / tabCount;
    const center = rect.left + slot * (fromIndex + 0.5);
    return clientX - center;
  }, [tabCount]);

  const onTouchStart = (e) => {
    const t = e.touches[0];
    if (!t) return;
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    draggingRef.current = false;
    setPressed(true);
    // Where did the finger LAND? Move the lens there immediately so
    // the touch feels responsive even before any drag.
    const idx = xToIndex(t.clientX);
    setLensIndex(idx);
    setHoverIndex(idx);
    setDragOffset(0);
  };

  const onTouchMove = (e) => {
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - startXRef.current;
    const dy = t.clientY - startYRef.current;
    if (!draggingRef.current) {
      // Don't claim the gesture until movement is clearly horizontal.
      // A vertical drag should fall through to the page scroller.
      if (Math.abs(dx) < 6 || Math.abs(dx) <= Math.abs(dy)) return;
      draggingRef.current = true;
    }
    // We're horizontally dragging — prevent the browser from doing
    // anything else with this touch (page pan, pull-to-refresh).
    e.preventDefault?.();
    const idx = xToIndex(t.clientX);
    if (idx !== lensIndex) setLensIndex(idx);
    setHoverIndex(idx);
    setDragOffset(xToOffset(t.clientX, idx));
  };

  const fireTab = (idx) => {
    const tab = tabs[idx];
    if (tab && typeof tab.action === "function") {
      try { tab.action(); } catch (err) { console.warn(err); }
    }
  };

  const onTouchEnd = (e) => {
    setPressed(false);
    setHoverIndex(null);
    setDragOffset(0);
    if (!draggingRef.current) {
      // No drag — just a tap. The <button>'s native onClick will fire
      // on its own, so no action needed here. Make sure the lens
      // stays on the tapped slot, though.
      const tapX = e.changedTouches?.[0]?.clientX ?? null;
      if (tapX != null) setLensIndex(xToIndex(tapX));
      draggingRef.current = false;
      return;
    }
    draggingRef.current = false;
    // Snap the lens to the nearest slot and activate that tab — the
    // user dragged the lens onto a target. This makes "drag the
    // glass blob to navigate" feel real.
    const endX = e.changedTouches?.[0]?.clientX ?? null;
    if (endX == null) return;
    const idx = xToIndex(endX);
    setLensIndex(idx);
    fireTab(idx);
  };

  const onTouchCancel = () => {
    setPressed(false);
    setDragOffset(0);
    setHoverIndex(null);
    draggingRef.current = false;
    setLensIndex(baseIndex);
  };

  // Compute per-icon magnify scale. Tab directly under the lens gets
  // 1.18, adjacent tabs get 1.06, others 1.0. During an active drag
  // we key off hoverIndex so the icon "lifts" the moment the finger
  // crosses into its slot. Otherwise we key off lensIndex (the
  // settled active tab) for a softer at-rest look.
  const scaleFor = (i) => {
    const target = hoverIndex ?? lensIndex;
    if (i === target) return 1.18;
    if (Math.abs(i - target) === 1) return 1.06;
    return 1;
  };

  // Lens slot width as a CSS percentage. The lens transform handles
  // the finger-tracking nudge.
  const slotPct = 100 / tabCount;

  return (
    <nav
      ref={navRef}
      className="lg-bottom-island lg:hidden"
      aria-label="Bottom navigation"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      {/* LENS — visual highlight under the active tab. Decorative,
          pointer-events: none so it never intercepts taps. */}
      <span
        className={"lg-lens" + (pressed ? " lg-lens-pressed" : "")}
        aria-hidden="true"
        style={{
          width:     `${slotPct}%`,
          left:      `${lensIndex * slotPct}%`,
          transform: `translateX(${dragOffset}px)`,
          transition: reducedMotion
            ? "none"
            : draggingRef.current
              ? "transform 0ms, left 0ms"
              : "left 0.32s cubic-bezier(0.4, 1.4, 0.6, 1), transform 0.32s cubic-bezier(0.4, 1.4, 0.6, 1)",
        }}
      />
      {tabs.map((t, i) => {
        const active = i === lensIndex;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => { setLensIndex(i); fireTab(i); }}
            className="lg-tab"
            aria-current={active ? "page" : undefined}
            aria-label={t.label + (t.badge ? ` (${t.badge} item${t.badge === 1 ? "" : "s"})` : "")}
          >
            <span
              className="lg-tab-icon"
              style={{
                transform: `scale(${scaleFor(i)})`,
                transition: reducedMotion ? "none" : "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              <t.Icon
                size={22}
                strokeWidth={active ? 2 : 1.6}
                style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }}
              />
              {t.badge > 0 && (
                <span className="lg-tab-badge" aria-hidden="true">{t.badge}</span>
              )}
            </span>
            <span
              className="lg-tab-label"
              style={{
                color: active ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight: active ? 600 : 500,
              }}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
