// ============================================================
// useTilt3D — pointer-tracking 3D tilt for cards (zero deps)
// ============================================================
// Drives the DEPTH layer (see the DEPTH block at the bottom of
// src/styles/index.css). Attach the returned ref to an element
// carrying the `t3d` class, inside a `t3d-scene` (perspective)
// parent:
//
//   const tiltRef = useTilt3D();
//   <button ref={tiltRef} className="t3d t3d-glare ...">…</button>
//
// Design constraints, all deliberate:
//   - Writes the *individual* `rotate` property (axis–angle) plus
//     --t3d-* custom properties — never `transform` — so the tilt
//     COMPOSES with the theater entrance animations (vt-rise,
//     stagger-reveal), whose keyframes animate `transform` and
//     would otherwise override any transform we set here.
//   - Mouse/pen: the card tilts *away* under the pointer while it
//     hovers (the Apple-TV "pressed poster" feel) and springs back
//     on leave. Pointer at the top edge → the top edge recedes.
//   - Touch: tilts only while actually pressed (pointerdown → up).
//     A scroll/swipe gesture fires pointercancel, which resets —
//     so the card carousels still swipe naturally.
//   - prefers-reduced-motion is checked live at interaction time,
//     so flipping the OS setting takes effect without a reload.
//   - rAF-throttled; writes styles directly (no React re-renders).

import { useCallback, useRef } from "react";

export interface Tilt3DOptions {
  /** Max tilt in degrees while a mouse/pen hovers (default 6). */
  max?: number;
  /** Max tilt in degrees while a finger presses (default 4). */
  touchMax?: number;
}

export function useTilt3D({ max = 6, touchMax = 4 }: Tilt3DOptions = {}) {
  const cleanupRef = useRef<(() => void) | null>(null);

  return useCallback(
    (el: HTMLElement | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (!el || typeof window === "undefined" || !window.matchMedia) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      let raf = 0;
      let hovering = false; // fine-pointer hover in progress
      let pressed = false; // touch press in progress
      let px = 0.5;
      let py = 0.5;
      let limit = max;
      // Remember the last real axis so the release transition
      // interpolates back along the same rotation (angle → 0)
      // instead of jumping through `rotate: none`.
      let lastAxis = "0 1 0";

      const apply = () => {
        raf = 0;
        const rx = (0.5 - py) * 2 * limit; // pointer at top → top recedes
        const ry = (px - 0.5) * 2 * limit; // pointer at right → right recedes
        const angle = Math.hypot(rx, ry);
        if (angle >= 0.01) {
          lastAxis = `${(rx / angle).toFixed(4)} ${(ry / angle).toFixed(4)} 0`;
        }
        el.style.rotate = `${lastAxis} ${angle.toFixed(2)}deg`;
        el.style.setProperty("--t3d-gx", `${(px * 100).toFixed(1)}%`);
        el.style.setProperty("--t3d-gy", `${(py * 100).toFixed(1)}%`);
        el.style.setProperty("--t3d-glow", Math.min(1, angle / limit).toFixed(3));
      };
      const schedule = () => {
        if (!raf) raf = requestAnimationFrame(apply);
      };

      const track = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;
        px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
        schedule();
      };

      const end = () => {
        hovering = false;
        pressed = false;
        el.removeAttribute("data-t3d-live");
        px = 0.5;
        py = 0.5;
        schedule(); // springs back: angle 0 along lastAxis, glow 0
      };

      const onEnter = (e: PointerEvent) => {
        if (e.pointerType === "touch" || reduced.matches) return;
        hovering = true;
        limit = max;
        el.setAttribute("data-t3d-live", "");
        track(e);
      };
      const onDown = (e: PointerEvent) => {
        if (e.pointerType !== "touch" || reduced.matches) return;
        pressed = true;
        limit = touchMax;
        el.setAttribute("data-t3d-live", "");
        track(e);
      };
      const onMove = (e: PointerEvent) => {
        if (e.pointerType === "touch" ? pressed : hovering) track(e);
      };
      const onUp = (e: PointerEvent) => {
        // Mouse hover survives a click; pointerleave ends it instead.
        if (e.pointerType === "touch") end();
      };

      el.addEventListener("pointerenter", onEnter);
      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", end);
      el.addEventListener("pointerleave", end);

      cleanupRef.current = () => {
        el.removeEventListener("pointerenter", onEnter);
        el.removeEventListener("pointerdown", onDown);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", end);
        el.removeEventListener("pointerleave", end);
        if (raf) cancelAnimationFrame(raf);
        el.style.rotate = "";
        el.removeAttribute("data-t3d-live");
      };
    },
    [max, touchMax]
  );
}
