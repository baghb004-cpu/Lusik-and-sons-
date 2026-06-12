// ============================================================
// Export — SEO infrastructure files (pure strings, plan §22)
// ============================================================
// Every static/PWA export ships sitemap.xml, robots.txt and a
// branded 404 page, built from the same rendered-page list the
// exporter already has. Multilingual exports get hreflang
// alternates so search engines understand the locale trees.
// ============================================================

import { escapeHtml } from "./static.ts";

export interface SitemapEntry {
  /** Root-absolute page path, e.g. "/" or "/hy/contact/". */
  path: string;
  locale: string;
  /** The page's slug — entries for the same slug across locales become alternates. */
  slug: string;
}

function xmlEscape(s: string): string {
  return escapeHtml(s).replace(/'/g, "&apos;");
}

export function sitemapXml(entries: SitemapEntry[], baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const bySlug = new Map<string, SitemapEntry[]>();
  for (const e of entries) {
    bySlug.set(e.slug, [...(bySlug.get(e.slug) ?? []), e]);
  }
  const urls = entries
    .map((e) => {
      const siblings = bySlug.get(e.slug) ?? [];
      const alternates =
        siblings.length > 1
          ? siblings
              .map((alt) => `\n    <xhtml:link rel="alternate" hreflang="${xmlEscape(alt.locale)}" href="${xmlEscape(base + alt.path)}" />`)
              .join("")
          : "";
      return `  <url>\n    <loc>${xmlEscape(base + e.path)}</loc>${alternates}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}

export function robotsTxt(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`;
}
