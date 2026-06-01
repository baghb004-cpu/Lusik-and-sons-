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
    <LanguageProvider>
      <ToastProvider>
        <MotionProvider>
          <SiteProvider>{children}</SiteProvider>
        </MotionProvider>
      </ToastProvider>
    </LanguageProvider>
  );
}
