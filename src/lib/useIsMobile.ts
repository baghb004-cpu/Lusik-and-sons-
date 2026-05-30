// useIsMobile — true when the viewport matches the mobile breakpoint
// (anything below Tailwind's `lg` at 1024px). Used by components that
// need different layout/behavior on phones vs. desktop (e.g. the
// PDP's collapsible picker sections, sticky add-to-cart bar).

import { useState, useEffect } from "react";

const QUERY = "(max-width: 1023px)";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  return isMobile;
}
