"use client";

// ============================================================
// ImmersiveLightbox — zoomable full-photo viewer for the pill sheet
// ============================================================
// Opened by tapping the immersive sheet's photo backdrop (when the
// sheet is collapsed). The backdrop shows photos full-bleed with
// object-fit: cover — edges get cropped. This lightbox is the
// "see everything" view: the photo fits INSIDE the screen with a
// visible frame (object-contain), so the whole piece — corners,
// border stitching — is on screen, and the customer can zoom into
// the details:
//
//   • pinch to zoom (1×–MAX_ZOOM, anchored on the pinch midpoint)
//   • double-tap to zoom into that spot / double-tap again to reset
//   • drag to pan while zoomed (clamped to the photo's edges)
//   • horizontal flick (unzoomed) = previous/next photo
//   • downward flick (unzoomed) = close — plus the X button + Escape
//
// All gestures are Pointer Events on one surface with
// touch-action:none, so the browser never page-zooms instead.
// PORTALS to document.body with z-index 70 — above the bottom-nav
// island (60) and the sheet root (45): a photo a customer is
// inspecting is a true modal.
//
// Plain <img> (not next/image) on purpose, mirroring the existing
// gallery zoom dialog: it only loads on explicit tap, and a handmade
// piece sells on full-resolution detail.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "../icons.jsx";
import { CONFIG } from "../../data/config.js";
import styles from "./ImmersiveLightbox.module.css";

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export interface ImmersiveLightboxProps {
  photos: string[];
  startIndex: number;
  title: string;
  reduced?: boolean;
  /** Called with the index in view, so the backdrop can stay in sync. */
  onClose: (lastIndex: number) => void;
}

type Pt = { x: number; y: number };

export function ImmersiveLightbox({ photos, startIndex, title, reduced = false, onClose }: ImmersiveLightboxProps) {
  const MAX_ZOOM: number = CONFIG.SHEET?.LIGHTBOX_MAX_ZOOM ?? 4;

  const [idx, setIdx] = useState(() => Math.min(Math.max(0, startIndex), photos.length - 1));
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  // Animate transform only for programmatic jumps (double-tap, reset) —
  // never mid-gesture, where the finger is the animation.
  const [gesturing, setGesturing] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Gesture bookkeeping — refs only, no re-render per move frame.
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<{
    mode: "none" | "pan" | "pinch";
    startScale: number;
    startTx: number;
    startTy: number;
    startDist: number;
    startMid: Pt;
    panStart: Pt;
    downAt: number;
    downPt: Pt;
    moved: number;
  }>({ mode: "none", startScale: 1, startTx: 0, startTy: 0, startDist: 0, startMid: { x: 0, y: 0 }, panStart: { x: 0, y: 0 }, downAt: 0, downPt: { x: 0, y: 0 }, moved: 0 });
  const lastTap = useRef<{ t: number; x: number; y: number }>({ t: 0, x: 0, y: 0 });

  // Clamp pan so the (scaled) photo can't be dragged past its own edges.
  const clampPan = useCallback((nextTx: number, nextTy: number, s: number): Pt => {
    const img = imgRef.current;
    const stage = stageRef.current;
    if (!img || !stage) return { x: nextTx, y: nextTy };
    const dispW = img.clientWidth * s;
    const dispH = img.clientHeight * s;
    const maxX = Math.max(0, (dispW - stage.clientWidth) / 2);
    const maxY = Math.max(0, (dispH - stage.clientHeight) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, nextTx)), y: Math.min(maxY, Math.max(-maxY, nextTy)) };
  }, []);

  const resetView = useCallback(() => { setScale(1); setTx(0); setTy(0); }, []);

  const step = useCallback((dir: 1 | -1) => {
    setIdx((i) => (i + dir + photos.length) % photos.length);
    resetView();
  }, [photos.length, resetView]);

  // Escape closes; focus starts on the close button (it's a dialog).
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(idx);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, idx, step]);

  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    setGesturing(true);
    if (pts.length === 2) {
      g.mode = "pinch";
      g.startScale = scale;
      g.startTx = tx;
      g.startTy = ty;
      g.startDist = Math.max(1, dist(pts[0], pts[1]));
      g.startMid = mid(pts[0], pts[1]);
    } else if (pts.length === 1) {
      g.mode = "pan";
      g.panStart = { x: e.clientX, y: e.clientY };
      g.startTx = tx;
      g.startTy = ty;
      g.downAt = Date.now();
      g.downPt = { x: e.clientX, y: e.clientY };
      g.moved = 0;
    }
  }, [scale, tx, ty]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];

    if (g.mode === "pinch" && pts.length >= 2) {
      const d = Math.max(1, dist(pts[0], pts[1]));
      const next = Math.min(MAX_ZOOM, Math.max(1, g.startScale * (d / g.startDist)));
      // Keep the pinch midpoint visually anchored while scaling:
      // t' = m − (m − t₀)·(s'/s₀), with the midpoint m relative to center.
      const stage = stageRef.current;
      const cx0 = stage ? stage.clientWidth / 2 : 0;
      const cy0 = stage ? stage.clientHeight / 2 : 0;
      const m = { x: g.startMid.x - cx0, y: g.startMid.y - cy0 };
      const ratio = next / g.startScale;
      const p = clampPan(m.x - (m.x - g.startTx) * ratio, m.y - (m.y - g.startTy) * ratio, next);
      setScale(next);
      setTx(p.x);
      setTy(p.y);
      return;
    }
    if (g.mode === "pan" && pts.length === 1) {
      const dx = e.clientX - g.panStart.x;
      const dy = e.clientY - g.panStart.y;
      g.moved = Math.max(g.moved, Math.hypot(e.clientX - g.downPt.x, e.clientY - g.downPt.y));
      if (scale > 1) {
        const p = clampPan(g.startTx + dx, g.startTy + dy, scale);
        setTx(p.x);
        setTy(p.y);
      }
    }
  }, [MAX_ZOOM, scale, clampPan]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    const remaining = pointers.current.size;

    if (remaining === 1) {
      // Pinch ended with one finger still down — hand off to pan cleanly.
      const [p] = [...pointers.current.values()];
      g.mode = "pan";
      g.panStart = { x: p.x, y: p.y };
      g.startTx = tx;
      g.startTy = ty;
      g.moved = 99; // a pinch is never a tap
      return;
    }
    if (remaining > 0) return;
    setGesturing(false);

    const dt = Date.now() - g.downAt;
    const dx = e.clientX - g.downPt.x;
    const dy = e.clientY - g.downPt.y;

    // Unzoomed flicks: horizontal = prev/next photo, downward = close.
    if (g.mode === "pan" && scale === 1 && g.moved >= 8) {
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 600) step(dx < 0 ? 1 : -1);
      else if (dy > 80 && dy > Math.abs(dx) * 1.4 && dt < 600) onClose(idx);
      g.mode = "none";
      return;
    }

    // Tap / double-tap (zoom toggle, anchored where they tapped).
    if (g.mode === "pan" && g.moved < 8 && dt < 350) {
      const now = Date.now();
      const isDouble = now - lastTap.current.t < 320 && Math.hypot(e.clientX - lastTap.current.x, e.clientY - lastTap.current.y) < 48;
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };
      if (isDouble) {
        lastTap.current.t = 0;
        if (scale > 1) resetView();
        else {
          const stage = stageRef.current;
          const cx0 = stage ? stage.clientWidth / 2 : 0;
          const cy0 = stage ? stage.clientHeight / 2 : 0;
          const m = { x: e.clientX - cx0, y: e.clientY - cy0 };
          const target = Math.min(MAX_ZOOM, 2.5);
          const p = clampPan(m.x * (1 - target), m.y * (1 - target), target);
          setScale(target);
          setTx(p.x);
          setTy(p.y);
        }
      }
    }
    g.mode = "none";
  }, [scale, tx, ty, idx, step, onClose, resetView, clampPan, MAX_ZOOM]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className={cx(styles.root, reduced && styles.reduced)}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — photo viewer`}
    >
      <div
        ref={stageRef}
        className={styles.stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={photos[idx]}
          alt={`${title} — photo ${idx + 1} of ${photos.length}, full view`}
          className={cx(styles.img, !gesturing && styles.imgAnimated)}
          style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
          draggable={false}
        />
      </div>

      <button
        ref={closeRef}
        type="button"
        className={styles.closeBtn}
        onClick={() => onClose(idx)}
        aria-label="Close photo viewer"
      >
        <X size={20} strokeWidth={1.75} />
      </button>

      {photos.length > 1 && scale === 1 && (
        <>
          <button type="button" className={cx(styles.navBtn, styles.navPrev)} onClick={() => step(-1)} aria-label="Previous photo">
            <ChevronLeft size={22} strokeWidth={1.75} />
          </button>
          <button type="button" className={cx(styles.navBtn, styles.navNext)} onClick={() => step(1)} aria-label="Next photo">
            <ChevronRight size={22} strokeWidth={1.75} />
          </button>
        </>
      )}

      <div className={styles.hint}>{scale > 1 ? "Drag to look around · double-tap to reset" : "Pinch or double-tap to zoom"}</div>
      <div className={styles.counter}>{idx + 1} / {photos.length}</div>
    </div>,
    document.body,
  );
}
