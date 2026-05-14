// ============================================================
// Unit tests — _lib/origin.mjs (the open-redirect defense for
// Stripe success/cancel URLs in create-checkout-session)
// ============================================================
// The risk if this drifts: an attacker sends Origin: https://evil.com,
// Stripe sends the paid customer to evil.com after checkout, evil.com
// shows a fake "please re-enter your card details" page. This file's
// job is to make sure that's impossible.
//
// Imports the REAL function (no inline re-implementation) so a change
// in production behavior can't slip past the suite.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin } from "../origin.mjs";

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

test("rejects preview-style host when env.URL is missing", () => {
  // Without env.URL we can't build the preview regex; the function
  // should refuse rather than silently allow.
  assert.equal(isAllowedOrigin("https://abc123--lusikandsons.com", {}), false);
});

test("rejects malformed env.URL gracefully (does not throw)", () => {
  // A misconfigured Netlify env shouldn't crash the function — it
  // should just deny the request and let the fallback take over.
  const env = { URL: "not a url" };
  assert.doesNotThrow(() => isAllowedOrigin("https://evil.com", env));
  assert.equal(isAllowedOrigin("https://evil.com", env), false);
});

test("rejects DEPLOY_PRIME_URL pattern smuggling", () => {
  // Just because DEPLOY_PRIME_URL is checked by exact match doesn't
  // mean an attacker who guesses its value gets in — they'd have to
  // present that EXACT string. Confirm the equality is strict.
  const env = { URL: "https://lusikandsons.com", DEPLOY_PRIME_URL: "https://main--lusikandsons.netlify.app" };
  assert.equal(isAllowedOrigin("https://main--lusikandsons.netlify.app.evil.com", env), false);
});
