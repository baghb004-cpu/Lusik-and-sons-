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
import { useEffect } from "react";
import type { ReactNode } from "react";
import { LanguageProvider } from "../src/i18n/LangContext.jsx";
import { ToastProvider } from "../src/components/ToastProvider.jsx";
import { SiteProvider } from "../src/state/SiteProvider.jsx";
import { MotionProvider } from "../src/components/MotionProvider.jsx";
import { auth } from "../src/lib/auth.js";

export function Providers({ children }: { children: ReactNode }) {
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
