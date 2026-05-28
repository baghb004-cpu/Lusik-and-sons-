import { useRef } from "react";

// ============================================================
// useSwipe — horizontal swipe detection for image galleries
// ============================================================
// Returns touch handlers to spread onto a gallery container and
// a `swiped` ref the consumer can check inside a tap handler so
// a swipe doesn't also fire tap-to-zoom.
//
//   const { handlers, swiped } = useSwipe({
//     onSwipeLeft: goNext,    // swipe left  → advance
//     onSwipeRight: goPrev,   // swipe right → go back
//   });
//   <div {...handlers}>
//     <button onClick={() => { if (!swiped.current) openZoom(); }}>
//
// Only fires when horizontal movement dominates AND exceeds the
// threshold — so vertical page scrolls and plain taps fall
// through untouched. Mirrors the Amazon / Apple product-photo
// swipe gesture.
// ============================================================

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 40 } = {}) {
  const startX = useRef(0);
  const startY = useRef(0);
  const swiped = useRef(false);

  const onTouchStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    startX.current = t.clientX;
    startY.current = t.clientY;
    swiped.current = false;
  };

  const onTouchMove = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    // Mark as swiped once horizontal movement clearly dominates —
    // this flag guards the consumer's tap handler.
    if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
      swiped.current = true;
    }
  };

  const onTouchEnd = (e) => {
    const t = e.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    }
  };

  return { handlers: { onTouchStart, onTouchMove, onTouchEnd }, swiped };
}
