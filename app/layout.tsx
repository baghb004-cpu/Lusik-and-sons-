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
import type { Metadata } from "next";
import { Providers } from "./providers";
import { SiteChrome } from "../src/components/SiteChrome.jsx";
import { SITE_URL, SITE_NAME } from "../src/lib/seo.js";

// metadataBase lets per-route relative canonical/OpenGraph URLs resolve to the
// production origin during SSR (Phase 7). The default title is a template so
// each route's own title reads "<page> — Lusik & Sons".
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Hand-Embroidered Armenian Alphabet Blankets | Cypress, CA`,
    template: `%s — ${SITE_NAME}`,
  },
  description:
    "Hand cross-stitched Armenian alphabet baby blankets, made to order in Cypress, California.",
  // No global canonical — each route owns its own (a layout-level canonical
  // would wrongly propagate "/" to every non-overriding page).
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Script
          src="https://identity.netlify.com/v1/netlify-identity-widget.js"
          strategy="beforeInteractive"
        />
        <Providers>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
