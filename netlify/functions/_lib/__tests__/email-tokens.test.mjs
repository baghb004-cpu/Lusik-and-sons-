// Tests for the HMAC-signed unsubscribe tokens in _lib/email.mjs.
// These power the gift-reminder unsubscribe link — if sign/verify
// drift apart, every link in every email 400s.
import { test } from "node:test";
import assert from "node:assert/strict";
import { signReminderToken, verifyReminderToken } from "../email.mjs";

// Tests run with a known secret so the assertions are deterministic.
// Without this the helper falls back to STRIPE_WEBHOOK_SECRET, which
// won't be set in the test env.
const ORIG_SECRET = process.env.REMINDER_SECRET;
process.env.REMINDER_SECRET = "test-secret-do-not-use-in-prod";

test.after(() => {
  process.env.REMINDER_SECRET = ORIG_SECRET;
});

test("signReminderToken: returns a non-empty base64url string", () => {
  const token = signReminderToken("order-uuid-1");
  assert.ok(token.length > 0, "token is empty");
  // base64url: A-Z, a-z, 0-9, -, _ (no padding, no + or /)
  assert.match(token, /^[A-Za-z0-9_-]+$/);
});

test("signReminderToken: stable across calls with same input", () => {
  const a = signReminderToken("order-uuid-1");
  const b = signReminderToken("order-uuid-1");
  assert.equal(a, b, "HMAC should be deterministic");
});

test("signReminderToken: different orderIds produce different tokens", () => {
  const a = signReminderToken("order-uuid-1");
  const b = signReminderToken("order-uuid-2");
  assert.notEqual(a, b);
});

test("verifyReminderToken: accepts a token it signed", () => {
  const token = signReminderToken("order-uuid-1");
  assert.equal(verifyReminderToken("order-uuid-1", token), true);
});

test("verifyReminderToken: rejects a token signed for a DIFFERENT order", () => {
  const token = signReminderToken("order-uuid-1");
  assert.equal(verifyReminderToken("order-uuid-2", token), false);
});

test("verifyReminderToken: rejects an empty token", () => {
  assert.equal(verifyReminderToken("order-uuid-1", ""), false);
  assert.equal(verifyReminderToken("order-uuid-1", null), false);
  assert.equal(verifyReminderToken("order-uuid-1", undefined), false);
});

test("verifyReminderToken: rejects a malformed token", () => {
  assert.equal(verifyReminderToken("order-uuid-1", "not-a-real-token"), false);
});

test("verifyReminderToken: rejects when the secret is empty (defense in depth)", () => {
  const savedReminder = process.env.REMINDER_SECRET;
  const savedStripe = process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.REMINDER_SECRET;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  try {
    // With no secret available, sign produces "" and verify must
    // return false — anything else would mean tokens are forgeable.
    const token = signReminderToken("order-uuid-1");
    assert.equal(token, "");
    assert.equal(verifyReminderToken("order-uuid-1", "anything"), false);
  } finally {
    if (savedReminder !== undefined) process.env.REMINDER_SECRET = savedReminder;
    if (savedStripe !== undefined) process.env.STRIPE_WEBHOOK_SECRET = savedStripe;
  }
});
