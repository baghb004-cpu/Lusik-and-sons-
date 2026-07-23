"use client";

// ============================================================
// Providers — the single client boundary for the Next build
// ============================================================
// ONE "use client" boundary that mounts the app-wide React context providers
// (language, toasts, site/cart/auth state). The imported .jsx providers don't
// need their own "use client" directive — being imported by this client module
// already places them (and their subtree) in the client bundle.
//
// On mount it wires the Netlify Identity widget into the auth wrapper and, if a
// Sentry DSN is configured, initializes error monitoring. Both are no-ops when
// their dependency isn't present, so the app always renders.
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LanguageProvider } from "../src/i18n/LangContext.jsx";
import { ToastProvider } from "../src/components/ToastProvider.jsx";
import { SiteProvider } from "../src/state/SiteProvider.jsx";
import { MotionProvider } from "../src/components/MotionProvider.jsx";
import { auth } from "../src/lib/auth.js";
import { CONFIG } from "../src/data/config.js";
import { adsOptedOut, ADS_CONSENT_EVENT } from "../src/lib/adConsent";

const META_PIXEL_ID: string = CONFIG.ANALYTICS?.META_PIXEL_ID || "";
const GOOGLE_ADS_ID: string = CONFIG.ANALYTICS?.GOOGLE_ADS_ID || "";

export function Providers({ children }: { children: ReactNode }) {
  // Ad-pixel consent gate. Starts false so the server and the client's first
  // render agree (no tag in either), then flips on after mount unless the
  // visitor opted out ("Your privacy choices" in the footer / Privacy Policy)
  // or their browser sends a Global Privacy Control signal. Opting out
  // mid-session flips it back off; un-opting re-injects without a reload.
  const [adsAllowed, setAdsAllowed] = useState(false);
  useEffect(() => {
    setAdsAllowed(!adsOptedOut());
    const onConsent = () => setAdsAllowed(!adsOptedOut());
    window.addEventListener(ADS_CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(ADS_CONSENT_EVENT, onConsent);
  }, []);

  // Fire a Meta Pixel PageView on client-side route changes (the base
  // pixel code below only fires the initial one). Skip the first run so
  // the landing page isn't counted twice.
  const pathname = usePathname();
  const firstPixelRun = useRef(true);
  useEffect(() => {
    if (!META_PIXEL_ID) return;
    if (firstPixelRun.current) { firstPixelRun.current = false; return; }
    if (adsOptedOut()) return;
    (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq?.("track", "PageView");
  }, [pathname]);

  // Meta Pixel Purchase event. Stripe redirects back to /?order=success
  // &session_id=... on a completed payment; fire Purchase once here.
  // eventID = the Stripe session id so a refresh / back-button to the
  // success URL dedupes instead of double-counting the conversion.
  useEffect(() => {
    if (!META_PIXEL_ID) return;
    if (adsOptedOut()) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("order") !== "success") return;
      const sid = params.get("session_id") || undefined;

      // fbq does NOT exist when this mount effect runs: the pixel <Script>
      // is consent-gated behind adsAllowed, which starts false and only
      // flips (and mounts the script) on a re-render AFTER mount effects.
      // Firing once here silently dropped every Purchase conversion. So:
      // attempt now, then poll until the pixel's queuing stub appears
      // (a few hundred ms typically; give up after 20s). The stashed order
      // value is only consumed after a send actually happens, so a slow
      // pixel can't destroy the value before it's reported.
      const send = () => {
        const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
        if (typeof fbq !== "function") return false;
        let purchase: { value: number; currency: string } = { value: 0, currency: "USD" };
        try {
          const raw = sessionStorage.getItem("lusik_purchase_value_v1");
          if (raw) {
            const parsed = JSON.parse(raw) as { value?: number; currency?: string };
            if (typeof parsed?.value === "number" && Number.isFinite(parsed.value)) {
              purchase = { value: parsed.value, currency: parsed.currency || "USD" };
            }
          }
          // One-shot: consumed only now that the event is definitely going
          // out, so a refresh / back-button doesn't re-read a stale amount
          // (eventID = the Stripe session id dedupes the event itself).
          sessionStorage.removeItem("lusik_purchase_value_v1");
        } catch { /* storage blocked — fall back to the $0 value */ }
        fbq("track", "Purchase", purchase, sid ? { eventID: sid } : undefined);
        return true;
      };

      if (send()) return;
      let tries = 0;
      timer = setInterval(() => {
        tries += 1;
        if (send() || tries >= 40) clearInterval(timer);
      }, 500);
    } catch { /* never block render on analytics */ }
    return () => { if (timer) clearInterval(timer); };
  }, []);

  useEffect(() => {
    // Wire the Netlify Identity widget's login/logout events into the auth
    // wrapper. Idempotent, and it swallows the "widget not loaded yet" case,
    // so calling it on mount is safe even if the CDN script lands late.
    try {
      auth.init();
    } catch {
      /* Identity unavailable — the site still renders without auth. */
    }

    // Initialize error monitoring (Sentry). Off until NEXT_PUBLIC_SENTRY_DSN is
    // set in the Netlify environment; dynamically imported so the Sentry SDK is
    // only shipped to the browser once a DSN is actually configured (no bundle
    // cost in the default, unconfigured state).
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import("../src/lib/errorReporting")
        .then(({ initErrorReporting }) => initErrorReporting())
        .catch(() => {
          /* monitoring unavailable — never block the app on it */
        });
    }
  }, []);

  return (
    <>
      {/* Netlify Identity widget — loaded lazyOnload (during browser idle,
          after the page is interactive) so its ~54 KiB + ~300ms of main-thread
          work no longer lands in the initial hydration window. Most visitors
          never sign in, so this is pure cost on the critical path otherwise.
          Still the CDN build (the confirmation redirect handler expects
          window.netlifyIdentity from it — do NOT swap to the npm pkg). onReady
          re-runs auth.init() the moment the widget is present, so an
          already-signed-in user's session restores and the login/logout events
          wire up; the hash-token handler in auth.js retries ~5s, which covers
          the email-confirmation / recovery redirect even with the deferred
          load. The mount-time auth.init() above is a harmless no-op until then. */}
      <Script
        src="https://identity.netlify.com/v1/netlify-identity-widget.js"
        strategy="lazyOnload"
        onReady={() => { try { auth.init(); } catch { /* widget unavailable */ } }}
      />
      {/* Meta (Facebook/Instagram) Pixel — only injected when a Pixel ID
          is configured in CONFIG.ANALYTICS.META_PIXEL_ID, so there's zero
          cost / no third-party request when it's empty. The base snippet
          defines window.fbq (a queuing stub until fbevents.js loads),
          inits the pixel, and fires the first PageView. Funnel events
          (AddToCart / InitiateCheckout / Purchase) are forwarded from the
          track() wrapper + the Purchase effect above.
          BOTH tags additionally sit behind `adsAllowed` — the CPRA
          do-not-share opt-out + GPC gate above. Keep any new ad/analytics
          tag behind the same gate, and keep the Privacy Policy's
          "Advertising pixels" section in sync with what loads here. */}
      {META_PIXEL_ID && adsAllowed ? (
        <Script id="meta-pixel-base" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
        </Script>
      ) : null}
      {GOOGLE_ADS_ID && adsAllowed ? (
        <>
          <Script
            id="google-ads-gtag-src"
            src={"https://www.googletagmanager.com/gtag/js?id=" + GOOGLE_ADS_ID}
            strategy="afterInteractive"
          />
          <Script id="google-ads-gtag-init" strategy="afterInteractive">
            {"window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','" + GOOGLE_ADS_ID + "');"}
          </Script>
        </>
      ) : null}
      <LanguageProvider>
        <ToastProvider>
          <MotionProvider>
            <SiteProvider>{children}</SiteProvider>
          </MotionProvider>
        </ToastProvider>
      </LanguageProvider>
    </>
  );
}
