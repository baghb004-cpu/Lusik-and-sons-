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

  // ── GESTURE STATE MACHINE ────────────────────────────────
  // Default mode is ROUTE-DRIVEN: the lens sits at `baseIndex`. While a finger
  // is actively dragging, `dragIndex` (a float) takes over. The instant the
  // finger lifts / the gesture is cancelled / capture is lost / the route
  // changes / the tab is hidden, resetGestureState() hard-returns to
  // route-driven. The lens can NEVER stay stuck in drag mode, and tapping
  // NEVER depends on drag state.
  const [pressed,   setPressed]   = useState(false);
  const [dragging,  setDragging]  = useState(false);   // for the transition only
  const [dragIndex, setDragIndex] = useState(null);    // float while dragging, else null

  const draggingRef      = useRef(false);              // source of truth (sync)
  const pointerIdRef     = useRef(null);               // the one pointer we track
  const startRef         = useRef({ x: 0, y: 0 });
  const capturedRef      = useRef(false);
  const rafRef           = useRef(0);
  const lastXRef         = useRef(0);
  const suppressClickRef = useRef(false);
  const suppressTimerRef = useRef(0);

  const reducedMotion = useMemo(() => (
    typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ), []);

  const fireTab = useCallback((idx) => {
    const tab = tabs[idx];
    if (tab?.action) { try { tab.action(); } catch {} }
  }, [tabs]);

  // Finger X → floating tab index, centring the lens under the finger.
  const floatIndexFromX = useCallback((clientX) => {
    const rect = pillRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return 0;
    const slotW = rect.width / tabCount;
    return Math.max(0, Math.min(tabCount - 1, (clientX - rect.left) / slotW - 0.5));
  }, [tabCount]);

  // THE single cleanup. Returns the bar to route-driven mode and frees every
  // live gesture resource. Idempotent — safe to call any number of times, from
  // anywhere (pointerup, cancel, lostcapture, route change, hide, unmount).
  const resetGestureState = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    if (capturedRef.current && pointerIdRef.current != null && pillRef.current) {
      try { pillRef.current.releasePointerCapture(pointerIdRef.current); } catch {}
    }
    capturedRef.current = false;
    pointerIdRef.current = null;
    draggingRef.current = false;
    setDragging(false);
    setDragIndex(null);
    setPressed(false);
  }, []);

  const onPointerDown = useCallback((e) => {
    if (isSearch) return;
    // Single active pointer only. If anything was left active from a prior
    // gesture that didn't end cleanly, hard-reset so it can't poison this one.
    if (pointerIdRef.current != null) resetGestureState();
    pointerIdRef.current = e.pointerId;
    startRef.current = { x: e.clientX, y: e.clientY };
    lastXRef.current = e.clientX;
    suppressClickRef.current = false;
    draggingRef.current = false;
    setPressed(true);
  }, [isSearch, resetGestureState]);

  const onPointerMove = useCallback((e) => {
    if (isSearch || e.pointerId !== pointerIdRef.current) return;
    if (!draggingRef.current) {
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      // Become a drag only once horizontal intent is clear — otherwise let the
      // page scroll vertically (touch-action: pan-y permits that).
      if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return;
      draggingRef.current = true;
      setDragging(true);
      try { pillRef.current?.setPointerCapture(e.pointerId); capturedRef.current = true; } catch {}
    }
    // One lens update per frame, even under a fast finger.
    lastXRef.current = e.clientX;
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        setDragIndex(floatIndexFromX(lastXRef.current));
      });
    }
  }, [isSearch, floatIndexFromX]);

  const onPointerUp = useCallback((e) => {
    if (isSearch || (pointerIdRef.current != null && e.pointerId !== pointerIdRef.current)) return;
    const wasDragging = draggingRef.current;
    const targetX = lastXRef.current;
    resetGestureState();                       // ALWAYS fully reset first
    if (wasDragging) {
      // Swallow the click the browser synthesises after a drag, then navigate.
      // resetGestureState() already set dragIndex=null; that + fireTab() batch
      // into one render so the lens lands on the new route with no backflicker.
      suppressClickRef.current = true;
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      suppressTimerRef.current = setTimeout(() => { suppressClickRef.current = false; }, 400);
      fireTab(Math.max(0, Math.min(tabCount - 1, Math.round(floatIndexFromX(targetX)))));
    }
  }, [isSearch, tabCount, floatIndexFromX, fireTab, resetGestureState]);

  const onPointerCancel = useCallback(() => { if (!isSearch) resetGestureState(); }, [isSearch, resetGestureState]);
  const onLostPointerCapture = useCallback(() => { resetGestureState(); }, [resetGestureState]);

  // Tap → navigate. A genuine tap (no preceding drag) always goes through; the
  // click synthesised right after a drag is swallowed exactly once.
  const onTabClick = useCallback((i) => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    fireTab(i);
  }, [fireTab]);

  // Route changed → snap the lens to the new route. (Can't fire mid-drag since
  // we only navigate on release.) This is the belt to the pointerup suspenders:
  // even if a tap navigates from elsewhere, the lens always re-syncs.
  useEffect(() => { resetGestureState(); }, [baseIndex, resetGestureState]);

  // Backgrounding / page hide can swallow pointerup — reset so we never resume
  // stuck. Also clears the suppress timer + resets on unmount.
  useEffect(() => {
    const onHide = () => resetGestureState();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      resetGestureState();
    };
  }, [resetGestureState]);

  const visualIndex  = dragIndex != null ? dragIndex : baseIndex;
  const activeVisual = dragIndex != null ? Math.round(dragIndex) : baseIndex;
  const anim = reducedMotion ? "none" : undefined;

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
            onLostPointerCapture={onLostPointerCapture}
          >
            <span
              className="lg-lens"
              aria-hidden="true"
              style={{
                width: `${slotPct}%`,
                transform: `translateX(${visualIndex * 100}%) scale(${pressed ? 1.05 : 1})`,
                transition: anim ?? (dragging
                  ? "transform 0ms"
                  : "transform 0.4s cubic-bezier(0.2, 0.9, 0.2, 1)"),
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
