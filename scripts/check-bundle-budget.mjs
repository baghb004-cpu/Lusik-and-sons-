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

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const NEXT_DIR = join(__dirname, "..", ".next");

const PER_ROUTE_BUDGET_KB = 210;

// ---- Named async chunks -------------------------------------------------
// The Loom (the 3D product engine, src/loom/**) is loaded with next/dynamic
// and must stay OUT of every route's first-load JS. Two things can go wrong
// and neither is visible in the per-route number above:
//
//   1. The engine chunk quietly grows. three's core is ~150 KB gzip when
//      tree-shaken; the rest is ours. 230 KB is the ceiling.
//   2. Someone imports from src/loom/ statically — a type-only import that
//      isn't `import type`, a barrel re-export — and webpack folds the whole
//      engine into a route's first load. The route budget WOULD catch that,
//      but only after it has already blown past 210 KB, and the error would
//      name the route rather than the real cause. This names the cause.
//
// Identifying the chunk: Next hashes async chunk filenames, so "loom" never
// appears in them, and no build artifact maps a chunk back to its source
// modules. Instead the engine stamps a build tag into the DOM
// (LOOM_BUILD_TAG in src/loom/index.ts), so the string is a real runtime
// value that survives minification and cannot be tree-shaken away. Any
// chunk containing it is an engine chunk.
const ASYNC_CHUNK_BUDGETS = [
  { name: "loom", tag: "lusik-loom-v1", budgetKb: 230 },
];

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

// ---- async chunk budgets ------------------------------------------------
const CHUNK_DIR = join(NEXT_DIR, "static", "chunks");

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".js")) out.push(full);
  }
  return out;
}

const allChunks = walk(CHUNK_DIR);
// Every JS file any route pulls in on first load, as manifest-relative paths.
const firstLoadFiles = new Set();
for (const [route, files] of Object.entries(manifest.pages)) {
  if (!route.endsWith("/page")) continue;
  for (const f of files) if (f.endsWith(".js")) firstLoadFiles.add(f);
}

for (const budget of ASYNC_CHUNK_BUDGETS) {
  const hits = [];
  for (const file of allChunks) {
    let body;
    try { body = readFileSync(file, "utf8"); } catch { continue; }
    if (!body.includes(budget.tag)) continue;
    hits.push(file);
  }
  if (hits.length === 0) {
    console.log(`bundle-budget: no ${budget.name} chunk in this build (nothing to measure)`);
    continue;
  }
  let totalKb = 0;
  for (const file of hits) {
    totalKb += gzipSync(readFileSync(file)).length / 1024;
    // A route must never pull the engine in on first load.
    const rel = relative(NEXT_DIR, file).split("\\").join("/");
    if (firstLoadFiles.has(rel)) {
      failures.push([
        `${budget.name} chunk in first-load JS (${rel})`,
        totalKb,
      ]);
    }
  }
  console.log(
    `bundle-budget: ${budget.name} async chunk ${totalKb.toFixed(0)} KB gzip across ` +
    `${hits.length} file(s) (budget ${budget.budgetKb} KB)`
  );
  if (totalKb > budget.budgetKb) failures.push([`${budget.name} async chunk`, totalKb]);
}

if (failures.length) {
  const list = failures.map(([what, kb]) => `  ${what} — ${kb.toFixed(1)} KB`).join("\n");
  throw new Error(
    `[bundle-budget] over budget in ${failures.length} place(s):\n${list}\n` +
    `Route budget is ${PER_ROUTE_BUDGET_KB} KB gzip first-load; async chunk budgets are in ` +
    `ASYNC_CHUNK_BUDGETS. Find the cause with \`npm run analyze\` (route-by-route treemap).\n` +
    `If an engine chunk turned up in a route's FIRST-LOAD list, the cause is almost always a ` +
    `static import of src/loom/ somewhere — a type import missing the \`type\` keyword, or a ` +
    `barrel re-export. The Loom must only ever be reached through next/dynamic.\n` +
    `If the growth is intentional, raise the number in scripts/check-bundle-budget.mjs in the same PR.`
  );
}
