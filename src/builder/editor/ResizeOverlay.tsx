"use client";

// ============================================================
// Resize overlay (Phase 9) — drag the selected block's width
// ============================================================
// A handle on the selected block's right edge. Dragging maps the
// pointer to a percentage of the preview width, SNAPPED to 5%
// steps (the grid), live-previewed via a width readout + guide
// lines, committed on release as style.maxWidth (e.g. "65%") —
// which the schema already allows and the override cascade can
// re-patch per device. Escape cancels.
// ============================================================

import { useEffect, useRef, useState } from "react";

export interface ResizeOverlayProps {
  container: HTMLElement;
  blockId: string;
  /** Re-measure trigger (device/doc changes). */
  refreshKey: string;
  onCommit: (maxWidth: string) => void;
}

const SNAP_PCT = 5;
const MIN_PCT = 20;

export function ResizeOverlay({ container, blockId, refreshKey, onCommit }: ResizeOverlayProps) {
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [dragPct, setDragPct] = useState<number | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    const el = container.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
    if (!el) { setRect(null); return; }
    const c = container.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    setRect({ x: b.left - c.left, y: b.top - c.top, w: b.width, h: b.height });
  }, [container, blockId, refreshKey, dragPct]);

  if (!rect) return null;
  const containerW = container.clientWidth;

  const startDrag = (down: React.PointerEvent) => {
    down.preventDefault();
    cancelled.current = false;
    const onMove = (e: PointerEvent) => {
      const c = container.getBoundingClientRect();
      const raw = ((e.clientX - c.left) / containerW) * 100;
      const snapped = Math.min(100, Math.max(MIN_PCT, Math.round(raw / SNAP_PCT) * SNAP_PCT));
      setDragPct(snapped);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { cancelled.current = true; finish(); }
    };
    const finish = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("keydown", onKey);
      setDragPct((pct) => {
        if (pct !== null && !cancelled.current) onCommit(pct >= 100 ? "full" : `${pct}%`);
        return null;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("keydown", onKey);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
      {/* 5% grid guides while dragging */}
      {dragPct !== null ? (
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: "repeating-linear-gradient(to right, transparent, transparent calc(5% - 1px), #B0884255 calc(5% - 1px), #B0884255 5%)",
          }}
        />
      ) : null}
      {/* live width readout */}
      {dragPct !== null ? (
        <div className="absolute left-1/2 top-10 -translate-x-1/2 rounded bg-ink px-2 py-0.5 font-mono text-[11px] text-cream">
          {dragPct >= 100 ? "full width" : `${dragPct}%`}
        </div>
      ) : null}
      {/* the handle */}
      <button
        type="button"
        aria-label="Drag to resize width (snaps to 5%)"
        onPointerDown={startDrag}
        className="pointer-events-auto absolute z-40 h-11 w-3 cursor-ew-resize rounded-full border border-ink/30 bg-white shadow-card"
        style={{
          left: dragPct !== null ? `calc(${dragPct}% - 6px)` : rect.x + rect.w - 6,
          top: rect.y + rect.h / 2 - 22,
        }}
      />
    </div>
  );
}
