// ============================================================
// analytics — track() wrapper for Umami + PostHog
// ============================================================
// Module-level helper so call sites can fire events without
// checking whether analytics is enabled or whether the script
// has loaded. When neither provider is configured this is a
// total no-op and costs nothing.
//
//
// Usage:
//   import { track } from "@/lib/analytics.js";
//   track("add-to-cart", { productKey: "blanket-double_diag_br" });
//   track("checkout-start");
//
// Errors inside the providers are swallowed — analytics must
// never throw into user-flow code.
// ============================================================

import { CONFIG } from "../data/config.js";

export function track(eventName, data) {
  if (typeof window === "undefined") return;
  // Forward to whichever analytics providers are turned on.
  // Both are independent — neither knows the other exists.
  const umamiOn    = !!CONFIG.ANALYTICS?.UMAMI_WEBSITE_ID;
  const posthogOn  = !!CONFIG.PAID_FEATURES?.BEHAVIORAL_ANALYTICS?.ENABLED
                  && !!CONFIG.PAID_FEATURES?.BEHAVIORAL_ANALYTICS?.POSTHOG_KEY;
  if (!umamiOn && !posthogOn) return;
  try {
    if (umamiOn) {
      if (data) window.umami?.track(eventName, data);
      else      window.umami?.track(eventName);
    }
    if (posthogOn) {
      window.posthog?.capture?.(eventName, data || {});
    }
  } catch { /* analytics never throws into user code */ }
}
