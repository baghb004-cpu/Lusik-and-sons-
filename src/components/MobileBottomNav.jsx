// ============================================================
// MobileBottomNav — Apple-Store-style floating glass tab bar
// ============================================================
// Five frosted-glass tabs in a pill: Home, Shop, Journal, Cart,
// Search. Always visible, never collapses. The Search tab simply
// navigates to the search view; the actual search input is a
// separate floating bar (MobileSearchBar) that renders above
// this tab bar.
//
// The active tab is highlighted with a brighter "lens" panel
// that slides between tabs with a spring curve. Touch-drag the
// lens between tabs to navigate by gesture.
//
// Account access is via the avatar circle in MobilePageHeader
// (not in this nav bar).
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Home, Store, BookOpen, ShoppingBag, Search } from "./icons.jsx";

export function MobileBottomNav({ view, cartCount, onHome, onShop, onJournal, onCart, onSearch }) {
  const tabs = useMemo(() => ([
    { key: "home",    label: "Home",    Icon: Home,        action: onHome,    activeWhen: view === "home" },
    { key: "shop",    label: "Shop",    Icon: Store,       action: onShop,    activeWhen: view === "shop" || view === "shop-category" || view === "shop-product" },
    { key: "journal", label: "Journal", Icon: BookOpen,    action: onJournal, activeWhen: view === "journal" },
    { key: "cart",    label: "Cart",    Icon: ShoppingBag, action: onCart,    activeWhen: false, badge: cartCount },
    { key: "search",  label: "Search",  Icon: Search,      action: onSearch,  activeWhen: view === "search" },
  ]), [view, cartCount, onHome, onShop, onJournal, onCart, onSearch]);

  const baseIndex = useMemo(() => {
    const i = tabs.findIndex((t) => t.activeWhen);
    return i < 0 ? 0 : i;
  }, [tabs]);

  const navRef = useRef(null);
  const [lensIndex,  setLensIndex]  = useState(baseIndex);
  const [dragOffset, setDragOffset] = useState(0);
  const [pressed,    setPressed]    = useState(false);
  const draggingRef = useRef(false);
  const startXRef   = useRef(0);
  const startYRef   = useRef(0);
  const [hoverIndex, setHoverIndex] = useState(null);

  useEffect(() => {
    if (!pressed) setLensIndex(baseIndex);
  }, [baseIndex, pressed]);

  const reducedMotion = useMemo(() => (
    typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ), []);

  const tabCount = tabs.length;

  const xToIndex = useCallback((clientX) => {
    const rect = navRef.current?.getBoundingClientRect();
    if (!rect) return baseIndex;
    const x = clientX - rect.left;
    const slot = rect.width / tabCount;
    const raw = Math.floor(x / slot);
    return Math.max(0, Math.min(tabCount - 1, raw));
  }, [baseIndex, tabCount]);

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
      if (Math.abs(dx) < 6 || Math.abs(dx) <= Math.abs(dy)) return;
      draggingRef.current = true;
    }
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
      const tapX = e.changedTouches?.[0]?.clientX ?? null;
      if (tapX != null) setLensIndex(xToIndex(tapX));
      draggingRef.current = false;
      return;
    }
    draggingRef.current = false;
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

  const scaleFor = (i) => {
    const target = hoverIndex ?? lensIndex;
    if (i === target) return 1.18;
    if (Math.abs(i - target) === 1) return 1.06;
    return 1;
  };

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
