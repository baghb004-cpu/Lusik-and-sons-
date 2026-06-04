"use client";

// ============================================================
// useInViewport — is the referenced element currently on screen?
// ============================================================
// Lightweight IntersectionObserver wrapper. Used to drive the mobile
// sticky Add-to-Bag bar: show it while the real in-page button is
// scrolled out of view, hide it once the button is visible (so the two
// never overlap and no extra page padding / layout shift is needed).
//
// Starts `true` (assume visible) so nothing flashes before the observer
// attaches; the observer corrects it on the next frame.
// ============================================================

import { useEffect, useRef, useState } from "react";

export function useInViewport<T extends HTMLElement = HTMLElement>(): [
  React.RefObject<T>,
  boolean,
] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry) setInView(entry.isIntersecting); },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return [ref, inView];
}
