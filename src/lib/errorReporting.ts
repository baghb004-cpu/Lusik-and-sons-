// ============================================================
// errorReporting — Sentry initialization wrapper
// ============================================================
// Off by default; turns on when NEXT_PUBLIC_SENTRY_DSN is
// set in the Netlify environment. To enable:
//
//   1. Sign up at sentry.io (free tier: 5k errors/month).
//   2. Create a "React" project. Copy the DSN
//      (looks like https://abc123@o12345.ingest.sentry.io/67890).
//   3. Netlify dashboard → Site → Environment → add
//      NEXT_PUBLIC_SENTRY_DSN = <the DSN>
//   4. Redeploy. Sentry is now wired up site-wide.
//
// Next's `NEXT_PUBLIC_*` env-var convention: only env vars
// starting with `NEXT_PUBLIC_` are inlined into the client bundle.
// Anything not prefixed stays server-side, which is the right
// default for secrets. The DSN is browser-side anyway (it has to be
// — the browser sends events directly to Sentry), so NEXT_PUBLIC_ is correct.
//
// What gets captured automatically:
//   - Uncaught exceptions in any component (via ErrorBoundary
//     integration below)
//   - Unhandled promise rejections
//   - Console.error calls (off by default; opt-in)
//
// What's NOT captured:
//   - User input data, form values — Sentry's default scrubbing
//     redacts these, plus we set tracesSampleRate to 0 so no
//     performance traces (which can capture URL params) are sent.
//   - PII: customer email, payment data. Stripe handles payments
//     in its own iframe so it never reaches us anyway.
//
// Privacy posture matches the rest of the site: opt-in via env
// var, no fingerprinting, minimal user data. Privacy Policy
// already mentions "if active, third-party error monitoring."
// ============================================================

import * as Sentry from "@sentry/react";

export function initErrorReporting() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    // Not configured — explicit no-op. Don't log a warning;
    // unconfigured-Sentry is the expected state for development
    // and for production until someone signs up.
    return;
  }
  Sentry.init({
    dsn,
    // Tag every event with the deploy context so issues from
    // production are distinguishable from deploy-preview noise.
    environment: process.env.NEXT_PUBLIC_NETLIFY_CONTEXT || "production",
    // No performance traces — keeps the SDK to error reporting only,
    // which is what the free tier covers and what we actually want.
    // Bumping this to 0.1 later samples 10% of pageviews for traces.
    tracesSampleRate: 0,
    // No session replay — would record DOM state including form
    // inputs and is a heavier privacy surface than we want today.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Ignore the noise sources every site sees:
    //   - Browser extensions injecting scripts that crash
    //   - ResizeObserver loop notifications (a no-op browser quirk)
    //   - Stripe's iframe (handled by Stripe, not our concern)
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      /^Network request failed$/i,
    ],
    denyUrls: [
      // Browser extensions
      /extensions?\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
      // Stripe's own iframe
      /js\.stripe\.com/,
    ],
  });
}

// Re-export the Sentry namespace so callers that need it (e.g.
// the ErrorBoundary in main.jsx) don't have to also import from
// @sentry/react directly.
export { Sentry };
