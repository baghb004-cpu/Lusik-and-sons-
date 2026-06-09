// ============================================================
// adConsent — the "do not share" switch for the ad pixels
// ============================================================
// The Meta Pixel + Google Ads tag share browsing signals with Meta/Google,
// which is "sharing" personal information for cross-context behavioral
// advertising under the CPRA. California requires an opt-out, so this module
// is the single source of truth the pixels consult:
//
//   * app/providers.tsx — skips injecting both tags when opted out
//   * src/lib/analytics.js — stops forwarding funnel events to fbq
//   * PolicyModal's "Advertising pixels" section + the footer's
//     "Your privacy choices" link — render the switch itself
//
// Opt-out wins from two independent sources, either one is enough:
//   1. The customer flipped the switch (persisted in localStorage), or
//   2. The browser sends a Global Privacy Control signal — the CPRA
//      regs treat GPC as a valid opt-out, so we honor it automatically.
//
// Storage is per-device by design (we have no server-side identity for
// most visitors); the policy text says so plainly.

const STORAGE_KEY = "lusik_ads_optout_v1";
export const ADS_CONSENT_EVENT = "lusik:ads-consent";

type GpcNavigator = Navigator & { globalPrivacyControl?: boolean };
type PixelWindow = Window & {
  fbq?: (...args: unknown[]) => void;
  gtag?: (...args: unknown[]) => void;
};

/** True when the browser announces a Global Privacy Control signal. */
export function hasGpcSignal(): boolean {
  if (typeof navigator === "undefined") return false;
  try {
    return (navigator as GpcNavigator).globalPrivacyControl === true;
  } catch {
    return false;
  }
}

/** True when this visitor stored an explicit opt-out on this device. */
export function hasStoredOptOut(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false; // storage blocked — fall back to GPC only
  }
}

/** The one question the pixels ask: is ad sharing opted out? */
export function adsOptedOut(): boolean {
  return hasStoredOptOut() || hasGpcSignal();
}

/**
 * Flip the opt-out. Persists the choice, tells any already-loaded tags to
 * stand down immediately (best effort — the hard guarantee is that neither
 * tag is injected on subsequent loads), and notifies listening UI.
 */
export function setAdsOptedOut(optOut: boolean): void {
  try {
    if (optOut) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage blocked — the session-level revoke below still applies */
  }
  try {
    const w = window as unknown as PixelWindow;
    w.fbq?.("consent", optOut ? "revoke" : "grant");
    w.gtag?.("consent", "update", {
      ad_storage: optOut ? "denied" : "granted",
      ad_user_data: optOut ? "denied" : "granted",
      ad_personalization: optOut ? "denied" : "granted",
    });
  } catch {
    /* consent APIs unavailable — injection gating still covers it */
  }
  try {
    window.dispatchEvent(new CustomEvent(ADS_CONSENT_EVENT, { detail: { optOut } }));
  } catch {
    /* no listeners — fine */
  }
}
