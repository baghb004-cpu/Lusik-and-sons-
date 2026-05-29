// ============================================================
// MobileBottomNav — Apple-Store-style pill + detached orb
// ============================================================
// The bar is a transparent flex wrapper holding two frosted glass
// pieces with a gap between them — exactly like the Apple Store,
// where the magnifying glass / X is its own bubble isolated from
// the menu pill:
//
//   NORMAL:   [ Home  Shop  Journal  Bag ]    ( 🔍 )
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
  // Mobile-only labels mirror the Apple Store app's tab names: "For You"
  // (home) and "Products" (shop). This component is lg:hidden, so the
  // desktop top-nav labels ("Home"/"Shop") are unaffected.
  const tabs = useMemo(() => ([
    { key: "home",    label: "For You",  Icon: Home,        action: onHome,    activeWhen: view === "home" },
    { key: "shop",    label: "Products", Icon: Store,       action: onShop,    activeWhen: view === "shop" || view === "shop-category" || view === "shop-product" },
    { key: "journal", label: "Journal", Icon: BookOpen,    action: onJournal, activeWhen: view === "journal" },
    { key: "cart",    label: "Bag",     Icon: ShoppingBag, action: onCart,    activeWhen: view === "cart", badge: cartCount },
  ]), [view, cartCount, onHome, onShop, onJournal, onCart]);

  const baseIndex = useMemo(() => {
    const i = tabs.findIndex((t) => t.activeWhen);
    return i < 0 ? 0 : i;
  }, [tabs]);

  const pillRef = useRef(null);
  const tabCount = tabs.length;
  const slotPct = 100 / tabCount;

  // Lens position model:
  //   - `dragIndex` (a float 0..count-1) wins while the finger is dragging,
  //     and is briefly held after release until the route catches up.
  //   - otherwise the lens is route-driven via `baseIndex`.
  // So the selector both FOLLOWS THE FINGER and TRACKS THE ROUTE.
  const [pressed,   setPressed]   = useState(false);
  const [dragging,  setDragging]  = useState(false);
  const [dragIndex, setDragIndex] = useState(null);     // float, or null = route-driven
  const dragIndexRef   = useRef(null);
  const draggingRef    = useRef(false);
  const justDraggedRef = useRef(false);                 // swallow the click after a drag
  const startRef       = useRef({ x: 0, y: 0, id: null, captured: false });
  const rafRef         = useRef(0);                     // coalesce drag updates to 1/frame
  const lastXRef       = useRef(0);                     // latest finger X (read on release)

  const reducedMotion = useMemo(() => (
    typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ), []);
  const anim = reducedMotion ? "none" : undefined;

  const setDrag = useCallback((fi) => { dragIndexRef.current = fi; setDragIndex(fi); }, []);

  const fireTab = useCallback((idx) => {
    const tab = tabs[idx];
    if (tab?.action) { try { tab.action(); } catch {} }
  }, [tabs]);

  // Finger X → floating tab index, centring the lens under the finger.
  const floatIndexFromX = useCallback((clientX) => {
    const rect = pillRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return baseIndex;
    const slotW = rect.width / tabCount;
    const raw = (clientX - rect.left) / slotW - 0.5;
    return Math.max(0, Math.min(tabCount - 1, raw));
  }, [baseIndex, tabCount]);

  // Once the route catches up to a committed drag target, hand the lens back
  // to route-driven mode — no visible jump since the values already match.
  useEffect(() => {
    if (!draggingRef.current && dragIndex != null && Math.round(dragIndex) === baseIndex) {
      setDrag(null);
    }
  }, [baseIndex, dragIndex, setDrag]);

  const releaseCapture = useCallback((e) => {
    if (startRef.current.captured) {
      try { e.currentTarget.releasePointerCapture(startRef.current.id); } catch {}
      startRef.current.captured = false;
    }
  }, []);

  const onPointerDown = useCallback((e) => {
    if (isSearch) return;
    // Record the start but DON'T claim the gesture yet — a still finger stays
    // a tap, and a vertical move stays a page scroll (touch-action: pan-y).
    startRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId, captured: false };
    justDraggedRef.current = false;
    setPressed(true);
  }, [isSearch]);

  const onPointerMove = useCallback((e) => {
    if (isSearch) return;
    if (!draggingRef.current) {
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      // Become a drag only once horizontal intent is clear.
      if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return;
      draggingRef.current = true;
      setDragging(true);
      // Capture so the drag continues even past the pill's edges.
      try { e.currentTarget.setPointerCapture(e.pointerId); startRef.current.captured = true; } catch {}
    }
    // Coalesce to one lens update per animation frame — keeps the glass gliding
    // smoothly under a fast finger instead of re-rendering on every move event.
    lastXRef.current = e.clientX;
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        setDrag(floatIndexFromX(lastXRef.current));
      });
    }
  }, [isSearch, floatIndexFromX, setDrag]);

  const onPointerUp = useCallback((e) => {
    if (isSearch) return;
    setPressed(false);
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    if (draggingRef.current) {
      draggingRef.current = false;
      setDragging(false);
      justDraggedRef.current = true;   // suppress the synthesised click
      // Compute the target from the final finger position (robust even if a
      // move's rAF hadn't flushed yet) and soft-snap to the nearest tab.
      const target = Math.max(0, Math.min(tabCount - 1, Math.round(floatIndexFromX(lastXRef.current))));
      setDrag(target);                 // snap lens to nearest tab (glides), held until route catches up
      fireTab(target);                 // navigate
    }
    releaseCapture(e);
  }, [isSearch, tabCount, floatIndexFromX, setDrag, fireTab, releaseCapture]);

  const onPointerCancel = useCallback((e) => {
    if (isSearch) return;
    setPressed(false);
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    draggingRef.current = false;
    setDragging(false);
    setDrag(null);                     // snap back to the current route
    releaseCapture(e);
  }, [isSearch, setDrag, releaseCapture]);

  // Cancel any pending drag frame if the bar unmounts mid-gesture.
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // Tap → navigate. A click synthesised right after a drag is swallowed so we
  // never double-navigate; a genuine tap (no drag) always goes through.
  const onTabClick = useCallback((i) => {
    if (justDraggedRef.current) { justDraggedRef.current = false; return; }
    fireTab(i);
  }, [fireTab]);

  // What the lens shows, and which tab live-previews as active.
  const visualIndex = dragIndex != null ? dragIndex : baseIndex;
  const activeVisual = dragIndex != null ? Math.round(dragIndex) : baseIndex;

  const scaleFor = (i) => {
    if (i === activeVisual) return 1.16;
    if (dragging && Math.abs(i - activeVisual) === 1) return 1.05;
    return 1;
  };

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
            style={{ touchAction: "pan-y" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            <span
              className="lg-lens"
              aria-hidden="true"
              style={{
                width: `${slotPct}%`, left: `${visualIndex * slotPct}%`,
                transform: `scale(${pressed ? 1.05 : 1})`,
                transition: anim ?? (dragging
                  ? "left 0ms, transform 0.18s ease"
                  : "left 0.42s cubic-bezier(0.2,0.9,0.2,1), transform 0.3s cubic-bezier(0.2,0.9,0.2,1)"),
              }}
            />
            {tabs.map((t, i) => {
              const active = i === activeVisual;
              return (
                <button
                  key={t.key} type="button"
                  onClick={() => onTabClick(i)}
                  className="lg-tab"
                  aria-current={active ? "page" : undefined}
                  aria-label={t.label + (t.badge ? ` (${t.badge})` : "")}
                >
                  <span className="lg-tab-icon" style={{
                    transform: `scale(${scaleFor(i)})`,
                    transition: anim ?? "transform 0.22s cubic-bezier(0.34,1.56,0.64,1)",
                  }}>
                    <t.Icon size={22} strokeWidth={active ? 2.1 : 1.6}
                      style={{ color: active ? "var(--accent)" : "var(--text-muted)" }} />
                    {t.badge > 0 && <span className="lg-tab-badge" aria-hidden="true">{t.badge}</span>}
                  </span>
                  <span className="lg-tab-label" style={{
                    color: active ? "var(--accent)" : "var(--text-muted)",
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
