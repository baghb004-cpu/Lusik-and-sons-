// ============================================================
// src/main.jsx — Vite build entrypoint
// ============================================================
// Mounts the React tree into #root. Wrap order matters:
//   ErrorBoundary  → catches any uncaught render error and shows
//                    a fallback instead of a blank white screen
//   LanguageProvider → makes useT() + useLang() work everywhere
//   App             → the real SPA
//
// ToastProvider is NOT wrapped at the top here — it lives inside
// <App> so it can be co-located with the cart-state surface that
// uses it.
//
// Wired up at Phase 9 of the migration. Goes live when Phase 10
// flips netlify.toml's publish dir to dist/ and rewrites
// index.html as the minimal entry HTML.
// ============================================================

import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import { initErrorReporting, Sentry } from "./lib/errorReporting.js";
import { LanguageProvider } from "./i18n/LangContext.jsx";
import { App } from "./App.jsx";

// Initialize error reporting BEFORE any other code runs. If
// VITE_SENTRY_DSN isn't set this is a no-op; if it is, every
// subsequent uncaught error / promise rejection / ErrorBoundary
// trip gets reported.
initErrorReporting();

// Dev-only accessibility auditor. axe-core logs violations to
// the browser console as you navigate — bad ARIA, missing alt
// text, low-contrast text, missing form labels. Bundled into
// production is `false` because `import.meta.env.DEV` is a
// Vite-replaced compile-time constant, so the whole block (and
// the @axe-core/react module) is tree-shaken out of the
// production build. Zero bundle cost in production.
if (import.meta.env.DEV) {
  // Dynamic import so the dep isn't pulled into the prod chunk
  // graph at all. Awaits without blocking createRoot — if axe
  // takes 200ms to load, the app still renders immediately.
  import("@axe-core/react").then(({ default: axe }) => {
    axe(React, { ReactDOM: { createRoot } }, 1000);
  });
}

// ============================================================
// ErrorBoundary — last-resort catch for uncaught render errors
// ============================================================
// React error boundaries require a class component (Hooks don't
// yet support getDerivedStateFromError / componentDidCatch). We
// render a friendly fallback with reload + return-home + email-
// us actions so a customer hitting a crash isn't dead-ended.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info?.componentStack);
    // Forward to Sentry if it's been initialized. Sentry.captureException
    // is a no-op when init() wasn't called (DSN not set), so this is
    // safe to invoke unconditionally.
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info?.componentStack } },
    });
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.5rem",
        background: "#F5EFE3",
        color: "#1A1612",
        fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
        lineHeight: 1.5,
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 480 }}>
          <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500, fontSize: "0.85rem", letterSpacing: "0.05em", opacity: 0.55, marginBottom: "2rem" }}>
            Lusik <span style={{ color: "#B08842" }}>&amp;</span> Sons
          </p>
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#B08842", margin: "0 0 1rem", fontWeight: 600 }}>
            A stitch slipped
          </p>
          <p style={{ fontSize: "1rem", margin: "0 0 1.5rem" }}>
            Apologies — something on our end didn't load right. Please reload the page. If it happens again, write to us at <a href="mailto:hello@lusikandsons.com" style={{ color: "#B08842" }}>hello@lusikandsons.com</a> and one of Lusik's sons will look into it.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => window.location.reload()} style={{ padding: "0.6rem 1.25rem", background: "#1A1612", color: "#F5EFE3", fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 500, border: "none", cursor: "pointer" }}>
              Reload
            </button>
            <button onClick={() => { window.location.href = "/"; }} style={{ padding: "0.6rem 1.25rem", background: "transparent", color: "#1A1612", fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 500, border: "1px solid #1A1612", cursor: "pointer" }}>
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }
}

const mount = document.getElementById("root");
if (mount) {
  createRoot(mount).render(
    <ErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ErrorBoundary>
  );
  // Hide the static loading splash once React has mounted. The .hide
  // class fades opacity to 0 and removes pointer-events so it doesn't
  // intercept clicks on the live app.
  setTimeout(() => document.getElementById("loading")?.classList.add("hide"), 300);
}
