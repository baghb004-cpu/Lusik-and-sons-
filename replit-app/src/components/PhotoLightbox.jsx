// ============================================================
// PhotoLightbox — the zoomable photo viewer (Chunk 3)
// ============================================================
// The JS sibling of ios/LusikSons/Views/PhotoViewer.swift (and the
// website's ImmersiveLightbox): the see-the-corners view behind the
// immersive page's photo-tap contract.
//
//   • pinch to zoom 1×–4×, anchored on the pinch midpoint
//   • double-tap 2.5× into the tapped spot / double-tap to reset
//   • pan clamped to the photo's rendered edges when zoomed
//   • sideways scroll-snap paging between photos when unzoomed
//   • pull-down-to-close when unzoomed (past 90px lets go)
//   • ✕ / Escape close; counter + the web's hint copy
//   • reduced-motion: no animated transitions
//
// Gesture notes: slides declare `touch-action: pan-x`, so the browser
// keeps native horizontal paging while vertical drags and pinches
// arrive as pointer events (a claimed horizontal swipe cancels our
// gesture via pointercancel — exactly what we want). When zoomed, the
// container's `lightbox-zoomed` class flips slides to
// `touch-action: none` and one finger pans the photo instead.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const PULL_CLOSE_PX = 90;

export function PhotoLightbox({ photos, title, startIndex = 0, reduced = false, onClose }) {
  const pagerRef = useRef(null);
  const imgRefs = useRef([]);
  const [index, setIndex] = useState(startIndex);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const [pull, setPull] = useState(0);
  const [animating, setAnimating] = useState(false);

  const zoomed = view.scale > 1.001;

  // Land on the photo that was tapped.
  useEffect(() => {
    const el = pagerRef.current;
    if (el) el.scrollTo({ left: startIndex * el.clientWidth, behavior: "instant" });
  }, [startIndex]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(index); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onClose]);

  // Clamp a translation so the photo's rendered edges pin to the
  // viewport edges (letterboxed photos don't pan on their short axis).
  const clamp = useCallback((scale, tx, ty) => {
    const el = pagerRef.current;
    const img = imgRefs.current[index];
    if (!el || !img) return { scale, tx, ty };
    const maxTx = Math.max(0, (img.offsetWidth * scale - el.clientWidth) / 2);
    const maxTy = Math.max(0, (img.offsetHeight * scale - el.clientHeight) / 2);
    return {
      scale,
      tx: Math.max(-maxTx, Math.min(maxTx, tx)),
      ty: Math.max(-maxTy, Math.min(maxTy, ty)),
    };
  }, [index]);

  const animateTo = useCallback((next) => {
    if (!reduced) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 240);
    }
    setView(next);
  }, [reduced]);

  // ── the gesture machine (refs only — no re-render per move) ──
  const pointers = useRef(new Map());
  const gesture = useRef(null); // {mode, ...} | null
  const lastTap = useRef({ t: 0, x: 0, y: 0 });

  const midpoint = () => {
    const pts = [...pointers.current.values()];
    return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  };
  const distance = () => {
    const pts = [...pointers.current.values()];
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  const onDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // Pinch begins — anchored on the midpoint.
      const el = pagerRef.current;
      const rect = el.getBoundingClientRect();
      const m = midpoint();
      gesture.current = {
        mode: "pinch",
        startDist: distance(),
        startScale: view.scale,
        startTx: view.tx,
        startTy: view.ty,
        // Midpoint relative to the viewport center — the anchor.
        anchorX: m.x - (rect.left + rect.width / 2),
        anchorY: m.y - (rect.top + rect.height / 2),
        moved: true,
      };
    } else if (pointers.current.size === 1) {
      gesture.current = zoomed
        ? { mode: "pan", startX: e.clientX, startY: e.clientY, startTx: view.tx, startTy: view.ty, moved: false }
        : { mode: "maybe-pull", startX: e.clientX, startY: e.clientY, moved: false };
    }
  };

  const onMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;

    if (g.mode === "pinch" && pointers.current.size === 2) {
      const s = Math.max(1, Math.min(MAX_ZOOM, g.startScale * (distance() / g.startDist)));
      // Keep the photo point under the pinch midpoint fixed while scaling.
      const ratio = s / g.startScale;
      const tx = g.anchorX - (g.anchorX - g.startTx) * ratio;
      const ty = g.anchorY - (g.anchorY - g.startTy) * ratio;
      setView(clamp(s, tx, ty));
      return;
    }

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (Math.hypot(dx, dy) > 6) g.moved = true;

    if (g.mode === "pan") {
      setView((v) => clamp(v.scale, g.startTx + dx, g.startTy + dy));
    } else if (g.mode === "maybe-pull") {
      // Vertical-dominant drag while unzoomed = the dismiss gesture.
      if (dy > 10 && Math.abs(dy) > Math.abs(dx)) g.mode = "pull";
    } else if (g.mode === "pull") {
      setPull(Math.max(0, dy));
    }
  };

  const onUp = (e) => {
    const had = pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!had || !g) return;

    if (g.mode === "pinch") {
      if (pointers.current.size === 1) {
        // Pinch ended with one finger still down — hand off to pan cleanly.
        const left = [...pointers.current.values()][0];
        gesture.current = { mode: "pan", startX: left.x, startY: left.y, startTx: view.tx, startTy: view.ty, moved: true };
      } else {
        gesture.current = null;
        if (view.scale <= 1.02) animateTo({ scale: 1, tx: 0, ty: 0 }); // settle a near-1 pinch
      }
      return;
    }

    if (g.mode === "pull") {
      gesture.current = null;
      if (pull > PULL_CLOSE_PX) onClose(index);
      else {
        if (!reduced) {
          setAnimating(true);
          setTimeout(() => setAnimating(false), 240);
        }
        setPull(0);
      }
      return;
    }

    gesture.current = null;

    // A clean, unmoved press: double-tap detection.
    if (!g.moved) {
      const now = Date.now();
      const prev = lastTap.current;
      const isDouble = now - prev.t < 280 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 24;
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };
      if (isDouble) {
        lastTap.current = { t: 0, x: 0, y: 0 };
        if (zoomed) {
          animateTo({ scale: 1, tx: 0, ty: 0 });
        } else {
          // Zoom into the tapped spot.
          const el = pagerRef.current;
          const rect = el.getBoundingClientRect();
          const ax = e.clientX - (rect.left + rect.width / 2);
          const ay = e.clientY - (rect.top + rect.height / 2);
          const s = Math.min(MAX_ZOOM, DOUBLE_TAP_ZOOM);
          animateTo(clamp(s, ax * (1 - s), ay * (1 - s)));
        }
      }
    }
  };

  // Paging resets the zoom (each photo starts honest).
  const onScroll = () => {
    const el = pagerRef.current;
    if (!el) return;
    const next = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (next !== index) {
      setIndex(next);
      setView({ scale: 1, tx: 0, ty: 0 });
    }
  };

  const rootStyle = {
    transform: pull ? `translateY(${pull}px)` : undefined,
    opacity: pull ? Math.max(0.5, 1 - pull / 400) : undefined,
  };

  // Portaled to <body>: the immersive root is its own (lower) stacking
  // context below the glass island — rendered inside it, no z-index
  // could lift the viewer above the nav. The web lightbox does the same.
  return createPortal(
    <div
      className={[
        "lightbox",
        zoomed && "lightbox-zoomed",
        animating && !reduced && "lightbox-animating",
      ].filter(Boolean).join(" ")}
      style={rootStyle}
      role="dialog"
      aria-label={`${title} photo viewer`}
    >
      <div
        className="lightbox-pager"
        ref={pagerRef}
        onScroll={onScroll}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {photos.map((src, i) => (
          <div key={i} className="lightbox-slide">
            <img
              ref={(el) => { imgRefs.current[i] = el; }}
              src={src}
              alt={`${title} — photo ${i + 1}`}
              draggable={false}
              style={i === index && (zoomed || animating)
                ? { transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})` }
                : undefined}
            />
          </div>
        ))}
      </div>
      <button type="button" className="lightbox-close" onClick={() => onClose(index)} aria-label="Close photo viewer">
        ✕
      </button>
      <div className="lightbox-hint">
        {zoomed ? "Drag to look around · double-tap to reset" : "Pinch or double-tap to zoom"}
      </div>
      <div className="lightbox-counter">{index + 1} / {photos.length}</div>
    </div>,
    document.body
  );
}
