import { useEffect, useState } from "react";

// ============================================================
// useKeyboardOffset — track the on-screen keyboard height
// ============================================================
// iOS Safari keeps position:fixed elements pinned to the LAYOUT
// viewport bottom — which sits UNDER the software keyboard, so a
// bottom-fixed search bar gets hidden the moment the keyboard
// opens. The VisualViewport API reports the actually-visible area;
// the difference between the layout viewport and the visual
// viewport is the keyboard height. Translating a fixed element up
// by this offset keeps it riding on top of the keyboard.
//
// Returns 0 when `active` is false, when there's no keyboard, or
// when VisualViewport isn't supported (older browsers) — so the
// consumer can apply `translateY(-offset)` unconditionally.
// ============================================================

export function useKeyboardOffset(active: boolean): number {
  const [offset, setOffset] = useState<number>(0);

  useEffect(() => {
    if (!active || typeof window === "undefined" || !window.visualViewport) {
      setOffset(0);
      return undefined;
    }
    const vv = window.visualViewport;
    const update = () => {
      // Layout-viewport bottom minus visual-viewport bottom = the
      // height the keyboard is covering.
      const kb = window.innerHeight - vv.height - vv.offsetTop;
      setOffset(kb > 1 ? kb : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setOffset(0);
    };
  }, [active]);

  return offset;
}
