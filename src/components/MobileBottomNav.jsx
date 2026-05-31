"use client";

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
//   SEARCH (not focused, bag has items):
//             ( 🛍2 )   [ 🔍  What are you looking for?   🎤 ]
//             └ orb ┘   └──────────── pill ───────────────┘
//
//   SEARCH (not focused, bag empty):
//             ( 🏠 )    [ 🔍  What are you looking for?   🎤 ]
//             └ orb ┘   └──────────── pill ───────────────┘
//             (home glyph → For You; flips to 🛍 the moment the bag fills)
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
import { useKeyboardOffset } from "../lib/useKeyboardOffset";

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
  // SSR-safe SpeechRecognition support flag. The module-level `SR` is null on
  // the server but truthy in the browser, so gating the mic button directly on
  // it rendered the button on the client only → hydration mismatch (React #418).
  // Start false (matches the server), then flip after mount.
  const [sttSupported, setSttSupported] = useState(false);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  const isFullSearch = isSearch && inputFocused;
  const kbOffset = useKeyboardOffset(isFullSearch);

  // Search opens UNFOCUSED (Apple Store style): the customer first sees the bag
  // shortcut / suggestions, and taps the field to bring up the keyboard. (No
  // auto-focus — that's what kept the X permanently visible and hid the bag.)
  useEffect(() => {
    if (!isSearch) setInputFocused(false);
  }, [isSearch]);

  useEffect(() => {
    setSttSupported(!!SR);
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

  // ── GESTURE MODEL ────────────────────────────────────────
  // Default = ROUTE-DRIVEN: the lens sits at `baseIndex`. While a finger drags
  // horizontally on the pill, `dragIndex` (a float) takes over; on release we
  // snap to the nearest tab + navigate, then fall back to route-driven.
  //
  // The drag uses NATIVE touch listeners (attached below with { passive:false })
  // rather than React's pointer/touch props, for two reasons that matter on iOS
  // Safari: (1) a non-passive touchmove lets us preventDefault the page scroll
  // so the bar wins the gesture, and (2) touch events self-capture to the start
  // element for the whole gesture — no flaky setPointerCapture. React's
  // synthetic pointer events were dropping moves on the device.
  const [pressed,   setPressed]   = useState(false);
  const [dragging,  setDragging]  = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const suppressClickRef = useRef(false);
  const suppressTimerRef = useRef(0);

  // SSR-safe: false on the server and the client's first render, then read the
  // real preference after mount so a reduced-motion machine doesn't mismatch.
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

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

  useEffect(() => {
    const el = pillRef.current;
    if (!el || isSearch) return;   // no drag in search mode

    // All live gesture state is local to the listener — nothing can leak between
    // gestures, so the bar can't get "stuck".
    let active = false, isDrag = false, sx = 0, sy = 0, lx = 0, raf = 0;
    const stopRaf = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

    const onStart = (e) => {
      const t = e.touches[0]; if (!t) return;
      active = true; isDrag = false;
      sx = t.clientX; sy = t.clientY; lx = t.clientX;
      suppressClickRef.current = false;
      setPressed(true);
    };
    const onMove = (e) => {
      if (!active) { return; }
      const t = e.touches[0]; if (!t) return;
      // Any move while a finger is down on the bar belongs to the bar: block the
      // page from scrolling in ANY direction. This is the belt to touch-action:
      // none (which older iOS Safari doesn't fully honour) — a non-passive
      // touchmove + preventDefault is the only thing that reliably stops it.
      if (e.cancelable) e.preventDefault();
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (!isDrag) {
        // Wait for clear horizontal intent before claiming it as a drag (so a
        // still finger stays a tap); the scroll is already blocked above.
        if (Math.abs(dx) < 6 || Math.abs(dx) <= Math.abs(dy)) return;
        isDrag = true;
        setDragging(true);
      }
      lx = t.clientX;
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        setDragIndex(floatIndexFromX(lx));
      });
    };
    const onEnd = () => {
      if (!active) return;
      const wasDrag = isDrag, x = lx;
      active = false; isDrag = false;
      stopRaf();
      setPressed(false);
      setDragging(false);
      setDragIndex(null);          // back to route-driven (batches with fireTab → no flicker)
      if (wasDrag) {
        suppressClickRef.current = true;   // swallow the click a drag would synthesise
        if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
        suppressTimerRef.current = setTimeout(() => { suppressClickRef.current = false; }, 400);
        fireTab(Math.max(0, Math.min(tabCount - 1, Math.round(floatIndexFromX(x)))));
      }
    };

    el.addEventListener("touchstart",  onStart, { passive: true });
    el.addEventListener("touchmove",   onMove,  { passive: false });
    el.addEventListener("touchend",    onEnd,   { passive: true });
    el.addEventListener("touchcancel", onEnd,   { passive: true });
    return () => {
      el.removeEventListener("touchstart",  onStart);
      el.removeEventListener("touchmove",   onMove);
      el.removeEventListener("touchend",    onEnd);
      el.removeEventListener("touchcancel", onEnd);
      stopRaf();
    };
  }, [isSearch, fireTab, floatIndexFromX, tabCount]);

  // Tap → navigate. A genuine tap always goes through; the click synthesised
  // right after a drag is swallowed exactly once.
  const onTabClick = useCallback((i) => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    fireTab(i);
  }, [fireTab]);

  // Any route change → lens snaps to the new route; nothing can stay stuck on a
  // stale index (belt-and-suspenders alongside the on-release reset).
  useEffect(() => {
    setDragIndex(null);
    setDragging(false);
    setPressed(false);
  }, [baseIndex]);

  useEffect(() => () => { if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current); }, []);

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
      {sttSupported && (
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
          {/* Detached orb — three states, driven by the LIVE bag count
              (single element so the search input never remounts; only
              order + content change):
                • typing/focused              → X (right) → dismiss the keyboard
                • not focused, bag has items  → bag + badge (left) → open Bag
                • not focused, bag is empty   → For You / home (left) → go to For You

              The empty-bag case shows the home icon (not an X) so the
              affordance is obvious — tapping it lands on the For You page.
              Because the icon keys off cartCount, it flips back to the home
              glyph the moment the bag is emptied; it can't stay stuck on Bag. */}
          <button
            type="button"
            className="lg-nav-orb"
            style={{ order: isFullSearch ? 1 : -1 }}
            onClick={isFullSearch ? closeSearch : (cartCount > 0 ? onCart : onHome)}
            aria-label={isFullSearch ? "Dismiss keyboard" : (cartCount > 0 ? "Open bag" : "Go to the For You page")}
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
              <span style={{ color: "var(--text-primary)" }}>
                <Home size={22} strokeWidth={1.7} />
              </span>
            )}
          </button>
          {searchPill}
        </>
      ) : (
        <>
          {/* NORMAL: 4-tab frosted pill + detached Search orb */}
          <div
            ref={pillRef}
            className="lg-nav-pill lg-nav-pill--tabs"
            style={{ touchAction: "none", overscrollBehavior: "contain" }}
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
                // Drop the (expensive) moving backdrop-filter while a finger
                // drags so the glass tracks smoothly; it restores on release.
                ...(dragging ? { backdropFilter: "none", WebkitBackdropFilter: "none" } : null),
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
