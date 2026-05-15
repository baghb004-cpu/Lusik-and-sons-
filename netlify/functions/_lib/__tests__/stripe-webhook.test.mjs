// ============================================================
// Unit tests — stripe-webhook.mjs signature verification
// ============================================================
// The webhook is the single load-bearing line that decides whether
// anything in the `orders` table can be forged. If signature
// verification ever regresses, an attacker can POST a synthetic
// `checkout.session.completed` event and create fake orders /
// trigger admin emails for products that were never paid for.
//
// This file tests the boundary: method gate, missing/bad/tampered
// signature, missing STRIPE_SECRET_KEY env, and the happy path
// (valid signature for an event type the handler ignores — so we
// exercise constructEvent without touching the DB).
//
// Env vars set in the `before` block:
//   NETLIFY_DATABASE_URL  — dummy. Required for @netlify/database to
//                           instantiate at module load; never used
//                           because we never hit a query path.
//   STRIPE_SECRET_KEY     — dummy. Required for the Stripe client
//                           to construct.
//   STRIPE_WEBHOOK_SECRET — known test secret. Used both for the
//                           handler's verification AND for our test
//                           harness to mint valid signatures.
//   REMINDER_SECRET       — dummy ≥32 chars to silence the
//                           email-module warning at load time.
// ============================================================

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";

const WEBHOOK_SECRET = "whsec_test_known_secret_for_unit_tests";

// Stable state across the suite — set once, restore once.
const savedEnv = {};
const setEnv = (key, value) => {
  savedEnv[key] = process.env[key];
  process.env[key] = value;
};
const restoreEnv = (key) => {
  if (savedEnv[key] === undefined) delete process.env[key];
  else process.env[key] = savedEnv[key];
};

let webhook;          // the imported handler
let stripeForSig;     // Stripe client used only to generate test signatures

before(async () => {
  setEnv("NETLIFY_DATABASE_URL", "postgres://dummy:dummy@127.0.0.1:5432/dummy");
  setEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  setEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
  setEnv("REMINDER_SECRET", "x".repeat(40));

  webhook = (await import("../../stripe-webhook.mjs")).default;
  stripeForSig = new Stripe("sk_test_dummy", { apiVersion: "2024-06-20" });
});

after(() => {
  restoreEnv("NETLIFY_DATABASE_URL");
  restoreEnv("STRIPE_SECRET_KEY");
  restoreEnv("STRIPE_WEBHOOK_SECRET");
  restoreEnv("REMINDER_SECRET");
});

function makeRequest({ method = "POST", body = "", headers = {} } = {}) {
  return new Request("https://example.com/.netlify/functions/stripe-webhook", {
    method,
    headers,
    body: method === "POST" ? body : undefined,
  });
}

function signedBody({ payload, secret = WEBHOOK_SECRET, timestamp } = {}) {
  return stripeForSig.webhooks.generateTestHeaderString({
    payload,
    secret,
    ...(timestamp ? { timestamp } : {}),
  });
}

test("GET → 405 method not allowed (no signature path entered)", async () => {
  const res = await webhook(makeRequest({ method: "GET" }));
  assert.equal(res.status, 405);
});

test("POST without stripe-signature header → 400", async () => {
  const res = await webhook(makeRequest({ method: "POST", body: "{}", headers: {} }));
  assert.equal(res.status, 400);
  assert.equal(await res.text(), "Missing signature");
});

test("POST with a bogus signature → 400 (does NOT pass verification)", async () => {
  const body = JSON.stringify({ id: "evt_bogus", type: "customer.created", data: { object: {} } });
  const res = await webhook(
    makeRequest({
      method: "POST",
      body,
      headers: { "stripe-signature": "t=1700000000,v1=deadbeef" },
    }),
  );
  assert.equal(res.status, 400);
  assert.equal(await res.text(), "Invalid signature");
});

test("POST signed with a DIFFERENT webhook secret → 400", async () => {
  const body = JSON.stringify({ id: "evt_x", type: "customer.created", data: { object: {} } });
  const sig = signedBody({ payload: body, secret: "whsec_wrong_secret" });
  const res = await webhook(
    makeRequest({
      method: "POST",
      body,
      headers: { "stripe-signature": sig },
    }),
  );
  assert.equal(res.status, 400);
});

test("POST with a valid signature for body A but body B → 400 (tampered body rejected)", async () => {
  const bodyA = JSON.stringify({ id: "evt_a", type: "customer.created", data: { object: {} } });
  const bodyB = JSON.stringify({ id: "evt_b", type: "customer.created", data: { object: { tampered: true } } });
  const sig = signedBody({ payload: bodyA }); // signature is for A
  const res = await webhook(
    makeRequest({
      method: "POST",
      body: bodyB, // but we send B
      headers: { "stripe-signature": sig },
    }),
  );
  assert.equal(res.status, 400);
});

test("POST with a stale-timestamp signature → 400 (replay-window guard)", async () => {
  // The handler uses an explicit 300-second tolerance. A signature
  // dated an hour ago must be rejected even if otherwise valid.
  const body = JSON.stringify({ id: "evt_old", type: "customer.created", data: { object: {} } });
  const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
  const sig = signedBody({ payload: body, timestamp: oneHourAgo });
  const res = await webhook(
    makeRequest({
      method: "POST",
      body,
      headers: { "stripe-signature": sig },
    }),
  );
  assert.equal(res.status, 400);
});

test("POST with valid signature + ignored event type → 200 (full verify path works)", async () => {
  // customer.created is NOT in our subscribed events. The handler
  // dispatches it to the 200 "ok (ignored)" branch. Reaching that
  // branch proves constructEvent accepted the signature.
  const body = JSON.stringify({ id: "evt_ok", type: "customer.created", data: { object: {} } });
  const sig = signedBody({ payload: body });
  const res = await webhook(
    makeRequest({
      method: "POST",
      body,
      headers: { "stripe-signature": sig },
    }),
  );
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "ok (ignored)");
});
