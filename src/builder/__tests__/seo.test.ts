// SEO Optimizer: fact extraction from saved HTML, the ruleset's
// scoring across the four pagespeed categories, the perf-is-estimate
// honesty, and that a clean page reaches 100%.
import { test } from "node:test";
import assert from "node:assert/strict";

import { extractFacts } from "../seo/facts.ts";
import { auditPage } from "../seo/rules.ts";

const GOOD = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hand cross-stitched Armenian baby blankets — Lusik & Sons</title>
<meta name="description" content="Heirloom Armenian alphabet baby blankets, hand cross-stitched in Buena Park, California, and made to order with love.">
<link rel="canonical" href="https://lusikandsons.com/">
<meta property="og:title" content="Lusik & Sons">
<meta property="og:image" content="/img/og.jpg">
<script type="application/ld+json">{"@type":"Organization"}</script>
</head><body>
<h1>Welcome</h1><h2>Our story</h2>
<img src="/img/a.jpg" alt="A finished blanket" width="800" height="800" loading="lazy">
<a href="/shop">Browse the blankets</a>
</body></html>`;

const BAD = `<html><head></head><body>
<h2>sub</h2><h4>skips</h4>
<img src="/img/huge.jpg">
<a href="http://insecure.example">click here</a>
<a href="/x"></a>
<script src="/app.js"></script>
</body></html>`;

test("extractFacts pulls every signal from saved HTML", () => {
  const f = extractFacts("index.html", GOOD);
  assert.equal(f.lang, "en");
  assert.match(f.title ?? "", /Lusik/);
  assert.ok(f.metaDescriptionLen > 50);
  assert.equal(f.hasViewport, true);
  assert.equal(f.hasCharset, true);
  assert.equal(f.canonical, "https://lusikandsons.com/");
  assert.equal(f.h1Count, 1);
  assert.equal(f.images[0].hasAlt, true);
  assert.equal(f.images[0].hasDimensions, true);
  assert.equal(f.images[0].lazy, true);
  assert.equal(f.hasJsonLd, true);
  assert.equal(f.ogImage, true);
  assert.equal(f.links[0].text, "Browse the blankets");
});

test("a clean page scores 100 on the three real categories", () => {
  // give the images real sizes via the lookup so perf is healthy too
  const f = extractFacts("index.html", GOOD, () => 120_000);
  const r = auditPage(f);
  const score = (c: string) => r.scores.find((s) => s.category === c)!.score;
  assert.equal(score("seo"), 100);
  assert.equal(score("accessibility"), 100);
  assert.equal(score("best-practices"), 100);
  assert.ok(score("performance") >= 90);
  assert.equal(r.fixes.length, 0);
});

test("a bad page fails the right rules with plain-language fixes", () => {
  const f = extractFacts("bad.html", BAD, () => 2_000_000); // huge images
  const r = auditPage(f);
  const ids = new Set(r.results.filter((x) => x.status !== "pass").map((x) => x.id));
  assert.ok(ids.has("seo-title"));          // missing title
  assert.ok(ids.has("seo-meta-description"));
  assert.ok(ids.has("seo-lang"));
  assert.ok(ids.has("a11y-img-alt"));       // image without alt
  assert.ok(ids.has("a11y-link-name"));     // empty link
  assert.ok(ids.has("bp-https-links"));     // http link
  assert.ok(ids.has("seo-link-text"));      // "click here"
  assert.ok(ids.has("perf-total-weight"));  // way over budget
  // every fix is actionable text, not a code
  for (const fx of r.fixes) assert.ok(fx.fix.length > 15, fx.id);
  // worst-first: fails before warns
  assert.equal(r.fixes[0].status, "fail");
});

test("performance is flagged as an estimate; the others are not", () => {
  const r = auditPage(extractFacts("x.html", GOOD));
  assert.equal(r.scores.find((s) => s.category === "performance")!.estimate, true);
  assert.equal(r.scores.find((s) => s.category === "seo")!.estimate, false);
});

test("noindex tanks the SEO score (indexability is heavily weighted)", () => {
  const withNoindex = GOOD.replace("<title>", '<meta name="robots" content="noindex"><title>');
  const r = auditPage(extractFacts("x.html", withNoindex, () => 100_000));
  assert.ok(r.scores.find((s) => s.category === "seo")!.score < 100);
  assert.ok(r.fixes.some((fx) => fx.id === "seo-indexable" && fx.status === "fail"));
});
