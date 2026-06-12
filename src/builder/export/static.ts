// ============================================================
// Export — static HTML document assembly (pure; no JSX here)
// ============================================================
// Takes a page's pre-rendered body HTML (export/render.tsx does
// the one renderToStaticMarkup call) and wraps it in a complete,
// honest HTML document: real <title>/<meta> from the page's SEO
// fields (structure renderer-owned, per plan §5), the compiled
// theme variables, the compiled utility CSS, and the override
// layers as @media rules. Zero JavaScript emitted.
// ============================================================

import type { OverrideLayer, Page, Theme } from "../schema/index.ts";
import { themeToCssVars } from "../theme/css.ts";
import { layersToMediaCss } from "./css.ts";
import { SW_REGISTER_SNIPPET } from "../app/pwa.ts";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface StaticPageInput {
  page: Page;
  bodyHtml: string;
  layers: OverrideLayer[];
  theme: Theme | null;
  /** Compiled utility CSS (Tailwind subset) shared across pages. */
  stylesheetHref: string;
  siteName: string;
  /** PWA export: manifest link + theme-color + the 1-line SW registration
   *  (the ONLY script — the plain static target stays zero-JS). */
  pwa?: boolean;
}

export function assembleHtmlDocument(input: StaticPageInput): string {
  const { page, bodyHtml, layers, theme, stylesheetHref, siteName, pwa } = input;
  const title = escapeHtml(page.seo.title ?? `${page.title} — ${siteName}`);
  const description = page.seo.description ? `\n    <meta name="description" content="${escapeHtml(page.seo.description)}" />` : "";
  const og = page.seo.ogImage ? `\n    <meta property="og:image" content="${escapeHtml(page.seo.ogImage)}" />` : "";
  const themeCss = theme ? themeToCssVars(theme) : "";
  const mediaCss = layersToMediaCss(layers);
  const pwaHead = pwa
    ? `\n    <link rel="manifest" href="/manifest.webmanifest" />\n    <meta name="theme-color" content="${escapeHtml(theme?.tokens.colors.ink ?? "#1A1612")}" />`
    : "";
  const pwaScript = pwa ? `\n    ${SW_REGISTER_SNIPPET}` : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${title}</title>${description}${og}${pwaHead}
    <link rel="stylesheet" href="${stylesheetHref}" />
    <style>
${themeCss}
${mediaCss}
    </style>${pwaScript}
  </head>
  <body class="bg-cream font-body text-ink">
    <main>
${bodyHtml}
    </main>
  </body>
</html>
`;
}

export function pageFileName(page: Page): string {
  return page.slug === "index" ? "index.html" : `${page.slug}/index.html`;
}
