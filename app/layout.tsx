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
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Providers } from "./providers";
import { CONFIG } from "../src/data/config.js";
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
    default: `${SITE_NAME} — Hand-Embroidered Armenian Alphabet Blankets | Southern California`,
    template: `%s — ${SITE_NAME}`,
  },
  description:
    "Hand cross-stitched Armenian alphabet baby blankets, made to order in Southern California.",
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

// Capability ladder, pre-paint stamp (src/lib/capability.ts refines after
// hydration). Reads the visitor's choice, a ?tier= test pin, then the cheap
// synchronous signals, and sets <html data-tier> before first paint so the
// lean/core CSS applies during the slow hydration window on exactly the
// devices that need it. Keep this in step with capabilityTier.js. The
// attribute is added outside React, hence suppressHydrationWarning on <html>.
const TIER_BOOT = `(function(){try{var ok={full:1,lean:1,core:1};var t=null;try{var c=localStorage.getItem("lusik_tier_v1");if(c&&ok[c])t=c;}catch(e){}
if(!t){try{var q=new URLSearchParams(location.search).get(${JSON.stringify(CONFIG.TIERS?.QUERY_PARAM || "tier")});if(q&&ok[q]){sessionStorage.setItem("lusik_tier_session_v1",q);t=q;}else{var s=sessionStorage.getItem("lusik_tier_session_v1");if(s&&ok[s])t=s;}}catch(e){}}
if(!t){var n=navigator.connection||{};var et=String(n.effectiveType||"");var m=navigator.deviceMemory;var k=navigator.hardwareConcurrency;
if(/(^|-)2g$/.test(et)||(typeof m=="number"&&m<2))t="core";else if(et==="3g"||n.saveData||(typeof m=="number"&&m<=3)||(typeof k=="number"&&k<=2))t="lean";}
if(t)document.documentElement.setAttribute("data-tier",t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {CONFIG.TIERS?.ENABLED !== false ? <script dangerouslySetInnerHTML={{ __html: TIER_BOOT }} /> : null}
        {/* JavaScript off is the "core" tier by definition and no script can stamp
            it, so the core motion cut rides in a <noscript> style instead. */}
        <noscript>
          <style>{`html{scroll-behavior:auto}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}`}</style>
        </noscript>
      </head>
      <body>
        {/* The Netlify Identity widget is loaded by <Providers> with
            strategy="afterInteractive" (off the critical render path) instead
            of beforeInteractive — see app/providers.tsx. Most visitors never
            sign in, so blocking initial render on third-party auth JS on every
            page was pure cost. The hash-token handler (auth.js) already retries
            for ~5s, so the email-confirmation / recovery flow is unaffected. */}
        {/* Site-wide Organization structured data (brand entity for search). */}
        <script {...jsonLdScript(organizationJsonLd())} />
        <Providers>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
