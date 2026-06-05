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

// Map our internal event names to Meta's standard event names so the
// Pixel can be used for ad optimization + ROAS reporting. Only mapped
// events are forwarded to Meta; everything else still flows to Umami /
// PostHog as before. Purchase value/currency (when present in `data`)
// is passed straight through.
const META_EVENT_MAP = {
  "add-to-cart":      "AddToCart",
  "buy-now":          "InitiateCheckout",
  "checkout-start":   "InitiateCheckout",
  "order-complete":   "Purchase",
  "waitlist-signup":  "Lead",
  "newsletter-signup":"Lead",
};

export function track(eventName, data) {
  if (typeof window === "undefined") return;
  // Forward to whichever analytics providers are turned on.
  // All independent — none knows the others exist.
  const umamiOn    = !!CONFIG.ANALYTICS?.UMAMI_WEBSITE_ID;
  const metaOn     = !!CONFIG.ANALYTICS?.META_PIXEL_ID;
  const posthogOn  = !!CONFIG.PAID_FEATURES?.BEHAVIORAL_ANALYTICS?.ENABLED
                  && !!CONFIG.PAID_FEATURES?.BEHAVIORAL_ANALYTICS?.POSTHOG_KEY;
  if (!umamiOn && !posthogOn && !metaOn) return;
  try {
    if (umamiOn) {
      if (data) window.umami?.track(eventName, data);
      else      window.umami?.track(eventName);
    }
    if (posthogOn) {
      window.posthog?.capture?.(eventName, data || {});
    }
    if (metaOn) {
      const metaEvent = META_EVENT_MAP[eventName];
      // fbq is defined as a queuing stub by the base pixel code the
      // moment it runs, so calling it early is safe even before the
      // library finishes loading.
      if (metaEvent) window.fbq?.("track", metaEvent, data || {});
    }
  } catch { /* analytics never throws into user code */ }
}
