// ============================================================
// rum — real-user Core Web Vitals, tagged with the capability tier
// ============================================================
// The capability ladder promises "measure, do not assume": every
// session reports LCP, INP, and CLS plus the tier it landed in, so the
// owner can see the real distribution (SITE_OVERHAUL_HANDOFF.md 11.1).
//
// Transport is the existing consent-aware `track()` wrapper, which only
// sends when Umami is configured (CONFIG.ANALYTICS.UMAMI_WEBSITE_ID).
// When it is empty, this whole module is a no-op: nothing is imported,
// nothing is measured, no request leaves the page. `web-vitals` is
// dynamically imported after idle so it never sits in first-load JS.
// ============================================================
import { CONFIG } from "../data/config.js";
import { track } from "./analytics.js";
import { getTier } from "./capability";

let started = false;

export function initRum(): void {
  if (typeof window === "undefined" || started) return;
  if (CONFIG.TIERS?.RUM === false) return;
  if (!CONFIG.ANALYTICS?.UMAMI_WEBSITE_ID) return; // nobody is listening; skip the import too
  started = true;

  const start = async () => {
    try {
      const { onLCP, onINP, onCLS } = await import("web-vitals");
      const report = (metric: { name: string; value: number; rating: string; navigationType?: string }) => {
        // CLS is a unitless score; scale it so every value is an integer in the dashboard.
        const value = metric.name === "CLS" ? Math.round(metric.value * 1000) : Math.round(metric.value);
        track("web-vital", { name: metric.name, value, rating: metric.rating, tier: getTier(), route: window.location.pathname });
      };
      onLCP(report);
      onINP(report);
      onCLS(report);
    } catch { /* never let telemetry break the page */ }
  };

  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(() => { void start(); }, { timeout: 4000 });
  else setTimeout(() => { void start(); }, 2000);
}
