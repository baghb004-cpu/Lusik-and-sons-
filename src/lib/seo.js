// ============================================================
// seo — per-route metadata + JSON-LD helpers (Next Metadata API)
// ============================================================
// Used by the server `page.tsx` route files (Phase 7) to emit real SSR
// <title> / description / canonical / OpenGraph and JSON-LD, so each URL
// indexes as its own page. The interactive bodies stay client islands; only
// the SEO-critical head + structured data are server-rendered here.
//
// Plain server-safe module (no "use client", no browser APIs) so it can run
// in generateMetadata at build time.
// ============================================================

export const SITE_URL = "https://lusikandsons.com";
export const SITE_NAME = "Lusik & Sons";

// Default social-share image for pages that don't supply their own (home,
// story, journal, etc.). Points at the flagship blanket's cover photo — a
// real product shot makes a far better link preview than a blank card.
// Swap to a dedicated 1200x630 branded card if Lusik provides one later.
export const DEFAULT_OG_IMAGE = "/img/abc-blanket/cover.jpg";

// OpenGraph/Twitter images must be absolute URLs. Pass through anything that
// is already absolute; prefix site-relative paths with SITE_URL.
function absoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return undefined;
  return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : SITE_URL + pathOrUrl;
}

/**
 * Build a Next Metadata object with an absolute canonical + OpenGraph + a
 * social-share image (so links unfurl with a preview instead of a blank card).
 * @param {{ title: string, description?: string, path: string, type?: string, image?: string, noindex?: boolean }} opts
 */
export function pageMetadata({ title, description, path, type = "website", image, noindex = false }) {
  const url = SITE_URL + path;
  const ogImage = absoluteUrl(image || DEFAULT_OG_IMAGE);
  const meta = {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type,
      images: ogImage ? [{ url: ogImage, alt: title }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
  if (noindex) meta.robots = { index: false, follow: false };
  return meta;
}

// Product structured data (schema.org/Product). Price is advertised "from"
// the catalog priceFrom when present; placeholders without a price omit offers.
export function productJsonLd(category, product) {
  const url = `${SITE_URL}/shop/${category.slug}/${product.slug}`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || product.tagline || "",
    brand: { "@type": "Brand", name: SITE_NAME },
    url,
    category: category.label,
  };
  if (product.coverImage || (product.gallery && product.gallery[0])) {
    ld.image = absoluteUrl(product.coverImage || product.gallery[0]);
  }
  if (product.priceFrom != null) {
    ld.offers = {
      "@type": "Offer",
      priceCurrency: "USD",
      price: String(product.priceFrom),
      availability: product.status === "live"
        ? "https://schema.org/InStock"
        : "https://schema.org/PreOrder",
      url,
    };
  }
  return ld;
}

// Journal post structured data (schema.org/BlogPosting).
export function postJsonLd(post) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || "",
    datePublished: post.publishedAt || undefined,
    url: `${SITE_URL}/journal/${post.slug}`,
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
  };
}

// Inline <script type="application/ld+json"> for a server component.
export function jsonLdScript(data) {
  return {
    type: "application/ld+json",
    // JSON.stringify escapes </script> closing via the < — but guard anyway.
    dangerouslySetInnerHTML: { __html: JSON.stringify(data).replace(/</g, "\\u003c") },
  };
}

// Organization structured data — emitted once site-wide from the root layout
// so search engines can build the brand entity (logo, locality, contact). No
// `sameAs` yet (no social profiles are wired); add the array when they exist.
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/icon-512.png"),
    description:
      "Hand cross-stitched Armenian alphabet baby blankets and embroidered baby goods, made to order in Cypress, California.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Cypress",
      addressRegion: "CA",
      addressCountry: "US",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "hello@lusikandsons.com",
      telephone: "+1-760-874-2333",
    },
  };
}
