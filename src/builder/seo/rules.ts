// ============================================================
// SEO Optimizer — the audit ruleset + scoring (pure, the dataset)
// ============================================================
// Lighthouse-inspired audits across the four pagespeed.web.dev
// categories. Each rule is data: id, category, weight, a check
// over PageFacts, and a PLAIN-LANGUAGE fix. The four category
// scores are weighted pass-ratios (0–100), exactly the shape
// pagespeed reports.
//
// THE HONESTY LINE: SEO, Accessibility and Best-Practices are
// genuinely measurable from saved HTML — those scores are real.
// PERFORMANCE's true number needs a live browser (Core Web
// Vitals are runtime), so its score here is a STATIC ESTIMATE
// from byte weight + render-blocking + image hygiene, and every
// performance result says so and points the user to run the live
// pagespeed.web.dev when online to confirm.
// ============================================================

import type { PageFacts } from "./facts.ts";

export type Category = "performance" | "accessibility" | "best-practices" | "seo";
export type Status = "pass" | "warn" | "fail";

export interface AuditResult {
  id: string;
  category: Category;
  title: string;
  status: Status;
  weight: number;
  detail: string;
  /** What to change — empty when passing. */
  fix: string;
}

interface Rule {
  id: string;
  category: Category;
  title: string;
  weight: number;
  /** Returns [status, detail, fix]. */
  check: (f: PageFacts) => [Status, string, string];
}

const PERF_BUDGET = 1_600_000; // ~1.6 MB total transfer = healthy
const ok: [Status, string, string] = ["pass", "", ""];

export const RULES: Rule[] = [
  // ── SEO ───────────────────────────────────────────────────
  {
    id: "seo-title", category: "seo", title: "Page has a good <title>", weight: 3,
    check: (f) =>
      !f.title ? ["fail", "missing", "Add a <title> in the page's SEO panel — it's the headline in search results."]
      : f.titleLen > 60 ? ["warn", `${f.titleLen} chars`, "Trim the title under 60 characters so search engines don't cut it off."]
      : f.titleLen < 10 ? ["warn", `${f.titleLen} chars`, "Make the title more descriptive (aim 30–60 characters)."]
      : ok,
  },
  {
    id: "seo-meta-description", category: "seo", title: "Has a meta description", weight: 2,
    check: (f) =>
      !f.metaDescription ? ["fail", "missing", "Add a description in the SEO panel (≈120–155 chars) — it's the gray text under your link in Google."]
      : f.metaDescriptionLen > 160 ? ["warn", `${f.metaDescriptionLen} chars`, "Shorten the description under 160 characters."]
      : ok,
  },
  {
    id: "seo-lang", category: "seo", title: "<html> has a lang attribute", weight: 1,
    check: (f) => (f.lang ? ok : ["fail", "missing", "Set the page language — the export does this automatically once languages are configured."]),
  },
  {
    id: "seo-viewport", category: "seo", title: "Has a mobile viewport tag", weight: 2,
    check: (f) => (f.hasViewport ? ok : ["fail", "missing", "Add the viewport meta tag — the builder's export includes it by default."]),
  },
  {
    id: "seo-indexable", category: "seo", title: "Page is indexable", weight: 3,
    check: (f) => (f.robotsNoindex ? ["fail", "noindex set", "This page tells search engines to ignore it (robots noindex). Remove that unless it's intentional."] : ok),
  },
  {
    id: "seo-canonical", category: "seo", title: "Has a canonical URL", weight: 1,
    check: (f) => (f.canonical ? ok : ["warn", "missing", "A canonical link tells search engines the page's true address — helpful once the site has a real domain."]),
  },
  {
    id: "seo-link-text", category: "seo", title: "Links have descriptive text", weight: 1,
    check: (f) => {
      const bad = f.links.filter((l) => l.href && !/^#/.test(l.href) && (!l.text || /^(click here|here|read more|link|→)$/i.test(l.text)));
      return bad.length === 0 ? ok : ["warn", `${bad.length} vague link(s)`, "Replace 'click here'/'read more' with text that says where the link goes."];
    },
  },
  {
    id: "seo-structured-data", category: "seo", title: "Has structured data (JSON-LD)", weight: 1,
    check: (f) => (f.hasJsonLd ? ok : ["warn", "none", "Structured data (JSON-LD) helps rich results — add it for products/articles when relevant."]),
  },

  // ── Accessibility ─────────────────────────────────────────
  {
    id: "a11y-img-alt", category: "accessibility", title: "Images have alt text", weight: 3,
    check: (f) => {
      const missing = f.images.filter((i) => !i.hasAlt);
      return missing.length === 0 ? ok : ["fail", `${missing.length} image(s)`, "Add alt text to every image (the image block's Alt field). Decorative images may use an empty alt on purpose."];
    },
  },
  {
    id: "a11y-one-h1", category: "accessibility", title: "Exactly one <h1>", weight: 2,
    check: (f) =>
      f.h1Count === 1 ? ok
      : f.h1Count === 0 ? ["warn", "no h1", "Give the page one main heading (an h1) — usually the section heading at the top."]
      : ["warn", `${f.h1Count} h1s`, "Use a single h1 per page; make the rest h2/h3."],
  },
  {
    id: "a11y-heading-order", category: "accessibility", title: "Headings don't skip levels", weight: 1,
    check: (f) => {
      let skip = false;
      for (let i = 1; i < f.headings.length; i++) if (f.headings[i] - f.headings[i - 1] > 1) skip = true;
      return skip ? ["warn", "level skipped", "Don't jump from h2 to h4 — step one level at a time so screen readers follow the outline."] : ok;
    },
  },
  {
    id: "a11y-lang", category: "accessibility", title: "Document language is set", weight: 1,
    check: (f) => (f.lang ? ok : ["fail", "missing", "Set the <html> lang attribute (the export handles this with languages configured)."]),
  },
  {
    id: "a11y-link-name", category: "accessibility", title: "Links have an accessible name", weight: 2,
    check: (f) => {
      const empty = f.links.filter((l) => l.href && !l.text);
      return empty.length === 0 ? ok : ["fail", `${empty.length} empty link(s)`, "Every link needs visible text or an aria-label (icon-only links especially)."];
    },
  },

  // ── Best Practices ────────────────────────────────────────
  {
    id: "bp-charset", category: "best-practices", title: "Charset declared", weight: 1,
    check: (f) => (f.hasCharset ? ok : ["fail", "missing", "Declare <meta charset='utf-8'> — the export does this automatically."]),
  },
  {
    id: "bp-https-links", category: "best-practices", title: "External links use https", weight: 2,
    check: (f) => {
      const insecure = f.links.filter((l) => /^http:\/\//i.test(l.href));
      return insecure.length === 0 ? ok : ["fail", `${insecure.length} http link(s)`, "Switch external links to https:// — modern browsers flag insecure ones."];
    },
  },
  {
    id: "bp-img-dimensions", category: "best-practices", title: "Images have width & height", weight: 2,
    check: (f) => {
      const without = f.images.filter((i) => !i.hasDimensions);
      return without.length === 0 || f.images.length === 0 ? ok : ["warn", `${without.length} image(s)`, "Give images width & height so the page doesn't jump while loading (helps the CLS score too)."];
    },
  },
  {
    id: "bp-og", category: "best-practices", title: "Has Open Graph tags", weight: 1,
    check: (f) => (f.ogTitle && f.ogImage ? ok : ["warn", "incomplete", "Add a social share image in the SEO panel so links look good when shared."]),
  },

  // ── Performance (STATIC ESTIMATE — see header) ────────────
  {
    id: "perf-total-weight", category: "performance", title: "Total page weight", weight: 3,
    check: (f) =>
      f.totalBytes <= PERF_BUDGET ? ["pass", `${(f.totalBytes / 1024 / 1024).toFixed(2)} MB`, ""]
      : ["fail", `${(f.totalBytes / 1024 / 1024).toFixed(2)} MB`, `Page is over ${(PERF_BUDGET / 1024 / 1024).toFixed(1)} MB — resize the biggest images (the Audit panel's page-weight row shows which).`],
  },
  {
    id: "perf-largest-image", category: "performance", title: "Largest image is reasonable", weight: 2,
    check: (f) =>
      f.largestImageBytes <= 500_000 ? ok
      : ["warn", `${Math.round(f.largestImageBytes / 1024)} KB`, "Your biggest image is large — it's likely the slowest thing to paint (LCP). Resize/compress it to under ~500 KB."],
  },
  {
    id: "perf-img-lazy", category: "performance", title: "Below-the-fold images lazy-load", weight: 1,
    check: (f) => {
      const eager = f.images.slice(1).filter((i) => !i.lazy);
      return f.images.length <= 1 || eager.length === 0 ? ok : ["warn", `${eager.length} eager`, "Add loading='lazy' to images further down — the builder's image block does this automatically."];
    },
  },
  {
    id: "perf-render-blocking", category: "performance", title: "Few render-blocking scripts", weight: 2,
    check: (f) => {
      const blocking = f.scripts.filter((s) => s.src && !s.async && !s.defer);
      return blocking.length === 0 ? ok : ["warn", `${blocking.length} blocking`, "Render-blocking scripts delay the page — add async/defer (builder exports are script-light by design)."];
    },
  },
];

export interface CategoryScore {
  category: Category;
  score: number; // 0–100
  estimate: boolean; // true for performance (static estimate)
}

export interface PageReport {
  file: string;
  scores: CategoryScore[];
  results: AuditResult[];
  /** Worst-first list of what to fix to lift the scores. */
  fixes: AuditResult[];
}

const STATUS_CREDIT: Record<Status, number> = { pass: 1, warn: 0.5, fail: 0 };

export function auditPage(f: PageFacts): PageReport {
  const results: AuditResult[] = RULES.map((r) => {
    const [status, detail, fix] = r.check(f);
    return { id: r.id, category: r.category, title: r.title, status, weight: r.weight, detail, fix };
  });

  const cats: Category[] = ["performance", "accessibility", "best-practices", "seo"];
  const scores: CategoryScore[] = cats.map((category) => {
    const rs = results.filter((r) => r.category === category);
    const total = rs.reduce((s, r) => s + r.weight, 0);
    const got = rs.reduce((s, r) => s + r.weight * STATUS_CREDIT[r.status], 0);
    return { category, score: total ? Math.round((got / total) * 100) : 100, estimate: category === "performance" };
  });

  const fixes = results
    .filter((r) => r.status !== "pass")
    .sort((a, b) => (STATUS_CREDIT[a.status] - STATUS_CREDIT[b.status]) || b.weight - a.weight);

  return { file: f.file, scores, results, fixes };
}
