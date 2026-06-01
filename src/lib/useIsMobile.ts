// useIsMobile — true when the viewport matches the mobile breakpoint
// (anything below Tailwind's `lg` at 1024px). Used by components that
// need different layout/behavior on phones vs. desktop (e.g. the
// PDP's collapsible picker sections, sticky add-to-cart bar).
//
// SSR-safe by construction: the initial state is ALWAYS `false`, so the
// server render and the client's first (hydration) render agree — no
// hydration mismatch (React #418) even on a phone. The real viewport is
// read in a layout effect, which runs after hydration but BEFORE the
// browser paints, so a mobile device still collapses to its mobile layout
// on the first visible frame (no flash of the desktop layout).

import { useState, useEffect, useLayoutEffect } from "react";

const QUERY = "(max-width: 1023px)";

// useLayoutEffect warns when run during SSR; fall back to useEffect on the
// server (where it's a no-op anyway). On the client we want the layout
// effect so the viewport sync lands before paint.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function useIsMobile(): boolean {
  // Always start `false` so SSR and the first client render match.
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useIsoLayoutEffect(() => {
    const mq = window.matchMedia(QUERY);
    // Sync to the real viewport before the first paint.
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  return isMobile;
}
