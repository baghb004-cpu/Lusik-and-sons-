// Root layout — Next.js App Router migration (Phase 3).
// Not yet wired into production (the Vite build still serves the site via
// netlify.toml publish = "dist"). The app-wide provider stack is mounted
// through <Providers> (a single "use client" boundary — see providers.tsx).
//
// globals.css re-exports the canonical stylesheet (src/styles/index.css) so
// Next and Vite share one source of truth during the migration.
//
// The Netlify Identity widget loads from identity.netlify.com (NOT the npm
// package — Netlify's confirmation redirect expects window.netlifyIdentity
// from their CDN); beforeInteractive puts it in the initial <head> like the
// Vite index.html does, so auth.init() finds it on mount.
import "./globals.css";
import Script from "next/script";
import type { ReactNode } from "react";
import { Providers } from "./providers";

export const metadata = {
  title: "Lusik & Sons",
  description:
    "Hand cross-stitched Armenian alphabet baby blankets, made to order in Cypress, California.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Script
          src="https://identity.netlify.com/v1/netlify-identity-widget.js"
          strategy="beforeInteractive"
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
