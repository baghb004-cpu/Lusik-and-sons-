import { useRef, useState } from "react";

// ============================================================
// useGlideCarousel — finger-following swipe carousel
// ============================================================
// Unlike useSwipe (which only detects a completed swipe and then
// swaps), this drives a sliding TRACK that follows the finger in
// real time: as you drag, the current photo moves and the next /
// previous photo slides into view behind your finger. On release
// it snaps to the nearest photo with a spring-eased transition.
// This is the Amazon / Apple product-photo glide.
//
// Usage:
//   const glide = useGlideCarousel({ count, index, setIndex });
//   <div {...glide.handlers} onClick={() => { if (!glide.swiped.current) zoom(); }}>
//     <div style={glide.trackStyle}>
//       {images.map(src => <div className="min-w-full">…<img/>…</div>)}
//     </div>
//   </div>
//
// The track must be a flex row of full-width (min-w-full) slides.
// `glide.swiped` is a ref the consumer checks to guard tap-to-zoom
// so a drag doesn't also open the lightbox.
// ============================================================

export function useGlideCarousel({ count, index, setIndex }) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const widthRef = useRef(1);
  const claimed = useRef(false);   // horizontal gesture claimed
  const swiped = useRef(false);    // guards the consumer's tap handler

  const onTouchStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    startX.current = t.clientX;
    startY.current = t.clientY;
    widthRef.current = e.currentTarget?.offsetWidth || 1;
    claimed.current = false;
    swiped.current = false;
    setDragging(true);
  };

  const onTouchMove = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    // Don't claim the gesture until horizontal movement clearly
    // dominates — a vertical drag should fall through to the page
    // scroller untouched.
    if (!claimed.current) {
      if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return;
      claimed.current = true;
      swiped.current = true;
    }
    e.preventDefault?.();
    // Rubber-band resistance when dragging past the first / last
    // photo — the track gives a little but resists, signalling "end
    // of the set" the way native carousels do.
    let offset = dx;
    if ((index === 0 && dx > 0) || (index === count - 1 && dx < 0)) {
      offset = dx * 0.35;
    }
    setDragX(offset);
  };

  const onTouchEnd = () => {
    setDragging(false);
    if (claimed.current) {
      // Advance if the drag passed ~18% of the viewport width.
      const threshold = widthRef.current * 0.18;
      if (dragX <= -threshold && index < count - 1) setIndex(index + 1);
      else if (dragX >= threshold && index > 0) setIndex(index - 1);
    }
    setDragX(0);
    claimed.current = false;
  };

  const trackStyle = {
    display: "flex",
    height: "100%",
    transform: `translate3d(calc(${-index * 100}% + ${dragX}px), 0, 0)`,
    transition: dragging
      ? "none"
      : "transform 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    willChange: "transform",
  };

  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
    trackStyle,
    swiped,
    dragging,
  };
}
