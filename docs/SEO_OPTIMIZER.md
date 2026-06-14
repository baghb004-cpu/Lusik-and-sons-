# SEO Optimizer — the separate offline analyzer (plan §24)

A standalone program that scans a **saved/exported** copy of a site and
tells the user exactly what to change to reach 100% across all four
[pagespeed.web.dev](https://pagespeed.web.dev) categories — fully offline,
baked into the thumb drive.

## Why it's separate (and how it stays honest)

The builder makes pages; this *grades* them. It reads the exported HTML
(and the real on-disk sizes of the CSS/JS/images each page references),
runs a Lighthouse-inspired ruleset (the baked-in "dataset"), and prints
per-page scores plus a worst-first to-do list.

**The honest line, stated everywhere it matters:**

- **SEO, Accessibility, Best Practices** are genuinely computable from
  saved HTML — titles, meta, headings, alt text, link text, https,
  charset, structured data, Open Graph. Those scores are **real**.
- **Performance** is the one category whose true number (Core Web Vitals:
  LCP/CLS/TBT) requires a **live browser run**. This tool gives a
  defensible **static estimate** from total byte weight, the largest
  image (LCP proxy), render-blocking scripts, and lazy-loading — and
  every Performance result is flagged `(estimate*)` with a note to
  confirm the live score at pagespeed.web.dev when online.

That honesty is a feature: it reaches 100% on the three real categories
offline, and gets you 95% of the way on Performance without lying about
the 5% only a real browser can measure.

## Two ways to run it

1. **The separate program (accurate):**
   ```
   node scripts/seo-audit.mjs exports/2026-…-static
   node scripts/seo-audit.mjs ./my-site --json report.json
   ```
   Point it at any exported folder. Because the files are on disk it
   sizes the actual images/CSS/JS, so the Performance estimate is its
   best. Exit code is non-zero if anything is below 90 (CI-friendly).

2. **In-builder quick check (instant):** the **🔍 SEO** button on a page
   renders it to HTML in memory and scores it immediately — great while
   editing. It can't see real asset sizes yet (nothing's written), so
   use the CLI on a real export for the exact Performance number.

## How to actually reach 100%

The to-do list is plain language ("Add a description in the SEO panel",
"Add alt text to every image", "Resize the biggest image under 500 KB").
Most fixes are one edit in the SEO panel, the image block, or the theme
— then re-export and re-run. The builder's own exports already pass most
Best-Practices/SEO rules by construction (viewport, charset, lang,
print/SEO files, lazy images), so the list is usually short.

## Recommendations baked in (the ruleset)

| Category | Sample audits |
| --- | --- |
| SEO | title length, meta description, lang, viewport, indexable (noindex), canonical, descriptive link text, JSON-LD |
| Accessibility | image alt text, single h1, heading order, document language, links have names |
| Best Practices | charset, https links, image width/height (CLS), Open Graph |
| Performance (estimate) | total page weight vs ~1.6 MB, largest image vs ~500 KB, lazy-loading, render-blocking scripts |

The ruleset lives in `src/builder/seo/rules.ts` as data — adding an audit
is one entry. Everything is pure and unit-tested; the analyzer has zero
runtime dependencies (regex extraction, no HTML-parser install).
