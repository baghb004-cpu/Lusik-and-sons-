// ============================================================
// Unit tests — _lib/scheduled.mjs
// ============================================================
// Guards against regressions in the HTTP-gate that protects
// scheduled functions (cleanup-blobs, gift-reminder). The gate
// must:
//   - Accept POSTs with a JSON body containing `next_run`
//     (Netlify scheduler shape).
//   - Accept POSTs with a valid Bearer SCHEDULED_FN_SECRET.
//   - Reject GET, plain POST with no body, wrong secret,
//     short secret, missing-env secret.
//   - Compare the secret in constant time.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { isScheduledInvocation, forbidden } from "../scheduled.mjs";

function postWithBody(body) {
  return new Request("https://example.com/.netlify/functions/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function postWithAuth(authz) {
  return new Request("https://example.com/.netlify/functions/x", {
    method: "POST",
    headers: { Authorization: authz },
  });
}

function get() {
  return new Request("https://example.com/.netlify/functions/x");
}

const VALID_SECRET = "x".repeat(40); // a realistic 40-char secret

test("accepts a Netlify-scheduler shaped POST (next_run in body)", async () => {
  const ok = await isScheduledInvocation(postWithBody({ next_run: "2026-05-15T04:00:00Z" }));
  assert.equal(ok, true);
});

test("accepts an empty-string next_run as 'no scheduler' (must reject)", async () => {
  const ok = await isScheduledInvocation(postWithBody({ next_run: "" }));
  assert.equal(ok, false);
});

test("rejects a POST with no body when SCHEDULED_FN_SECRET unset", async () => {
  delete process.env.SCHEDULED_FN_SECRET;
  const req = new Request("https://example.com/.netlify/functions/x", { method: "POST" });
  assert.equal(await isScheduledInvocation(req), false);
});

test("rejects GET regardless of headers/body", async () => {
  process.env.SCHEDULED_FN_SECRET = VALID_SECRET;
  try {
    const req = new Request("https://example.com/.netlify/functions/x", {
      method: "GET",
      headers: { Authorization: `Bearer ${VALID_SECRET}` },
    });
    assert.equal(await isScheduledInvocation(req), false);
  } finally {
    delete process.env.SCHEDULED_FN_SECRET;
  }
});

test("accepts POST with correct Bearer secret", async () => {
  process.env.SCHEDULED_FN_SECRET = VALID_SECRET;
  try {
    assert.equal(await isScheduledInvocation(postWithAuth(`Bearer ${VALID_SECRET}`)), true);
  } finally {
    delete process.env.SCHEDULED_FN_SECRET;
  }
});

test("rejects POST with wrong Bearer secret", async () => {
  process.env.SCHEDULED_FN_SECRET = VALID_SECRET;
  try {
    assert.equal(await isScheduledInvocation(postWithAuth("Bearer wrong-secret-1234567890abcdef")), false);
  } finally {
    delete process.env.SCHEDULED_FN_SECRET;
  }
});

test("rejects POST when SCHEDULED_FN_SECRET unset even with Bearer", async () => {
  delete process.env.SCHEDULED_FN_SECRET;
  assert.equal(await isScheduledInvocation(postWithAuth(`Bearer ${VALID_SECRET}`)), false);
});

test("rejects too-short SCHEDULED_FN_SECRET (defense against typo)", async () => {
  process.env.SCHEDULED_FN_SECRET = "shortpw";
  try {
    assert.equal(await isScheduledInvocation(postWithAuth("Bearer shortpw")), false);
  } finally {
    delete process.env.SCHEDULED_FN_SECRET;
  }
});

test("rejects POST with malformed Authorization header", async () => {
  process.env.SCHEDULED_FN_SECRET = VALID_SECRET;
  try {
    assert.equal(await isScheduledInvocation(postWithAuth(VALID_SECRET)), false); // no "Bearer " prefix
    assert.equal(await isScheduledInvocation(postWithAuth("Basic " + VALID_SECRET)), false);
    assert.equal(await isScheduledInvocation(postWithAuth("Bearer ")), false);
  } finally {
    delete process.env.SCHEDULED_FN_SECRET;
  }
});

test("rejects null/missing request", async () => {
  assert.equal(await isScheduledInvocation(null), false);
  assert.equal(await isScheduledInvocation(undefined), false);
});

test("body is preserved (clone, not consume) so handler can read it", async () => {
  // The handler in cleanup-blobs/gift-reminder doesn't currently
  // read the body, but the gate should leave it available so a
  // future handler can.
  const req = postWithBody({ next_run: "2026-05-15T04:00:00Z", extra: "data" });
  await isScheduledInvocation(req);
  const body = await req.json();
  assert.equal(body.extra, "data");
});

test("forbidden() returns a 403 plain-text Response", async () => {
  const res = forbidden();
  assert.equal(res.status, 403);
  assert.equal(res.headers.get("Content-Type"), "text/plain");
  assert.equal(await res.text(), "forbidden");
});
