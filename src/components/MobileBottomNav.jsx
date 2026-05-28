// ============================================================
// MobileBottomNav — Apple-Store-style pill + detached orb
// ============================================================
// The bar is a transparent flex wrapper holding two frosted glass
// pieces with a gap between them — exactly like the Apple Store,
// where the magnifying glass / X is its own bubble isolated from
// the menu pill:
//
//   NORMAL:   [ Home  Shop  Journal  Cart ]   ( 🔍 )
//             └─────── pill (4 tabs) ──────┘   └ orb ┘
//
//   SEARCH (typing, not focused):
//             ( 🛍2 )   [ 🔍  What are you looking for?   🎤 ]
//             └ orb ┘   └──────────── pill ───────────────┘
//
//   SEARCH (focused / keyboard up):
//             [ 🔍  What are you looking for?   🎤 ]   ( ✕ )
//             └──────────── pill ───────────────┘     └orb┘
//
// The orb swaps role + side by flex `order`; the search input
// stays mounted across stages so focus is preserved. The 4-tab
// pill keeps the sliding "lens" + drag-to-navigate.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Home, Store, BookOpen, ShoppingBag, Search, Mic, X } from "./icons.jsx";
import { useKeyboardOffset } from "../lib/useKeyboardOffset.js";

const SR = typeof window !== "undefined"
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

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
  const [inputFocused, setInputFocused] = useState(false);
  const [listening, setListening] = useState(false);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  const isFullSearch = isSearch && inputFocused;
  const kbOffset = useKeyboardOffset(isFullSearch);

  useEffect(() => {
    if (isSearch) {
      const t = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
    setInputFocused(false);
  }, [isSearch]);

  useEffect(() => {
    return () => { try { recognitionRef.current?.abort(); } catch {} };
  }, []);

  const startVoice = () => {
    if (!SR) return;
    const r = new SR();
    r.lang = "en-US";
    r.interimResults = false;
    r.onstart = () => setListening(true);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    r.onresult = (e) => {
      const t = e.results?.[0]?.[0]?.transcript;
      if (t) onSearchQueryChange?.(t);
    };
    recognitionRef.current = r;
    r.start();
  };

  const closeSearch = () => {
    // Just collapse the keyboard and return to the search menu —
    // blurring the input drops the keyboard, clearing the query
    // brings back the "Try searching" suggestions, and we STAY on
    // the search view (no navigation home, no page reload).
    inputRef.current?.blur();
    onSearchQueryChange?.("");
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
  };

  // ── 4 tabs (Search is now the orb, not a tab) ────────────
  const tabs = useMemo(() => ([
    { key: "home",    label: "Home",    Icon: Home,        action: onHome,    activeWhen: view === "home" },
    { key: "shop",    label: "Shop",    Icon: Store,       action: onShop,    activeWhen: view === "shop" || view === "shop-category" || view === "shop-product" },
    { key: "journal", label: "Journal", Icon: BookOpen,    action: onJournal, activeWhen: view === "journal" },
    { key: "cart",    label: "Cart",    Icon: ShoppingBag, action: onCart,    activeWhen: view === "cart", badge: cartCount },
  ]), [view, cartCount, onHome, onShop, onJournal, onCart]);

  const baseIndex = useMemo(() => {
    const i = tabs.findIndex((t) => t.activeWhen);
    return i < 0 ? 0 : i;
  }, [tabs]);

  const pillRef = useRef(null);
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
  const anim = reducedMotion ? "none" : undefined;

  const xToIndex = useCallback((clientX) => {
    const rect = pillRef.current?.getBoundingClientRect();
    if (!rect) return baseIndex;
    const x = clientX - rect.left;
    const slot = rect.width / tabCount;
    return Math.max(0, Math.min(tabCount - 1, Math.floor(x / slot)));
  }, [baseIndex, tabCount]);

  const xToOffset = useCallback((clientX, fromIndex) => {
    const rect = pillRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const slot = rect.width / tabCount;
    return clientX - (rect.left + slot * (fromIndex + 0.5));
  }, [tabCount]);

  const onTouchStart = (e) => {
    if (isSearch) return;
    const t = e.touches[0]; if (!t) return;
    startXRef.current = t.clientX; startYRef.current = t.clientY;
    draggingRef.current = false; setPressed(true);
    const idx = xToIndex(t.clientX);
    setLensIndex(idx); setHoverIndex(idx); setDragOffset(0);
  };
  const onTouchMove = (e) => {
    if (isSearch) return;
    const t = e.touches[0]; if (!t) return;
    const dx = t.clientX - startXRef.current;
    const dy = t.clientY - startYRef.current;
    if (!draggingRef.current) {
      if (Math.abs(dx) < 6 || Math.abs(dx) <= Math.abs(dy)) return;
      draggingRef.current = true;
    }
    e.preventDefault?.();
    const idx = xToIndex(t.clientX);
    if (idx !== lensIndex) setLensIndex(idx);
    setHoverIndex(idx); setDragOffset(xToOffset(t.clientX, idx));
  };
  const fireTab = (idx) => {
    const tab = tabs[idx];
    if (tab?.action) try { tab.action(); } catch {}
  };
  const onTouchEnd = (e) => {
    if (isSearch) return;
    setPressed(false); setHoverIndex(null); setDragOffset(0);
    if (!draggingRef.current) {
      const tapX = e.changedTouches?.[0]?.clientX ?? null;
      if (tapX != null) setLensIndex(xToIndex(tapX));
      draggingRef.current = false; return;
    }
    draggingRef.current = false;
    const endX = e.changedTouches?.[0]?.clientX ?? null;
    if (endX == null) return;
    const idx = xToIndex(endX); setLensIndex(idx); fireTab(idx);
  };
  const onTouchCancel = () => {
    if (isSearch) return;
    setPressed(false); setDragOffset(0); setHoverIndex(null);
    draggingRef.current = false; setLensIndex(baseIndex);
  };

  const scaleFor = (i) => {
    const target = hoverIndex ?? lensIndex;
    if (i === target) return 1.18;
    if (Math.abs(i - target) === 1) return 1.06;
    return 1;
  };

  const slotPct = 100 / tabCount;

  // ── Shared search-pill markup (Stage 1 + Stage 2) ────────
  const searchPill = (
    <div className="lg-nav-pill" style={{ order: 0, alignItems: "center", padding: "0 6px 0 16px" }}>
      <span style={{ flexShrink: 0, color: "rgba(26,22,18,0.4)" }}>
        <Search size={18} strokeWidth={1.6} />
      </span>
      <input
        ref={inputRef}
        type="search"
        value={searchQuery}
        onChange={(e) => onSearchQueryChange?.(e.target.value)}
        onFocus={() => setInputFocused(true)}
        onBlur={() => setTimeout(() => setInputFocused(false), 150)}
        placeholder="What are you looking for?"
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        tabIndex={isSearch ? 0 : -1}
        style={{
          flex: 1, minWidth: 0, height: "100%",
          border: "none", outline: "none", background: "transparent",
          fontSize: "16px",
          fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
          fontWeight: 400,
          color: "var(--text-primary, #1A1612)",
          paddingLeft: 10, paddingRight: 6,
          WebkitAppearance: "none", appearance: "none",
        }}
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => { onSearchQueryChange?.(""); inputRef.current?.focus(); }}
          aria-label="Clear search text"
          style={{
            flexShrink: 0, width: 26, height: 26, display: "flex",
            alignItems: "center", justifyContent: "center",
            color: "rgba(26,22,18,0.4)", background: "transparent", border: "none",
          }}
        >
          <span style={{ fontSize: "1.2rem", fontWeight: 300, lineHeight: 1 }}>&times;</span>
        </button>
      )}
      {SR && (
        <button
          type="button"
          onClick={listening ? () => { try { recognitionRef.current?.stop(); } catch {} setListening(false); } : startVoice}
          aria-label={listening ? "Stop listening" : "Search by voice"}
          style={{
            flexShrink: 0, width: 38, height: 38, display: "flex",
            alignItems: "center", justifyContent: "center", borderRadius: "50%",
            background: listening ? "rgba(176,136,66,0.15)" : "transparent",
            border: "none", cursor: "pointer",
            color: listening ? "#B08842" : "rgba(26,22,18,0.4)",
            transition: "color 0.2s, background 0.2s",
          }}
        >
          <Mic size={19} strokeWidth={1.6} />
        </button>
      )}
    </div>
  );

  return (
    <nav
      className="lg-bottom-island lg:hidden"
      aria-label="Bottom navigation"
      style={{
        transform: kbOffset ? `translateY(-${kbOffset}px)` : undefined,
        transition: reducedMotion ? "none" : "transform 0.25s ease",
      }}
    >
      {isSearch ? (
        <>
          {/* Detached orb — Cart-badge / "&" (Stage 1, left) or
              X close (Stage 2, right). Single element so the search
              input never remounts; only order + content change. */}
          <button
            type="button"
            className="lg-nav-orb"
            style={{ order: isFullSearch ? 1 : -1 }}
            onClick={isFullSearch ? closeSearch : (cartCount > 0 ? onCart : onHome)}
            aria-label={isFullSearch ? "Close search" : (cartCount > 0 ? "Open cart" : "Back to home")}
          >
            {isFullSearch ? (
              <span style={{ color: "var(--text-primary)" }}>
                <X size={20} strokeWidth={2} />
              </span>
            ) : cartCount > 0 ? (
              <span style={{ position: "relative", color: "var(--text-primary)" }}>
                <ShoppingBag size={22} strokeWidth={1.7} />
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute", top: -8, right: -10,
                    minWidth: 18, height: 18, padding: "0 5px",
                    borderRadius: 999, background: "#B08842", color: "#fff",
                    fontSize: "0.65rem", fontWeight: 700, lineHeight: "18px",
                    textAlign: "center",
                  }}
                >
                  {cartCount}
                </span>
              </span>
            ) : (
              <span style={{
                fontFamily: "Fraunces, Georgia, serif", fontSize: "1.3rem",
                fontWeight: 600, color: "#B08842", lineHeight: 1,
              }}>&amp;</span>
            )}
          </button>
          {searchPill}
        </>
      ) : (
        <>
          {/* NORMAL: 4-tab frosted pill + detached Search orb */}
          <div
            ref={pillRef}
            className="lg-nav-pill"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchCancel}
          >
            <span
              className={"lg-lens" + (pressed ? " lg-lens-pressed" : "")}
              aria-hidden="true"
              style={{
                width: `${slotPct}%`, left: `${lensIndex * slotPct}%`,
                transform: `translateX(${dragOffset}px)`,
                transition: anim ?? (draggingRef.current
                  ? "transform 0ms, left 0ms"
                  : "left 0.32s cubic-bezier(0.4,1.4,0.6,1), transform 0.32s cubic-bezier(0.4,1.4,0.6,1)"),
              }}
            />
            {tabs.map((t, i) => {
              const active = i === lensIndex;
              return (
                <button
                  key={t.key} type="button"
                  onClick={() => { setLensIndex(i); fireTab(i); }}
                  className="lg-tab"
                  aria-current={active ? "page" : undefined}
                  aria-label={t.label + (t.badge ? ` (${t.badge})` : "")}
                >
                  <span className="lg-tab-icon" style={{
                    transform: `scale(${scaleFor(i)})`,
                    transition: anim ?? "transform 0.22s cubic-bezier(0.34,1.56,0.64,1)",
                  }}>
                    <t.Icon size={22} strokeWidth={active ? 2 : 1.6}
                      style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }} />
                    {t.badge > 0 && <span className="lg-tab-badge" aria-hidden="true">{t.badge}</span>}
                  </span>
                  <span className="lg-tab-label" style={{
                    color: active ? "var(--text-primary)" : "var(--text-muted)",
                    fontWeight: active ? 600 : 500,
                  }}>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Detached Search orb */}
          <button
            type="button"
            className="lg-nav-orb"
            onClick={onSearch}
            aria-label="Search"
          >
            <span style={{ color: "var(--text-primary)" }}>
              <Search size={22} strokeWidth={1.8} />
            </span>
          </button>
        </>
      )}
    </nav>
  );
}
