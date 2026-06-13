#!/usr/bin/env node
// ============================================================
// seo-audit.mjs — the offline SEO Optimizer (separate program)
// ============================================================
// Point it at an EXPORTED site folder (the kind the builder
// writes to exports/…). It reads the saved .html, resolves the
// real on-disk sizes of the CSS/JS/images each page references,
// runs the Lighthouse-inspired ruleset, and prints per-page
// scores for all four pagespeed.web.dev categories plus an
// exact, worst-first to-do list to reach 100%.
//
//   node scripts/seo-audit.mjs exports/2026-…-static
//   node scripts/seo-audit.mjs ./my-site --json report.json
//
// 100% offline: it reads only files you already exported, makes
// no network calls. SEO/Accessibility/Best-Practices scores are
// real; Performance is a static ESTIMATE (Core Web Vitals need a
// live browser) — confirm the live number on pagespeed.web.dev
// when you're online.
// ============================================================

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const { extractFacts } = await import(join(repo, "src/builder/seo/facts.ts"));
const { auditPage } = await import(join(repo, "src/builder/seo/rules.ts"));

const target = process.argv[2];
const jsonIdx = process.argv.indexOf("--json");
const jsonOut = jsonIdx !== -1 ? process.argv[jsonIdx + 1] : null;

if (!target || !existsSync(target)) {
  console.error("Usage: node scripts/seo-audit.mjs <exported-site-folder> [--json out.json]");
  console.error("Tip: export your site first (static/PWA target), then point this at that folder.");
  process.exit(2);
}

const root = resolve(target);
const htmlFiles = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) htmlFiles.push(p);
  }
})(root);

if (htmlFiles.length === 0) {
  console.error(`No .html files under ${root} — is this an exported site folder?`);
  process.exit(2);
}

// Resolve a referenced path (e.g. "styles.css", "/img/uploads/x.jpg") to a
// real byte size on disk, relative to the page's folder OR the export root.
const sizeFor = (pageDir) => (rel) => {
  if (!rel || /^https?:|^data:/i.test(rel)) return undefined;
  const clean = rel.split(/[?#]/)[0];
  for (const base of [pageDir, root]) {
    const candidate = join(base, clean.replace(/^\//, ""));
    try {
      if (existsSync(candidate)) return statSync(candidate).size;
    } catch { /* keep trying */ }
  }
  return undefined;
};

const bar = (score) => {
  const filled = Math.round(score / 10);
  const mark = score >= 90 ? "🟢" : score >= 50 ? "🟠" : "🔴";
  return `${mark} ${"█".repeat(filled)}${"░".repeat(10 - filled)} ${score}`;
};

const reports = [];
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const facts = extractFacts(relative(root, file), html, sizeFor(dirname(file)));
  reports.push(auditPage(facts));
}

const LABEL = { performance: "Performance", accessibility: "Accessibility", "best-practices": "Best Practices", seo: "SEO" };

console.log(`\n  SEO Optimizer — ${htmlFiles.length} page(s) in ${root}\n  ${"─".repeat(54)}`);
for (const r of reports) {
  console.log(`\n  📄 ${r.file}`);
  for (const s of r.scores) {
    console.log(`     ${LABEL[s.category].padEnd(14)} ${bar(s.score)}${s.estimate ? "  (estimate*)" : ""}`);
  }
  if (r.fixes.length === 0) {
    console.log("     ✅ 100% across the board — nothing to change.");
  } else {
    console.log(`     To do (${r.fixes.length}):`);
    for (const fx of r.fixes) {
      const icon = fx.status === "fail" ? "⛔" : "⚠️";
      console.log(`       ${icon} [${LABEL[fx.category]}] ${fx.title}${fx.detail ? ` — ${fx.detail}` : ""}`);
      console.log(`          → ${fx.fix}`);
    }
  }
}

// Site-wide averages
const cats = ["performance", "accessibility", "best-practices", "seo"];
const avg = (c) => Math.round(reports.reduce((s, r) => s + r.scores.find((x) => x.category === c).score, 0) / reports.length);
console.log(`\n  ${"─".repeat(54)}\n  Site average:`);
for (const c of cats) console.log(`     ${LABEL[c].padEnd(14)} ${bar(avg(c))}${c === "performance" ? "  (estimate*)" : ""}`);
console.log("\n  * Performance is a static estimate from file weight + render-blocking.");
console.log("    Confirm the real Core Web Vitals at https://pagespeed.web.dev when online.\n");

if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify({ root, generatedAt: new Date().toISOString(), reports }, null, 2));
  console.log(`  Full machine-readable report → ${jsonOut}\n`);
}

const worst = Math.min(...reports.flatMap((r) => r.scores.map((s) => s.score)));
process.exitCode = worst >= 90 ? 0 : 1; // CI-friendly: non-zero if anything is below 90
