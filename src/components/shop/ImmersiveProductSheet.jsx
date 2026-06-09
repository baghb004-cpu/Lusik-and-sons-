"use client";

// ============================================================
// ImmersiveProductSheet — mobile-only Apple-Store product view
// ============================================================
// On phones, a live product page becomes: a FULL-SCREEN, swipeable
// photo backdrop with a draggable bottom sheet (the buy controls)
// floating over it. The sheet snaps between three "detents" (height
// stops) exactly like Apple Maps / Find My:
//
//   large     ~90vh   full buy card
//   medium    ~48vh   half-and-half: photo above, buy controls below
//   collapsed  66px   a floating "pill" (name + price + chevron) — the
//                     photo fills the whole screen behind it
//
//   - Drag the grabber to resize; release SNAPS to the nearest detent.
//   - A firm flick jumps a detent in that direction (velocity rule).
//   - The chosen detent is saved to localStorage (per product) and
//     restored next visit. Tap the collapsed pill to re-open.
//   - Honors prefers-reduced-motion (no transitions).
//
// DESKTOP renders NOTHING here (the wrapper is lg:hidden). ProductView
// renders the normal desktop surface separately; on mobile it renders
// THIS, with the buy surface passed as `children` in "immersive" mode
// (its own photo gallery suppressed, since the photos are the backdrop).
//
// All tunables live in CONFIG.SHEET; the whole feature is killable via
// CONFIG.SHEET.IMMERSIVE_ENABLED. SSR-safe: nothing touches window /
// localStorage / matchMedia during render — only inside effects and
// touch handlers (mirrors BottomSheet.jsx).
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CONFIG } from "../../data/config.js";
import { ChevronUp, ChevronDown, ChevronLeft } from "../icons.jsx";

const ORDER = ["collapsed", "medium", "large"];

export function ImmersiveProductSheet({
  photos = [],
  productName = "",
  priceLabel = "",
  storageKey = "default",
  onBack,
  children,
}) {
  const S = CONFIG.SHEET;

  // Detent height in CSS units (SSR-safe — no window during render).
  const detentCss = (name) =>
    name === "collapsed" ? `${S.COLLAPSED_PX}px`
    : name === "medium" ? `${S.MEDIUM_VH}vh`
    : `${S.LARGE_VH}vh`;

  const [detent, setDetent] = useState(S.DEFAULT_DETENT);
  const [dragH, setDragH] = useState(null);   // px height while dragging, else null
  const [dragging, setDragging] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);

  const drag = useRef(null);                   // { startY, startH, lastY, lastT, vel }
  const galleryRef = useRef(null);

  // Restore the saved detent + reduced-motion preference after mount.
  useEffect(() => {
    setReduced(!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    try {
      const saved = localStorage.getItem(`${S.STORAGE_PREFIX}:${storageKey}`);
      if (saved && ORDER.includes(saved)) setDetent(saved);
    } catch { /* private mode etc. — keep default */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = useCallback((name) => {
    try { localStorage.setItem(`${S.STORAGE_PREFIX}:${storageKey}`, name); } catch { /* ignore */ }
  }, [S.STORAGE_PREFIX, storageKey]);

  const snapTo = useCallback((name) => {
    setDetent(name);
    setDragH(null);
    persist(name);
  }, [persist]);

  // px heights of each detent, for snapping math (client only).
  const heightsPx = () => {
    const vh = window.innerHeight / 100;
    return { collapsed: S.COLLAPSED_PX, medium: S.MEDIUM_VH * vh, large: S.LARGE_VH * vh };
  };

  // ---- drag the grabber/header ----
  const onTouchStart = useCallback((e) => {
    const t = e.touches?.[0];
    if (!t) return;
    const h = heightsPx()[detent];
    drag.current = { startY: t.clientY, startH: h, lastY: t.clientY, lastT: Date.now(), vel: 0 };
    setDragging(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detent]);

  const onTouchMove = useCallback((e) => {
    if (!drag.current) return;
    if (e.touches.length > 1) { drag.current = null; setDragging(false); setDragH(null); return; }
    const t = e.touches[0];
    const H = heightsPx();
    const next = Math.max(H.collapsed, Math.min(H.large, drag.current.startH - (t.clientY - drag.current.startY)));
    const now = Date.now(), dt = now - drag.current.lastT;
    if (dt > 0) drag.current.vel = (t.clientY - drag.current.lastY) / dt; // +down / -up
    drag.current.lastY = t.clientY; drag.current.lastT = now;
    setDragH(next);
    if (e.cancelable) e.preventDefault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!drag.current) return;
    const { vel } = drag.current;
    const H = heightsPx();
    const h = dragH ?? H[detent];
    let target;
    if (vel > S.FLICK_VELOCITY_PX_MS) target = h > H.medium ? "medium" : "collapsed";       // flick down
    else if (vel < -S.FLICK_VELOCITY_PX_MS) target = h < H.medium ? "medium" : "large";     // flick up
    else {
      // snap to nearest of the three
      target = [["collapsed", H.collapsed], ["medium", H.medium], ["large", H.large]]
        .sort((a, b) => Math.abs(a[1] - h) - Math.abs(b[1] - h))[0][0];
    }
    drag.current = null;
    setDragging(false);
    snapTo(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragH, detent, snapTo]);

  // Tapping the collapsed pill (or the chevron) cycles open.
  const toggle = useCallback(() => {
    snapTo(detent === "collapsed" ? "medium" : detent === "medium" ? "large" : "collapsed");
  }, [detent, snapTo]);

  const collapsed = detent === "collapsed";
  const pill = collapsed && !dragging; // float as a pill only when settled collapsed

  // Track which photo is centered in the backdrop (for the dots).
  const onGalleryScroll = useCallback(() => {
    const el = galleryRef.current;
    if (!el) return;
    setPhotoIdx(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  const sheetHeight = dragH != null ? `${dragH}px` : detentCss(detent);
  const transition = (dragging || reduced)
    ? "none"
    : "height .42s cubic-bezier(.32,1.4,.5,1), left .42s cubic-bezier(.32,1.4,.5,1), right .42s cubic-bezier(.32,1.4,.5,1), bottom .42s cubic-bezier(.32,1.4,.5,1), border-radius .35s ease";

  return (
    <div className="lg:hidden fixed inset-0 z-[60]" style={{ background: "var(--ink, #1A1612)" }}>
      {/* FULL-SCREEN PHOTO BACKDROP — horizontal scroll-snap, page dots */}
      <div
        ref={galleryRef}
        onScroll={onGalleryScroll}
        className="absolute inset-0 flex overflow-x-auto"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
      >
        {photos.map((src, i) => (
          <div key={i} className="relative shrink-0 w-full h-full" style={{ scrollSnapAlign: "center" }}>
            {/* Plain <img> (not next/image): a few full-screen photos, lazy
                after the first, object-cover to fill the viewport. */}
            <img
              src={src}
              alt={`${productName} — photo ${i + 1}`}
              className="w-full h-full object-cover"
              loading={i === 0 ? "eager" : "lazy"}
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* TOP BAR — back button + title over a soft gradient */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center gap-2.5 px-4 z-10"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
          paddingBottom: 14,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.42), rgba(0,0,0,0))",
        }}
      >
        <button
          type="button"
          onClick={() => (onBack ? onBack() : window.history.back())}
          aria-label="Back"
          className="grid place-items-center rounded-full active:scale-95 transition-transform"
          style={{ width: 36, height: 36, background: "rgba(255,255,255,0.86)", color: "#222" }}
        >
          <ChevronLeft size={20} strokeWidth={2} />
        </button>
        <span className="font-display text-lg" style={{ color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
          {productName}
        </span>
      </div>

      {/* PHOTO DOTS — sit just above the sheet's top edge */}
      {photos.length > 1 && (
        <div
          className="absolute left-0 right-0 flex justify-center gap-2 z-10 pointer-events-none"
          style={{
            bottom: collapsed ? `calc(${S.COLLAPSED_PX}px + 28px)` : `calc(${detentCss(detent)} + 12px)`,
            transition: reduced ? "none" : "bottom .42s cubic-bezier(.32,1.4,.5,1)",
          }}
        >
          {photos.map((_, i) => (
            <span key={i} className="rounded-full" style={{
              width: 7, height: 7,
              background: i === photoIdx ? "#fff" : "rgba(255,255,255,0.5)",
            }} />
          ))}
        </div>
      )}

      {/* THE SHEET */}
      <div
        className="absolute flex flex-col overflow-hidden"
        style={{
          left: pill ? 14 : 0,
          right: pill ? 14 : 0,
          bottom: pill ? "calc(env(safe-area-inset-bottom, 0px) + 18px)" : 0,
          height: sheetHeight,
          background: "var(--bg-surface, #fffdf8)",
          borderRadius: pill ? 30 : "26px 26px 0 0",
          boxShadow: "0 -10px 40px -10px rgba(0,0,0,0.4)",
          transition,
          touchAction: "none",
          willChange: "height",
        }}
      >
        {/* GRABBER + PILL ROW — the drag handle (and, when collapsed, the
            whole tappable pill). */}
        <div
          className="flex-shrink-0"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <div className="pt-2.5 pb-1.5">
            <div className="mx-auto rounded-full" style={{ width: 42, height: 5, background: "rgba(26,22,18,0.22)" }} />
          </div>
          <button
            type="button"
            onClick={toggle}
            className="w-full flex items-center gap-3 px-5 pb-3 text-left"
            aria-label={collapsed ? "Expand product details" : "Collapse"}
          >
            <span className="font-medium text-[0.95rem]" style={{ color: "var(--text-primary, #1A1612)" }}>
              {productName}
            </span>
            {priceLabel && (
              <span className="ml-auto font-bold" style={{ color: "var(--accent, #b54a62)" }}>{priceLabel}</span>
            )}
            <span style={{ color: "var(--text-primary, #7d5a93)", marginLeft: priceLabel ? 4 : "auto" }}>
              {detent === "large" ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </span>
          </button>
        </div>

        {/* BUY CONTROLS (the surface, in immersive mode). Hidden when the
            sheet is collapsed to the pill. */}
        <div
          className="overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),20px)]"
          style={{
            overscrollBehaviorY: "contain",
            opacity: collapsed ? 0 : 1,
            pointerEvents: collapsed ? "none" : "auto",
            transition: reduced ? "none" : "opacity .2s ease",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
