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
import { createPortal } from "react-dom";
import Image from "next/image";
import { ChevronUp, ChevronDown, ChevronLeft } from "../icons.jsx";
import { CONFIG } from "../../data/config.js";
import { ImmersiveLightbox } from "./ImmersiveLightbox";
import styles from "./ImmersiveBuySheet.module.css";

type Detent = "collapsed" | "medium" | "expanded";
const ORDER: Detent[] = ["collapsed", "medium", "expanded"];
const COLLAPSED_PX = 64;

// "The open book" — the iPhone Fold's 7.8" 4:3 inner display (and any
// 700–1023px canvas; ≥1024 never mounts this component). The module CSS
// splits the page along the fold: photos = left page, buy column = right
// page, detents visually neutralized. This query MUST stay in lockstep
// with the media query at the bottom of ImmersiveBuySheet.module.css.
// The viewport-segments clause catches browsers that report fold posture
// directly. The Fold's 5.5" cover screen stays on the pill sheet.
// The second clause is the SHORT-LANDSCAPE catch: phones rotated
// sideways (e.g. 667×375, 844×390) have no room for a stacked pill
// sheet — the spread is the right shape there too.
const SPREAD_QUERY =
  "(min-width: 700px) and (max-width: 1023.98px), (min-width: 560px) and (max-height: 480px), (horizontal-viewport-segments: 2)";

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
  // Open-book posture (see SPREAD_QUERY). SSR-safe: false on the server +
  // first client render; synced in the effect below.
  const [spread, setSpread] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // "Breathe" teaching hint: plays on every product open UNTIL the guest
  // moves the sheet themselves once (then never again — the learned
  // marker is set in snapTo, which only user gestures reach). Seen isn't
  // learned; used once is.
  const [hinting, setHinting] = useState(false);
  const learnedKey: string = CONFIG.SHEET?.HINT_LEARNED_KEY ?? "lusik_sheet_gesture_learned_v1";
  // Portal mount gate — also our SSR guard (document isn't available on
  // the server; the first client render returns null, then the portal
  // mounts). See the createPortal note at the bottom for WHY a portal.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const galleryRef = useRef<HTMLDivElement | null>(null);
  // Live drag bookkeeping (refs, never state — no re-render per move frame).
  // `moved` tracks the largest |Δy| of the gesture so pointer-up can tell a
  // TAP from a drag. lastCycleAt debounces cycle() because a tap can reach it
  // twice: once from the pointer-up tap branch and once from the pill
  // button's own click event (whether the click fires depends on pointer
  // capture retargeting, which varies by input type).
  const drag = useRef<{ startY: number; startH: number; lastY: number; lastT: number; vel: number; moved: number } | null>(null);
  const lastCycleAt = useRef(0);

  const dragging = dragHeight != null;
  // On the spread the buy column is always fully visible — "collapsed"
  // must not hide the body or mislead assistive tech, whatever detent a
  // phone session left behind in storage.
  const collapsed = detent === "collapsed" && !dragging && !spread;

  // ── browser-only setup: restore detent + read reduced-motion ──
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    setReduced(!!mq?.matches);
    const onMq = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq?.addEventListener?.("change", onMq);

    // Open-book posture (iPhone Fold inner display / 700–1023px canvas).
    // Live-updates so folding/unfolding mid-visit re-lays-out correctly.
    const spreadMq = window.matchMedia?.(SPREAD_QUERY);
    setSpread(!!spreadMq?.matches);
    const onSpreadMq = (e: MediaQueryListEvent) => setSpread(e.matches);
    spreadMq?.addEventListener?.("change", onSpreadMq);

    try {
      const saved = localStorage.getItem(`${storagePrefix}:${storageKey}`);
      if (saved && (ORDER as string[]).includes(saved)) setDetent(saved as Detent);
    } catch {
      /* private mode / blocked storage — keep the default */
    }
    try {
      if (
        CONFIG.SHEET?.BREATHE_HINT &&
        !mq?.matches &&
        !spreadMq?.matches &&   // no sheet to teach on the spread
        localStorage.getItem(learnedKey) !== "1"
      ) {
        setHinting(true);
      }
    } catch {
      /* blocked storage — hint anyway; it's harmless and self-clearing */
      if (CONFIG.SHEET?.BREATHE_HINT && !mq?.matches && !spreadMq?.matches) setHinting(true);
    }
    return () => {
      mq?.removeEventListener?.("change", onMq);
      spreadMq?.removeEventListener?.("change", onSpreadMq);
    };
  }, [storagePrefix, storageKey, learnedKey]);

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
      // Only user gestures (drag, flick, pill tap, photo tap) reach here —
      // the guest has now moved the sheet themselves, so the breathe hint
      // has done its job for good.
      setHinting(false);
      try {
        localStorage.setItem(learnedKey, "1");
      } catch {
        /* blocked storage — they'll just see the hint again next visit */
      }
    },
    [persist, learnedKey],
  );

  // Pixel heights for snap math, derived from the live viewport (read only
  // inside handlers — never during render).
  const detentPx = (d: Detent, h: number) =>
    d === "collapsed" ? COLLAPSED_PX : d === "medium" ? h * 0.46 : h * 0.86;

  // ── drag: pointer-capture means move/up land on this element ──
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Grabbing the sheet mid-breath: the finger takes over instantly —
      // a hint animation must never fight a real gesture.
      setHinting(false);
      const h = rootRef.current?.clientHeight ?? window.innerHeight;
      drag.current = {
        startY: e.clientY,
        startH: detentPx(detent, h),
        lastY: e.clientY,
        lastT: Date.now(),
        vel: 0,
        moved: 0,
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
    d.moved = Math.max(d.moved, Math.abs(e.clientY - d.startY));
    d.lastY = e.clientY;
    d.lastT = now;
    setDragHeight(next);
  }, []);

  // Tap-to-cycle the detents. Debounced because a tap can arrive twice
  // (pointer-up tap branch + the pill button's click) — see drag ref note.
  const cycle = useCallback(() => {
    const now = Date.now();
    if (now - lastCycleAt.current < 350) return;
    lastCycleAt.current = now;
    snapTo(detent === "collapsed" ? "medium" : detent === "medium" ? "expanded" : "collapsed");
  }, [detent, snapTo]);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d) return;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      drag.current = null;
      // A press that never really moved is a TAP, not a drag — treat it as
      // tap-to-cycle (Find My behavior). Pointer capture on this handle can
      // retarget the click away from the pill button, so the button's own
      // onClick can't be relied on for touch; this branch covers it.
      if (d.moved < 6) {
        setDragHeight(null);
        cycle();
        return;
      }
      const h = rootRef.current?.clientHeight ?? window.innerHeight;
      const cur = dragHeight ?? detentPx(detent, h);
      const px = { collapsed: COLLAPSED_PX, medium: h * 0.46, expanded: h * 0.86 };
      let target: Detent;
      // A flick jumps one detent in the flick's direction: up from at-or-above
      // medium reaches expanded; down from at-or-below medium reaches collapsed.
      // (These arms were inverted once — a flick from medium snapped back to
      // medium — so mind the orientation: cur is a HEIGHT, bigger = taller.)
      if (d.vel > flickVel) target = cur > px.medium ? "expanded" : "medium"; // flick up
      else if (d.vel < -flickVel) target = cur < px.medium ? "collapsed" : "medium"; // flick down
      else {
        target = ORDER.reduce((best, name) =>
          Math.abs(px[name] - cur) < Math.abs(px[best] - cur) ? name : best,
        );
      }
      snapTo(target);
    },
    [dragHeight, detent, flickVel, snapTo, cycle],
  );

  const onGalleryScroll = useCallback(() => {
    const el = galleryRef.current;
    if (!el) return;
    setActiveIdx(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  }, []);

  // ── tap on the photo backdrop, detent-aware ──
  // The card can hide the photos, and the most natural instinct (watch
  // anyone's grandparent) is to tap the picture peeking out behind it.
  // So: sheet up → a photo tap COLLAPSES the sheet to the pill ("show me
  // the photos"); sheet already collapsed → a photo tap opens the
  // zoomable lightbox (the full-photo, see-the-corners view). A real
  // swipe (horizontal photo browsing, or any honest scroll) is never
  // mistaken for a tap: we require <8px finger travel AND an unmoved
  // scroll position AND a short press.
  const galleryTap = useRef<{ x: number; y: number; t: number; scrollLeft: number } | null>(null);
  const onGalleryPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    galleryTap.current = {
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
      scrollLeft: galleryRef.current?.scrollLeft ?? 0,
    };
  }, []);
  const onGalleryPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const start = galleryTap.current;
    galleryTap.current = null;
    if (!start) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    const scrolled = Math.abs((galleryRef.current?.scrollLeft ?? 0) - start.scrollLeft);
    if (moved >= 8 || scrolled >= 2 || Date.now() - start.t >= 450) return;
    // On the spread nothing covers the photos, so the collapse step is
    // meaningless — a photo tap goes straight to the lightbox.
    if (!spread && detent !== "collapsed") snapTo("collapsed");
    else setLightboxOpen(true);
  }, [detent, snapTo, spread]);

  // Closing the lightbox hands back the photo they were on, so the
  // backdrop + dots pick up exactly where they left off.
  const onLightboxClose = useCallback((lastIndex: number) => {
    setLightboxOpen(false);
    setActiveIdx(lastIndex);
    const el = galleryRef.current;
    if (el) el.scrollTo({ left: lastIndex * el.clientWidth, behavior: "instant" as ScrollBehavior });
  }, []);

  // Rendered through a PORTAL to document.body: the route subtree sits
  // inside a page-transition wrapper with `will-change: transform`, which
  // (per spec) makes that wrapper the containing block for position:fixed
  // descendants — the sheet would anchor to the wrapper's box instead of
  // the viewport and render hundreds of px off-screen. Portaling out of
  // the route subtree restores true viewport anchoring, immune to any
  // future ancestor transform/filter. `mounted` gates SSR (no document on
  // the server; the parent's isMobile gate already implies client-side).
  if (!mounted) return null;
  return createPortal(
    <div ref={rootRef} className={cx(styles.root, reduced && styles.reduced)}>
      {/* Full-screen swipeable photo backdrop (next/image, optimized).
          Tap behavior is detent-aware — see onGalleryPointerUp. */}
      <div
        ref={galleryRef}
        className={styles.gallery}
        onScroll={onGalleryScroll}
        onPointerDown={onGalleryPointerDown}
        onPointerUp={onGalleryPointerUp}
      >
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
          {/* Cap the row at 12 dots — a 61-photo set would otherwise paint
              a full-width dotted line (the counter in the lightbox carries
              exact position; dots are a gesture cue, not a scrubber). */}
          {photos.slice(0, 12).map((_, i) => (
            <span key={i} className={cx(styles.dot, Math.min(activeIdx, 11) === i && styles.dotActive)} />
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
          hinting && styles.hinting,
        )}
        style={dragging ? { height: `${dragHeight}px` } : undefined}
        onAnimationEnd={(e) => {
          // animationend BUBBLES — the content's own fade-in inside the
          // sheet would clear the hint before it even played. Only the
          // sheet's breathe (target === this div) counts.
          if (e.target === e.currentTarget) setHinting(false);
        }}
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

      {/* Zoomable full-photo viewer (its own body portal, z 70) */}
      {lightboxOpen && (
        <ImmersiveLightbox
          photos={photos}
          startIndex={activeIdx}
          title={title}
          reduced={reduced}
          onClose={onLightboxClose}
        />
      )}
    </div>,
    document.body,
  );
}
