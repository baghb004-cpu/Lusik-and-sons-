// ============================================================
// migration-api-contract.test.mjs — backend ↔ Next.js contract
// ============================================================
// Phase 6 of the Vite→Next migration keeps netlify/functions/* as the API
// (Netlify serves them alongside Next; they are NOT migrated to app/api).
// These tests lock in the invariants that keep that working once production
// flips to the Next runtime at Phase 8, so a future change can't silently
// break the Stripe webhook or the db/auth fetch layer:
//
//   1. /api/stripe-webhook still rewrites to the function (Stripe's endpoint).
//   2. No app/api/* route exists that would let Next shadow /api or the
//      function paths.
//   3. The db layer targets functions by a RELATIVE base (/.netlify/functions),
//      so the same calls resolve under both the Vite and the Next builds.
//   4. The functions directory + the Stripe webhook handler are intact.
//
// Final end-to-end resolution under the Netlify Next runtime is confirmed on
// the Phase 8 deploy preview (it needs the real redirect engine + functions
// runtime, which only exist on Netlify).
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(join(ROOT, p), "utf8");

test("netlify.toml rewrites /api/stripe-webhook to the function", () => {
  const toml = read("netlify.toml");
  // The redirect block must map the clean /api path to the function, status 200.
  assert.match(toml, /from\s*=\s*"\/api\/stripe-webhook"/, "missing /api/stripe-webhook redirect");
  assert.match(
    toml,
    /to\s*=\s*"\/\.netlify\/functions\/stripe-webhook"/,
    "/api/stripe-webhook must rewrite to /.netlify/functions/stripe-webhook",
  );
});

test("functions directory is configured + the webhook handler exists", () => {
  const toml = read("netlify.toml");
  assert.match(toml, /directory\s*=\s*"netlify\/functions"/, "functions directory not configured");
  assert.ok(existsSync(join(ROOT, "netlify/functions/stripe-webhook.mjs")), "stripe-webhook.mjs missing");
  // A couple of the db/auth-backed endpoints the client calls through `db`.
  for (const fn of ["profile.mjs", "orders.mjs", "create-checkout-session.mjs"]) {
    assert.ok(existsSync(join(ROOT, "netlify/functions", fn)), `${fn} missing`);
  }
});

test("no app/api route shadows the function paths under Next", () => {
  // If an app/api/** route existed, Next would claim /api/* and could
  // intercept the webhook before Netlify's redirect runs. Keep it empty.
  assert.ok(!existsSync(join(ROOT, "app/api")), "app/api exists — it would shadow the Netlify function routes");
});

test("the db layer targets functions by a relative, framework-agnostic base", () => {
  // FN_BASE must stay relative so the identical fetch resolves under both the
  // Vite build and the Next build (Netlify serves /.netlify/functions/* either way).
  const config = read("src/data/config.js");
  assert.match(config, /FN_BASE:\s*"\/\.netlify\/functions"/, "CONFIG.FN_BASE must be the relative /.netlify/functions");

  const db = read("src/lib/db.js");
  assert.match(db, /\$\{\s*CONFIG\.FN_BASE\s*\}/, "db.js must build URLs from CONFIG.FN_BASE");
  // No hard-coded absolute API origin that would pin calls to one deploy.
  assert.ok(!/fetch\(\s*["'`]https?:\/\//.test(db), "db.js must not fetch an absolute API origin");
});
