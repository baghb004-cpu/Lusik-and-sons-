/** @type {import('next').NextConfig} */
// Production build for Lusik & Sons. The site is served by Next.js on Netlify
// via @netlify/plugin-nextjs (see netlify.toml). The site is built and served
// entirely by Next.js; the old Vite build (index.html / src/main.jsx / App.jsx)
// has been retired and removed.

// ── Security headers ────────────────────────────────────────
// IMPORTANT: the `[[headers]]` blocks in netlify.toml only apply to STATIC
// files served straight off the Netlify CDN (/_next/static, /img, /fonts, the
// public/ tree). They do NOT apply to pages rendered through the Next.js
// runtime — so /, /admin, /account, /checkout, every route — used to ship with
// NO Content-Security-Policy and NO X-Frame-Options. These headers() entries
// are what actually protect the HTML pages; the netlify.toml copy is kept in
// sync for the static assets (and the looser /studio/* CMS policy lives only
// there). Change one, change the other.
//
// CSP notes:
//   - 'unsafe-inline' in script-src/style-src is required by Next's inline
//     hydration bootstrap and the inline ad-pixel snippets; matches the prior
//     policy. No nonce pipeline is wired up.
//   - The ad/analytics hosts (connect.facebook.net, googletagmanager.com, etc.)
//     are required by the consent-gated Meta Pixel + Google Ads tags in
//     app/providers.tsx. Without them a correctly-delivered CSP would silently
//     break conversion tracking.
//   - https://*.sentry.io covers the (DSN-gated) Sentry ingest endpoint.
//   - Fonts are self-hosted via next/font (served from /_next + /fonts), so no
//     fonts.googleapis.com / fonts.gstatic.com is needed.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://identity.netlify.com https://cloud.umami.is https://connect.facebook.net https://www.googletagmanager.com https://www.googleadservices.com https://www.google.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://identity.netlify.com https://*.netlify.app https://cloud.umami.is https://*.sentry.io https://connect.facebook.net https://www.facebook.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google.com https://googleads.g.doubleclick.net https://www.googleadservices.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://*.doubleclick.net",
  "child-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://*.doubleclick.net",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig = {
  reactStrictMode: true,
  // The builder's export API compiles utility CSS at request time
  // (admin-gated, local mode). Tailwind/postcss must load from real
  // node_modules — bundled into a server chunk, Tailwind's preflight
  // can't find its own asset files.
  serverExternalPackages: ["tailwindcss", "postcss"],
  // Serve images in the smallest modern format the browser accepts. AVIF first
  // (typically 20–30% smaller than WebP), WebP fallback, then the original.
  // The Netlify image CDN (@netlify/plugin-nextjs) handles the negotiation.
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

// `npm run analyze` wraps the build with @next/bundle-analyzer (treemaps in
// .next/analyze) for diagnosing bundle-budget failures. Zero cost otherwise.
const withAnalyzer = process.env.ANALYZE === "true"
  ? (await import("@next/bundle-analyzer")).default({ enabled: true })
  : (c) => c;

export default withAnalyzer(nextConfig);
