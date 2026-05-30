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

/**
 * Build a Next Metadata object with an absolute canonical + OpenGraph.
 * @param {{ title: string, description?: string, path: string, type?: string, noindex?: boolean }} opts
 */
export function pageMetadata({ title, description, path, type = "website", noindex = false }) {
  const url = SITE_URL + path;
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
    },
    twitter: {
      card: "summary",
      title,
      description,
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
