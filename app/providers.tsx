"use client";

// ============================================================
// Providers — the single client boundary for the Next build
// ============================================================
// Vite→Next migration, Phase 3. ONE "use client" boundary that mounts the
// app-wide React context providers, so the existing client components
// (which call useT() / useToast() and the auth wrapper) work unchanged once
// they're ported in later phases. The imported .jsx providers don't need
// their own "use client" directive — being imported by this client module
// already places them (and their subtree) in the client bundle.
//
// Deliberately NOT mounted here yet:
//   • Sentry (src/lib/errorReporting) and analytics (src/lib/analytics) read
//     Vite's `import.meta.env` / inject scripts from App.jsx effects. Those
//     are Vite-coupled and move over with the App port (Phase 5); pulling
//     them in now would drag `import.meta.env` into the Next bundle early.
//
// Nothing here is served in production yet — Vite still builds the site
// (netlify.toml publish = "dist"), and the Vite entry (src/main.jsx) is
// untouched.
import { useEffect } from "react";
import type { ReactNode } from "react";
import { LanguageProvider } from "../src/i18n/LangContext.jsx";
import { ToastProvider } from "../src/components/ToastProvider.jsx";
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
  }, []);

  return (
    <LanguageProvider>
      <ToastProvider>{children}</ToastProvider>
    </LanguageProvider>
  );
}
