// ============================================================
// MobileBottomNav — Apple-Store-style floating glass tab bar
//                   with search-mode collapse
// ============================================================
// Two visual modes, same component:
//
//   NORMAL (any view except search):
//     Five frosted-glass tabs in a pill: Home, Shop, Journal,
//     Cart, Search. The active tab has a sliding "lens" with
//     spring physics + icon magnification. Touch-drag the lens
//     between tabs. Same behavior as before.
//
//   SEARCH (view === "search"):
//     The five tabs collapse into a single small circular button
//     on the left (the brand "&" in gold). A pill-shaped search
//     input fills the remaining space. Tapping the "&" takes the
//     user home and restores the full nav. The search input is
//     the actual functional input — its value is lifted to App
//     so MobileSearchView can show results in the main area.
//
// The transition between modes is animated: tabs fade out while
// the icon + input fade in, with a slight horizontal slide.
//
// Account access is via the avatar circle in MobilePageHeader
// (not in this nav bar).
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Home, Store, BookOpen, ShoppingBag, Search } from "./icons.jsx";

export function MobileBottomNav({
  view,
  cartCount,
  onHome,
  onShop,
  onJournal,
  onCart,
  onSearch,
  searchQuery = "",
  onSearchQueryChange,
}) {
  const isSearch = view === "search";

  // ── Tab definitions (normal mode) ────────────────────────
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
  const searchInputRef = useRef(null);
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

  // Auto-focus the search input when entering search mode.
  useEffect(() => {
    if (isSearch) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [isSearch]);

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

  // ── Touch handlers (normal mode only) ────────────────────
  const onTouchStart = (e) => {
    if (isSearch) return;
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
    if (isSearch) return;
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
    if (isSearch) return;
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
    if (isSearch) return;
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

  // ── Render ───────────────────────────────────────────────
  return (
    <nav
      ref={navRef}
      className={"lg-bottom-island lg:hidden" + (isSearch ? " lg-bottom-search" : "")}
      aria-label="Bottom navigation"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      {/* ── SEARCH MODE: collapsed icon + search input ──── */}
      <div
        className="lg-search-bar-layout"
        style={{
          opacity: isSearch ? 1 : 0,
          pointerEvents: isSearch ? "auto" : "none",
          transform: isSearch ? "translateY(0)" : "translateY(8px)",
          transition: reducedMotion ? "none" : "opacity 0.25s ease, transform 0.25s ease",
          position: isSearch ? "relative" : "absolute",
          width: "100%",
        }}
        aria-hidden={!isSearch}
      >
        {/* Collapsed nav icon — the brand "&" in gold on a
            frosted circle. Tapping goes home + restores the
            full tab bar. */}
        <button
          type="button"
          onClick={onHome}
          className="lg-collapsed-nav-icon"
          aria-label="Back to home"
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: "var(--bg-surface, rgba(245,239,227,0.85))",
            border: "1px solid rgba(26,22,18,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 2px 8px -2px rgba(26,22,18,0.15)",
          }}
        >
          <span
            style={{
              fontFamily: "Fraunces, Georgia, serif",
              fontSize: "1.2rem",
              fontWeight: 600,
              color: "#B08842",
              lineHeight: 1,
            }}
          >
            &amp;
          </span>
        </button>

        {/* Search input — pill shape, fills the remaining space */}
        <div style={{ flex: 1, position: "relative" }}>
          <span
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--text-muted)" }}
          >
            <Search size={16} strokeWidth={1.5} />
          </span>
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange?.(e.target.value)}
            placeholder="What are you looking for?"
            className="mobile-search-input"
            style={{
              width: "100%",
              paddingLeft: "2.5rem",
              paddingRight: searchQuery ? "2.2rem" : "1rem",
              height: 42,
              fontSize: "0.85rem",
            }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            tabIndex={isSearch ? 0 : -1}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchQueryChange?.("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
              aria-label="Clear search"
              style={{ color: "var(--text-primary)", lineHeight: 1 }}
              tabIndex={isSearch ? 0 : -1}
            >
              <span style={{ fontSize: "1.1rem", fontWeight: 300 }}>&times;</span>
            </button>
          )}
        </div>
      </div>

      {/* ── NORMAL MODE: 5 tabs with lens ───────────────── */}
      <span
        className={"lg-lens" + (pressed ? " lg-lens-pressed" : "")}
        aria-hidden="true"
        style={{
          width:     `${slotPct}%`,
          left:      `${lensIndex * slotPct}%`,
          transform: `translateX(${dragOffset}px)`,
          opacity: isSearch ? 0 : 1,
          transition: reducedMotion
            ? "none"
            : draggingRef.current
              ? "transform 0ms, left 0ms, opacity 0.2s ease"
              : "left 0.32s cubic-bezier(0.4, 1.4, 0.6, 1), transform 0.32s cubic-bezier(0.4, 1.4, 0.6, 1), opacity 0.2s ease",
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
            tabIndex={isSearch ? -1 : 0}
            style={{
              opacity: isSearch ? 0 : 1,
              pointerEvents: isSearch ? "none" : "auto",
              transform: isSearch ? "scale(0.85)" : "scale(1)",
              transition: reducedMotion ? "none" : "opacity 0.2s ease, transform 0.25s ease",
            }}
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
