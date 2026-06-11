// ============================================================
// ImmersiveProduct — the pill-sheet product page (Chunk 2)
// ============================================================
// The JS sibling of ios/LusikSons/Views/ImmersiveProductView.swift
// (itself the native sibling of the website's ImmersiveBuySheet):
// a full-screen swipeable photo backdrop with a draggable buy sheet
// snapping between three detents — collapsed pill / medium / expanded.
//
//   • drag with spring snapping; a fast flick (|v| > 0.6 px/ms)
//     jumps a detent
//   • tap the pill row to cycle collapsed → medium → expanded → …
//   • photo-tap contract: sheet up + tap photo → collapse to the
//     pill; sheet collapsed + tap photo → open the photo viewer
//     (Chunk 3 makes it zoomable)
//   • per-product detent memory; the global "gesture learned" flag
//     retires the breathe teaching hint (seen isn't learned; used is)
//   • reduced-motion honored (no springs, no hint)
//   • THE OPEN BOOK (fold inner display / ≥700px): a two-page spread
//     instead — photos = left page, buy column = right page, no sheet
//
// The buy controls inside the sheet are the SAME ProductBuyControls
// the classic page uses — presentation differs, commerce never does.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ProductBuyControls } from "./ProductBuyControls.jsx";
import { PhotoLightbox } from "./PhotoLightbox.jsx";
import { useFoldLayout } from "../lib/useFoldLayout.js";

const COLLAPSED_PX = 64;
const FLICK_PX_MS = 0.6;
const DETENTS = ["collapsed", "medium", "expanded"];
const STORAGE_PREFIX = "lusik_sheet_detent_v1"; // web key parity
const LEARNED_KEY = "lusik_sheet_gesture_learned_v1";

const detentPx = (d, total) =>
  d === "collapsed" ? COLLAPSED_PX : d === "medium" ? total * 0.46 : total * 0.86;

export function ImmersiveProduct({ product, onBack }) {
  const { expanded: spread } = useFoldLayout();
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const rootRef = useRef(null);
  const galleryRef = useRef(null);

  const [detent, setDetent] = useState("medium");
  const [dragHeight, setDragHeight] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [viewerAt, setViewerAt] = useState(null); // photo index | null
  const [hinting, setHinting] = useState(false);

  // Per-product entry state. Hash navigation between two immersive
  // products KEEPS this component instance (same type, same position),
  // so every product change must restore its own remembered detent
  // (or the default — never the previous product's), rewind the
  // pager, and re-decide the breathe hint. iOS gets this for free
  // from fresh NavigationStack pushes.
  useEffect(() => {
    let saved = null;
    let learned = false;
    try {
      saved = localStorage.getItem(`${STORAGE_PREFIX}:${product.id}`);
      learned = localStorage.getItem(LEARNED_KEY) === "1";
    } catch { /* blocked storage — defaults below */ }
    setDetent(saved && DETENTS.includes(saved) ? saved : "medium");
    setDragHeight(null);
    setPhotoIndex(0);
    galleryRef.current?.scrollTo({ left: 0, behavior: "instant" });
    setHinting(!reduced && !spread && !learned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const snapTo = useCallback((d) => {
    setDetent(d);
    setDragHeight(null);
    setHinting(false); // a real gesture retires the hint for good
    try {
      localStorage.setItem(`${STORAGE_PREFIX}:${product.id}`, d);
      localStorage.setItem(LEARNED_KEY, "1");
    } catch { /* ignore */ }
  }, [product.id]);

  // ── drag machine (pointer capture on the grab handle) ──
  const drag = useRef(null);
  const lastCycleAt = useRef(0);

  const cycle = useCallback(() => {
    const now = Date.now();
    if (now - lastCycleAt.current < 350) return; // tap can arrive twice (pointerup + click)
    lastCycleAt.current = now;
    snapTo(detent === "collapsed" ? "medium" : detent === "medium" ? "expanded" : "collapsed");
  }, [detent, snapTo]);

  const onGrabDown = (e) => {
    setHinting(false);
    const total = rootRef.current?.clientHeight ?? window.innerHeight;
    drag.current = {
      startY: e.clientY,
      startH: detentPx(detent, total),
      lastY: e.clientY,
      lastT: Date.now(),
      vel: 0,
      moved: 0,
    };
    setDragHeight(detentPx(detent, total));
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onGrabMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const total = rootRef.current?.clientHeight ?? window.innerHeight;
    const next = Math.max(COLLAPSED_PX, Math.min(total * 0.92, d.startH + (d.startY - e.clientY)));
    const now = Date.now();
    if (now - d.lastT > 0) d.vel = (d.lastY - e.clientY) / (now - d.lastT); // +up / -down
    d.moved = Math.max(d.moved, Math.abs(e.clientY - d.startY));
    d.lastY = e.clientY;
    d.lastT = now;
    setDragHeight(next);
  };

  const onGrabUp = (e) => {
    const d = drag.current;
    if (!d) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    drag.current = null;
    if (d.moved < 6) {
      // A press that never really moved is a TAP — cycle the detents.
      setDragHeight(null);
      cycle();
      return;
    }
    const total = rootRef.current?.clientHeight ?? window.innerHeight;
    const cur = dragHeight ?? detentPx(detent, total);
    let target;
    if (d.vel > FLICK_PX_MS) target = cur > detentPx("medium", total) ? "expanded" : "medium";
    else if (d.vel < -FLICK_PX_MS) target = cur < detentPx("medium", total) ? "collapsed" : "medium";
    else {
      target = DETENTS.reduce((best, name) =>
        Math.abs(detentPx(name, total) - cur) < Math.abs(detentPx(best, total) - cur) ? name : best
      );
    }
    snapTo(target);
  };

  // ── photo gallery: index tracking + the detent-aware tap ──
  const onGalleryScroll = () => {
    const el = galleryRef.current;
    if (el) setPhotoIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };

  const galleryTap = useRef(null);
  const onGalleryDown = (e) => {
    galleryTap.current = {
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
      scrollLeft: galleryRef.current?.scrollLeft ?? 0,
    };
  };
  const onGalleryUp = (e) => {
    const start = galleryTap.current;
    galleryTap.current = null;
    if (!start) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    const scrolled = Math.abs((galleryRef.current?.scrollLeft ?? 0) - start.scrollLeft);
    if (moved >= 8 || scrolled >= 2 || Date.now() - start.t >= 450) return; // an honest swipe
    // Sheet up → show me the photos; already down (or on the spread,
    // where nothing is covered) → show me EVERYTHING (the viewer).
    if (!spread && detent !== "collapsed") snapTo("collapsed");
    else setViewerAt(photoIndex);
  };

  const dragging = dragHeight != null;
  const collapsed = detent === "collapsed" && !dragging && !spread;
  const sheetClass = [
    "imm-sheet",
    !dragging && `imm-${detent}`,
    dragging && "imm-dragging",
    reduced && "imm-reduced",
    hinting && !reduced && "imm-hinting",
  ].filter(Boolean).join(" ");

  const dotCount = Math.min(product.photoURLs.length, 14);
  const dotsBottom = spread
    ? "calc(var(--island-clearance) + 16px)"
    : `calc(var(--island-clearance) + ${dragging ? `${dragHeight}px` : detent === "collapsed" ? "76px" : detent === "medium" ? "46%" : "86%"} + 12px)`;

  return (
    <div ref={rootRef} className={["imm-root", spread && "imm-spread", reduced && "imm-reduced-root"].filter(Boolean).join(" ")}>
      <div
        ref={galleryRef}
        className="imm-gallery"
        onScroll={onGalleryScroll}
        onPointerDown={onGalleryDown}
        onPointerUp={onGalleryUp}
        aria-label={`${product.name} photos`}
      >
        {product.photoURLs.map((src, i) => (
          <img key={i} src={src} alt={`${product.name} — photo ${i + 1}`} loading={i < 2 ? "eager" : "lazy"} draggable={false} />
        ))}
      </div>

      <div className="imm-topbar">
        <button type="button" className="imm-back" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <span className="imm-title brand-display">{product.name}</span>
      </div>

      {dotCount > 1 && (
        <div className="imm-dots" style={{ bottom: dotsBottom }} aria-hidden="true">
          {Array.from({ length: dotCount }, (_, i) => (
            <span key={i} className={i === Math.min(photoIndex, dotCount - 1) ? "dot dot-active" : "dot"} />
          ))}
        </div>
      )}

      <div
        className={sheetClass}
        style={dragging && !spread ? { height: `${dragHeight}px` } : undefined}
        onAnimationEnd={(e) => { if (e.target === e.currentTarget) setHinting(false); }}
      >
        <div
          className="imm-grab"
          onPointerDown={spread ? undefined : onGrabDown}
          onPointerMove={spread ? undefined : onGrabMove}
          onPointerUp={spread ? undefined : onGrabUp}
          onPointerCancel={spread ? undefined : onGrabUp}
        >
          <div className="imm-grabber" />
          <button
            type="button"
            className="imm-pill-row"
            onClick={spread ? undefined : cycle}
            aria-label={collapsed ? "Expand product details" : "Collapse"}
          >
            <span className="imm-pill-name">{product.name}</span>
            <span className="imm-pill-price">${product.priceDollars}</span>
            <span className="imm-chevron" aria-hidden="true">{detent === "expanded" ? "⌄" : "⌃"}</span>
          </button>
        </div>

        <div className={collapsed ? "imm-body imm-body-hidden" : "imm-body"} aria-hidden={collapsed}>
          <ProductBuyControls product={product} />
        </div>
      </div>

      {viewerAt != null && (
        <PhotoLightbox
          photos={product.photoURLs}
          title={product.name}
          startIndex={viewerAt}
          reduced={reduced}
          onClose={(lastIndex) => {
            setViewerAt(null);
            setPhotoIndex(lastIndex);
            const el = galleryRef.current;
            if (el) el.scrollTo({ left: lastIndex * el.clientWidth, behavior: "instant" });
          }}
        />
      )}
    </div>
  );
}
