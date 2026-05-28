// ============================================================
// MobileBottomNav — three-stage bottom bar
// ============================================================
// Stage 0 (normal):  5 frosted-glass tabs with lens + spring
// Stage 1 (search):  [&] icon + search input pill (collapsed)
// Stage 2 (focused):  search input only, full width, alone
//                     above the keyboard — nothing else visible
//
// Transitions between stages are animated. The search input
// uses 16px font at all times to prevent iOS Safari auto-zoom.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Home, Store, BookOpen, ShoppingBag, Search, Mic, X } from "./icons.jsx";

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

  // Stage 2 = search mode AND input is focused (keyboard is up)
  const isFullSearch = isSearch && inputFocused;

  // Auto-focus when entering search mode
  useEffect(() => {
    if (isSearch) {
      const t = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
    setInputFocused(false);
  }, [isSearch]);

  // Clean up speech recognition on unmount
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

  // ── Tab definitions (Stage 0) ──────────────────────────
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
    return Math.max(0, Math.min(tabCount - 1, Math.floor(x / slot)));
  }, [baseIndex, tabCount]);

  const xToOffset = useCallback((clientX, fromIndex) => {
    const rect = navRef.current?.getBoundingClientRect();
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
  const anim = reducedMotion ? "none" : undefined;

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
      {/* ── STAGE 0: normal 5-tab bar ─────────────────────── */}
      <span
        className={"lg-lens" + (pressed ? " lg-lens-pressed" : "")}
        aria-hidden="true"
        style={{
          width: `${slotPct}%`, left: `${lensIndex * slotPct}%`,
          transform: `translateX(${dragOffset}px)`,
          opacity: isSearch ? 0 : 1,
          transition: anim ?? (draggingRef.current
            ? "transform 0ms, left 0ms, opacity 0.2s"
            : "left 0.32s cubic-bezier(0.4,1.4,0.6,1), transform 0.32s cubic-bezier(0.4,1.4,0.6,1), opacity 0.2s"),
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
            tabIndex={isSearch ? -1 : 0}
            style={{
              opacity: isSearch ? 0 : 1,
              pointerEvents: isSearch ? "none" : "auto",
              transform: isSearch ? "scale(0.85)" : "scale(1)",
              transition: anim ?? "opacity 0.2s, transform 0.25s ease",
            }}
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

      {/* ── STAGE 1 + 2: search bar ──────────────────────── */}
      <div
        aria-hidden={!isSearch}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 8px",
          opacity: isSearch ? 1 : 0,
          pointerEvents: isSearch ? "auto" : "none",
          transition: anim ?? "opacity 0.25s ease",
        }}
      >
        {/* & icon OR cart bag icon — Stage 1 only (hidden when input is focused).
            When cartCount > 0, shows a ShoppingBag with a badge (tapping opens cart).
            When cartCount === 0, shows the "&" brand icon (tapping goes home). */}
        <button
          type="button"
          onClick={cartCount > 0 ? onCart : onHome}
          aria-label={cartCount > 0 ? `Cart (${cartCount} items)` : "Back to home"}
          style={{
            width: isFullSearch ? 0 : 42,
            height: 42,
            borderRadius: "50%",
            background: "var(--bg-surface, rgba(245,239,227,0.85))",
            border: "1px solid rgba(26,22,18,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            overflow: "hidden",
            opacity: isFullSearch ? 0 : 1,
            padding: 0,
            transition: anim ?? "width 0.25s ease, opacity 0.2s ease",
            position: "relative",
          }}
          tabIndex={isSearch && !isFullSearch ? 0 : -1}
        >
          {cartCount > 0 ? (
            <>
              <ShoppingBag size={18} strokeWidth={1.6} style={{ color: "#1A1612" }} />
              <span style={{
                position: "absolute",
                top: 2,
                right: 2,
                minWidth: 16,
                height: 16,
                padding: "0 4px",
                borderRadius: 9,
                background: "#B08842",
                color: "#F5EFE3",
                fontSize: "0.6rem",
                fontWeight: 600,
                lineHeight: "16px",
                textAlign: "center",
                boxShadow: "0 1px 2px rgba(26,22,18,0.18)",
              }}>{cartCount}</span>
            </>
          ) : (
            <span style={{
              fontFamily: "Fraunces, Georgia, serif",
              fontSize: "1.2rem", fontWeight: 600, color: "#B08842", lineHeight: 1,
            }}>&amp;</span>
          )}
        </button>

        {/* Search input — full-width pill, 16px font (no iOS zoom) */}
        <div style={{ flex: 1, position: "relative", height: 44 }}>
          <span
            style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              pointerEvents: "none", color: "rgba(26,22,18,0.35)",
            }}
          >
            <Search size={18} strokeWidth={1.5} />
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
              width: "100%", height: "100%",
              borderRadius: 22,
              border: "1px solid rgba(26,22,18,0.12)",
              background: "rgba(245,239,227,0.6)",
              paddingLeft: 42,
              paddingRight: searchQuery ? 110 : 82,
              fontSize: "16px",
              fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
              fontWeight: 400,
              color: "var(--text-primary, #1A1612)",
              outline: "none",
              WebkitAppearance: "none",
              appearance: "none",
            }}
          />

          {/* Clear text button — only when there's query text */}
          {searchQuery && (
            <button
              type="button"
              onClick={() => { onSearchQueryChange?.(""); inputRef.current?.focus(); }}
              aria-label="Clear search text"
              style={{
                position: "absolute", right: SR ? 76 : 44, top: "50%",
                transform: "translateY(-50%)",
                width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                color: "rgba(26,22,18,0.4)", background: "transparent", border: "none", cursor: "pointer",
              }}
            >
              <span style={{ fontSize: "1.2rem", fontWeight: 300, lineHeight: 1 }}>&times;</span>
            </button>
          )}

          {/* Microphone — voice search */}
          {SR && (
            <button
              type="button"
              onClick={listening ? () => { try { recognitionRef.current?.stop(); } catch {} setListening(false); } : startVoice}
              aria-label={listening ? "Stop listening" : "Search by voice"}
              style={{
                position: "absolute", right: 42, top: "50%",
                transform: "translateY(-50%)",
                width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "50%",
                background: listening ? "rgba(176,136,66,0.15)" : "transparent",
                border: "none", cursor: "pointer",
                color: listening ? "#B08842" : "rgba(26,22,18,0.35)",
                transition: "color 0.2s, background 0.2s",
              }}
            >
              <Mic size={18} strokeWidth={1.5} />
            </button>
          )}

          {/* X (close) — dismisses keyboard + exits search mode.
              Always visible in search mode. Matches the Apple Store's
              X button to the right of the mic. */}
          <button
            type="button"
            onClick={() => {
              inputRef.current?.blur();
              onSearchQueryChange?.("");
              try { recognitionRef.current?.stop(); } catch {}
              setListening(false);
              onHome?.();
            }}
            aria-label="Close search"
            tabIndex={isSearch ? 0 : -1}
            style={{
              position: "absolute", right: 6, top: "50%",
              transform: "translateY(-50%)",
              width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: "50%",
              background: "rgba(26,22,18,0.08)",
              border: "none", cursor: "pointer",
              color: "rgba(26,22,18,0.5)",
            }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </nav>
  );
}
