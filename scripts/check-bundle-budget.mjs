// ============================================================
// check-bundle-budget.mjs — the "don't weigh the site down" gate
// ============================================================
// Runs automatically after every `next build` (postnext:build), which
// means locally, in CI's e2e webServer, AND on Netlify deploys: a PR
// that pushes a route's first-load JavaScript past the budget fails
// the build with a named offender instead of shipping a slower site.
//
// How it measures: .next/app-build-manifest.json lists every JS file a
// route needs for first load (shared chunks included). We gzip each
// unique file (what the CDN actually sends) and sum per route — the
// same number `next build` prints as "First Load JS".
//
// Budgets (gzip). Current ceiling is the product page at ~183 KB; the
// budget gives ~15% headroom so normal work never trips it but a
// regression (a new dependency, an accidental barrel import, a
// third-party SDK bundled eagerly) does. Raising a budget is allowed —
// in a PR, on purpose, with the number in the diff — never silently.
// ============================================================

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const NEXT_DIR = join(__dirname, "..", ".next");

const PER_ROUTE_BUDGET_KB = 210;

const manifest = JSON.parse(readFileSync(join(NEXT_DIR, "app-build-manifest.json"), "utf8"));

// Gzip each unique file once (routes share most chunks).
const gzipKb = new Map();
function sizeOf(file) {
  if (!gzipKb.has(file)) {
    try {
      gzipKb.set(file, gzipSync(readFileSync(join(NEXT_DIR, file))).length / 1024);
    } catch {
      gzipKb.set(file, 0); // CSS/map entries that may not exist as-is
    }
  }
  return gzipKb.get(file);
}

const failures = [];
const report = [];
for (const [route, files] of Object.entries(manifest.pages)) {
  // Only navigable page entries: "/layout" and "/template" list the shared
  // wrapper's own chunk set (every page entry already includes it) — they
  // aren't something a visitor loads on their own.
  if (!route.endsWith("/page")) continue;
  const js = files.filter((f) => f.endsWith(".js"));
  const total = js.reduce((n, f) => n + sizeOf(f), 0);
  report.push([route, total]);
  if (total > PER_ROUTE_BUDGET_KB) failures.push([route, total]);
}

report.sort((a, b) => b[1] - a[1]);
const top = report.slice(0, 5).map(([r, kb]) => `  ${kb.toFixed(0).padStart(4)} KB  ${r}`).join("\n");
console.log(`bundle-budget: heaviest routes (first-load JS, gzip; budget ${PER_ROUTE_BUDGET_KB} KB):\n${top}`);

if (failures.length) {
  const list = failures.map(([r, kb]) => `  ${r} — ${kb.toFixed(1)} KB (budget ${PER_ROUTE_BUDGET_KB} KB)`).join("\n");
  throw new Error(
    `[bundle-budget] first-load JS over budget on ${failures.length} route(s):\n${list}\n` +
    `Find the cause with \`npm run analyze\` (route-by-route treemap). If the growth is ` +
    `intentional, raise PER_ROUTE_BUDGET_KB in scripts/check-bundle-budget.mjs in the same PR.`
  );
}

// ── builder isolation gate ──────────────────────────────────
// The visual builder's editor chunk must NEVER ship to a public
// route. BuilderShell.tsx embeds a sentinel string; if it shows
// up in any first-load chunk of a route other than /builder,
// someone added a static import from src/builder/editor — fail
// the build with the offender named. (The /builder route itself
// loads the editor via next/dynamic, so even ITS first-load
// chunks should stay clean.)
const SENTINEL = "BUILDER_EDITOR_SENTINEL_9f3acaa1";
const offenders = [];
for (const [route, files] of Object.entries(manifest.pages)) {
  if (!route.endsWith("/page") || route === "/builder/page") continue;
  for (const file of files.filter((f) => f.endsWith(".js"))) {
    try {
      if (readFileSync(join(NEXT_DIR, file), "utf8").includes(SENTINEL)) {
        offenders.push(`${route} ← ${file}`);
      }
    } catch { /* chunk listed but absent — nothing to scan */ }
  }
}
if (offenders.length) {
  throw new Error(
    `[bundle-budget] builder editor code leaked into public-route first-load JS:\n  ` +
    offenders.join("\n  ") +
    `\nThe editor must only be reached via the dynamic import in src/builder/editor/BuilderRoute.tsx.`
  );
}
console.log("bundle-budget: builder editor isolation ✓ (no public route ships editor code)");
