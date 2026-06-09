"use client";

// ============================================================
// ImmersiveBuySheet — mobile-only, production-safe immersive PDP
// ============================================================
// A full-screen swipeable photo backdrop with a draggable buy sheet
// that snaps between three detents (collapsed pill / medium / expanded),
// like Apple Maps / Find My. This is the safe, scoped rebuild of the
// standalone HTML prototype.
//
// Production-safety guarantees (by design):
//   • Scoped CSS module — no global html/body rules, no app-wide
//     overflow lock, no leaking element selectors, no hardcoded DOM ids.
//   • No window / localStorage / matchMedia / innerHeight read during
//     render — every browser-only read lives in a useEffect or an event
//     handler. SSR renders deterministic defaults.
//   • Drag uses Pointer Events + setPointerCapture, so move/up are
//     delivered to the grabber element itself — NO window/document
//     listeners to leak; React removes the handlers on unmount.
//   • Layers BELOW the bottom-nav island (z-index 45 < 60) and stops
//     above it (--imm-nav-clear), so the nav stays visible + usable.
//   • Heights in dvh (not vh) so the iOS address bar can't clip them.
//   • Honors prefers-reduced-motion.
//   • Photos come from the existing product image data and render through
//     next/image (the optimized pipeline) — no base64 copy-paste.
//
// It is presentational: the buy controls (the real product surface, in
// "immersive" mode) are passed as `children`, so Add-to-Bag / options /
// Stripe wiring stay exactly what the normal page uses. Desktop never
// mounts this (the parent gates on useIsMobile).
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronUp, ChevronDown, ChevronLeft } from "../icons.jsx";
import { CONFIG } from "../../data/config.js";
import styles from "./ImmersiveBuySheet.module.css";

type Detent = "collapsed" | "medium" | "expanded";
const ORDER: Detent[] = ["collapsed", "medium", "expanded"];
const COLLAPSED_PX = 64;

export interface ImmersiveBuySheetProps {
  photos: string[];
  title: string;
  priceLabel?: string;
  /** Per-product key so each product remembers its own detent. */
  storageKey: string;
  onBack?: () => void;
  children: React.ReactNode;
}

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export function ImmersiveBuySheet({
  photos,
  title,
  priceLabel,
  storageKey,
  onBack,
  children,
}: ImmersiveBuySheetProps) {
  const defaultDetent = (CONFIG.SHEET?.DEFAULT_DETENT as Detent) ?? "medium";
  const flickVel = CONFIG.SHEET?.FLICK_VELOCITY_PX_MS ?? 0.6;
  const storagePrefix = CONFIG.SHEET?.STORAGE_PREFIX ?? "lusik_sheet_detent_v1";

  const [detent, setDetent] = useState<Detent>(defaultDetent);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const galleryRef = useRef<HTMLDivElement | null>(null);
  // Live drag bookkeeping (refs, never state — no re-render per move frame).
  const drag = useRef<{ startY: number; startH: number; lastY: number; lastT: number; vel: number } | null>(null);

  const dragging = dragHeight != null;
  const collapsed = detent === "collapsed" && !dragging;

  // ── browser-only setup: restore detent + read reduced-motion ──
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    setReduced(!!mq?.matches);
    const onMq = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq?.addEventListener?.("change", onMq);

    try {
      const saved = localStorage.getItem(`${storagePrefix}:${storageKey}`);
      if (saved && (ORDER as string[]).includes(saved)) setDetent(saved as Detent);
    } catch {
      /* private mode / blocked storage — keep the default */
    }
    return () => mq?.removeEventListener?.("change", onMq);
  }, [storagePrefix, storageKey]);

  const persist = useCallback(
    (d: Detent) => {
      try {
        localStorage.setItem(`${storagePrefix}:${storageKey}`, d);
      } catch {
        /* ignore */
      }
    },
    [storagePrefix, storageKey],
  );

  const snapTo = useCallback(
    (d: Detent) => {
      setDetent(d);
      setDragHeight(null);
      persist(d);
    },
    [persist],
  );

  // Pixel heights for snap math, derived from the live viewport (read only
  // inside handlers — never during render).
  const detentPx = (d: Detent, h: number) =>
    d === "collapsed" ? COLLAPSED_PX : d === "medium" ? h * 0.46 : h * 0.86;

  // ── drag: pointer-capture means move/up land on this element ──
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const h = rootRef.current?.clientHeight ?? window.innerHeight;
      drag.current = {
        startY: e.clientY,
        startH: detentPx(detent, h),
        lastY: e.clientY,
        lastT: Date.now(),
        vel: 0,
      };
      setDragHeight(detentPx(detent, h));
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [detent],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const h = rootRef.current?.clientHeight ?? window.innerHeight;
    const next = Math.max(COLLAPSED_PX, Math.min(h * 0.92, d.startH + (d.startY - e.clientY)));
    const now = Date.now();
    const dt = now - d.lastT;
    if (dt > 0) d.vel = (d.lastY - e.clientY) / dt; // +up / -down
    d.lastY = e.clientY;
    d.lastT = now;
    setDragHeight(next);
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d) return;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      const h = rootRef.current?.clientHeight ?? window.innerHeight;
      const cur = dragHeight ?? detentPx(detent, h);
      const px = { collapsed: COLLAPSED_PX, medium: h * 0.46, expanded: h * 0.86 };
      let target: Detent;
      if (d.vel > flickVel) target = cur > px.medium ? "medium" : "expanded"; // flick up
      else if (d.vel < -flickVel) target = cur < px.medium ? "medium" : "collapsed"; // flick down
      else {
        target = ORDER.reduce((best, name) =>
          Math.abs(px[name] - cur) < Math.abs(px[best] - cur) ? name : best,
        );
      }
      drag.current = null;
      snapTo(target);
    },
    [dragHeight, detent, flickVel, snapTo],
  );

  const cycle = useCallback(() => {
    snapTo(detent === "collapsed" ? "medium" : detent === "medium" ? "expanded" : "collapsed");
  }, [detent, snapTo]);

  const onGalleryScroll = useCallback(() => {
    const el = galleryRef.current;
    if (!el) return;
    setActiveIdx(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  }, []);

  return (
    <div ref={rootRef} className={cx(styles.root, reduced && styles.reduced)}>
      {/* Full-screen swipeable photo backdrop (next/image, optimized) */}
      <div ref={galleryRef} className={styles.gallery} onScroll={onGalleryScroll}>
        {photos.map((src, i) => (
          <div key={i} className={styles.slide}>
            <Image
              src={src}
              alt={`${title} — photo ${i + 1}`}
              fill
              sizes="100vw"
              className={styles.slideImg}
              priority={i === 0}
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* Back + title */}
      <div className={styles.topbar}>
        <button
          type="button"
          className={styles.backBtn}
          aria-label="Back"
          onClick={() => (onBack ? onBack() : window.history.back())}
        >
          <ChevronLeft size={20} strokeWidth={2} />
        </button>
        <span className={styles.title}>{title}</span>
      </div>

      {/* Page dots — ride just above the sheet's top edge */}
      {photos.length > 1 && (
        <div
          className={styles.dots}
          style={{ bottom: `calc(var(--imm-nav-clear) + ${collapsed ? "76px" : dragging ? `${dragHeight}px` : detent === "medium" ? "46dvh" : "86dvh"} + 12px)` }}
        >
          {photos.map((_, i) => (
            <span key={i} className={cx(styles.dot, i === activeIdx && styles.dotActive)} />
          ))}
        </div>
      )}

      {/* The draggable sheet */}
      <div
        className={cx(
          styles.sheet,
          !dragging && styles[detent],
          dragging && styles.dragging,
          reduced && styles.reduced,
        )}
        style={dragging ? { height: `${dragHeight}px` } : undefined}
      >
        {/* Drag handle (and, collapsed, the whole tappable pill) */}
        <div
          className={styles.grab}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className={styles.grabber} />
          <button type="button" className={styles.pillRow} onClick={cycle} aria-label={collapsed ? "Expand product details" : "Collapse"}>
            <span className={styles.pillName}>{title}</span>
            {priceLabel ? <span className={styles.pillPrice}>{priceLabel}</span> : null}
            <span className={styles.chevron} style={!priceLabel ? { marginLeft: "auto" } : undefined}>
              {detent === "expanded" ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </span>
          </button>
        </div>

        {/* Buy controls (the real product surface, in immersive mode) */}
        <div className={cx(styles.body, collapsed && styles.bodyHidden)} aria-hidden={collapsed}>
          {children}
        </div>
      </div>
    </div>
  );
}
