// ============================================================
// Export — static HTML document assembly (pure; no JSX here)
// ============================================================
// Takes a page's pre-rendered body HTML (export/render.tsx does
// the one renderToStaticMarkup call) and wraps it in a complete,
// honest HTML document: real <title>/<meta> from the page's SEO
// fields (structure renderer-owned, per plan §5), the compiled
// theme variables, the compiled utility CSS, and the override
// layers as @media rules. The ASSEMBLER emits zero JavaScript;
// the only script a page can carry is one a block inlines in its
// own markup (today: sectionJumper's ~30-line progressive
// enhancement, which the page works fine without).
// ============================================================

import type { OverrideLayer, Page, Theme } from "../schema/index.ts";
import { themeToCssVars } from "../theme/css.ts";
import { layersToMediaCss } from "./css.ts";
import { SW_REGISTER_SNIPPET } from "../app/pwa.ts";

// Printable business documents (INSPIRATION_ROADMAP P2): every exported
// page is print-ready — fixed UI hidden, tables/sections kept whole,
// external link URLs shown. "Save as PDF" in any browser = the PDF export.
export const PRINT_CSS = `@media print {
  nav, [data-bt-candle], video, iframe, button { display: none !important; }
  section, table, figure { break-inside: avoid; }
  a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 0.8em; color: #555; }
  body { background: #fff !important; color: #000 !important; }
}`;

// Slides-inspired deck (the "deck" export target): every top-level
// section snaps to a full screen. Pure CSS over the same renderer.
export const DECK_CSS = `html { scroll-snap-type: y mandatory; }
main > div > section, main > section { min-height: 100vh; scroll-snap-align: start; display: flex; flex-direction: column; justify-content: center; }`;

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
  /** Offline-languages: <html lang/dir> + the bundled i18n.css (fonts + dir). */
  lang?: string;
  dir?: "ltr" | "rtl";
  i18nHref?: string;
  /** Day/Night/Candlelight (plan §19): the compiled appearance CSS and the
   *  anti-flash <head> bootstrap that applies the visitor's saved mode
   *  before first paint. Both optional — omitted = today's zero-JS pages. */
  appearance?: { css: string; bootstrap: string };
  /** Target-specific stylesheet additions (e.g. the deck's scroll-snap). */
  extraCss?: string;
}

export function assembleHtmlDocument(input: StaticPageInput): string {
  const { page, bodyHtml, layers, theme, stylesheetHref, siteName, pwa, lang, dir, i18nHref, appearance, extraCss } = input;
  const title = escapeHtml(page.seo.title ?? `${page.title} — ${siteName}`);
  const description = page.seo.description ? `\n    <meta name="description" content="${escapeHtml(page.seo.description)}" />` : "";
  const og = page.seo.ogImage ? `\n    <meta property="og:image" content="${escapeHtml(page.seo.ogImage)}" />` : "";
  const themeCss = theme ? themeToCssVars(theme) : "";
  const mediaCss = layersToMediaCss(layers);
  const pwaHead = pwa
    ? `\n    <link rel="manifest" href="/manifest.webmanifest" />\n    <meta name="theme-color" content="${escapeHtml(theme?.tokens.colors.ink ?? "#1A1612")}" />`
    : "";
  const i18nLink = i18nHref ? `\n    <link rel="stylesheet" href="${i18nHref}" />` : "";
  const pwaScript = pwa ? `\n    ${SW_REGISTER_SNIPPET}` : "";
  const appearanceCssBlock = appearance ? `\n${appearance.css}` : "";
  // The bootstrap runs in <head>, before first paint — no wrong-mode flash.
  const appearanceScript = appearance ? `\n    <script>${appearance.bootstrap}</script>` : "";

  return `<!doctype html>
<html lang="${lang ?? "en"}" dir="${dir ?? "ltr"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${title}</title>${description}${og}${pwaHead}
    <link rel="stylesheet" href="${stylesheetHref}" />${i18nLink}
    <style>
${themeCss}${appearanceCssBlock}
${mediaCss}
${PRINT_CSS}${extraCss ? `\n${extraCss}` : ""}
    </style>${appearanceScript}${pwaScript}
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
