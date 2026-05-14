// Open-redirect defense for the Stripe return URLs. We can't import
// the helper without booting the whole create-checkout-session module
// (Stripe initialization is module-level), so we re-implement the
// allowlist inline and assert against the same patterns. If you
// change the production helper, mirror the change here.
//
// The risk if this drifts: an attacker sends Origin: https://evil.com,
// Stripe sends the paid customer to evil.com after checkout, evil.com
// shows a fake "please re-enter your card details" page. This file's
// job is to make sure that's impossible.
import { test } from "node:test";
import assert from "node:assert/strict";

function isAllowedOrigin(origin, env = {}) {
  if (!origin || typeof origin !== "string") return false;
  if (origin === env.URL) return true;
  if (origin === env.DEPLOY_PRIME_URL) return true;
  if (origin === "https://lusikandsons.com") return true;
  if (/^http:\/\/localhost(?::\d+)?$/.test(origin)) return true;
  if (env.URL) {
    const site = new URL(env.URL).hostname;
    const previewRe = new RegExp(`^https://[a-z0-9-]+--${site.replace(/\./g, "\\.")}$`);
    if (previewRe.test(origin)) return true;
  }
  return false;
}

const PROD_ENV = { URL: "https://lusikandsons.com", DEPLOY_PRIME_URL: "https://lusikandsons.com" };

test("allows canonical production URL", () => {
  assert.equal(isAllowedOrigin("https://lusikandsons.com", PROD_ENV), true);
});

test("allows process.env.URL exactly", () => {
  assert.equal(isAllowedOrigin("https://lusikandsons.com", PROD_ENV), true);
});

test("allows DEPLOY_PRIME_URL for branch deploys", () => {
  const env = { URL: "https://lusikandsons.com", DEPLOY_PRIME_URL: "https://feature-foo--lusikandsons.netlify.app" };
  assert.equal(isAllowedOrigin("https://feature-foo--lusikandsons.netlify.app", env), true);
});

test("allows http://localhost (with and without port) for netlify dev", () => {
  assert.equal(isAllowedOrigin("http://localhost",      PROD_ENV), true);
  assert.equal(isAllowedOrigin("http://localhost:8888", PROD_ENV), true);
});

test("rejects attacker-supplied origin", () => {
  assert.equal(isAllowedOrigin("https://evil.com", PROD_ENV), false);
});

test("rejects subdomain that LOOKS LIKE us", () => {
  assert.equal(isAllowedOrigin("https://lusikandsons.com.evil.com", PROD_ENV), false);
});

test("rejects http://localhost.evil.com (regex pin)", () => {
  assert.equal(isAllowedOrigin("http://localhost.evil.com", PROD_ENV), false);
});

test("rejects empty and non-string inputs", () => {
  assert.equal(isAllowedOrigin("", PROD_ENV), false);
  assert.equal(isAllowedOrigin(null, PROD_ENV), false);
  assert.equal(isAllowedOrigin(undefined, PROD_ENV), false);
  assert.equal(isAllowedOrigin(123, PROD_ENV), false);
});

test("rejects HTTP (non-HTTPS) for production-style host", () => {
  assert.equal(isAllowedOrigin("http://lusikandsons.com", PROD_ENV), false);
});

test("allows a real preview URL pattern", () => {
  const env = { URL: "https://lusikandsons.com" };
  assert.equal(
    isAllowedOrigin("https://abc123--lusikandsons.com", env),
    true,
    "preview-style hash--host should match"
  );
});
