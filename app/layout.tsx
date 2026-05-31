// Root layout — Next.js App Router.
// The site is served by Next.js on Netlify via @netlify/plugin-nextjs
// (see netlify.toml). The app-wide provider stack is mounted through
// <Providers> (a single "use client" boundary — see providers.tsx).
//
// globals.css re-exports the canonical stylesheet (src/styles/index.css).
//
// The Netlify Identity widget loads from identity.netlify.com (NOT the npm
// package — Netlify's confirmation redirect expects window.netlifyIdentity
// from their CDN); beforeInteractive puts it in the initial <head> so
// auth.init() finds it on mount.
import "./globals.css";
import Script from "next/script";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Providers } from "./providers";
import { SiteChrome } from "../src/components/SiteChrome.jsx";
import {
  SITE_URL,
  SITE_NAME,
  DEFAULT_OG_IMAGE,
  organizationJsonLd,
  jsonLdScript,
} from "../src/lib/seo.js";

// metadataBase lets per-route relative canonical/OpenGraph URLs resolve to the
// production origin during SSR. The default title is a template so each route's
// own title reads "<page> — Lusik & Sons".
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Hand-Embroidered Armenian Alphabet Blankets | Cypress, CA`,
    template: `%s — ${SITE_NAME}`,
  },
  description:
    "Hand cross-stitched Armenian alphabet baby blankets, made to order in Cypress, California.",
  // Favicons, PWA icons, and the web app manifest. The files live in /public
  // and were generated from icon.svg (the "L & Sons" monogram). Declaring them
  // here is what actually emits the <link rel="icon"> / manifest tags — without
  // this the site shipped with no favicon at all.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
  // Default social-share card for pages that don't set their own OpenGraph
  // (most importantly the home page). Routes built via pageMetadata() override
  // this with their own per-page image. Relative path resolves to an absolute
  // URL via metadataBase above.
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: DEFAULT_OG_IMAGE, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    images: [DEFAULT_OG_IMAGE],
  },
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
        {/* Site-wide Organization structured data (brand entity for search). */}
        <script {...jsonLdScript(organizationJsonLd())} />
        <Providers>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
