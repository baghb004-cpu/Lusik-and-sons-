// Tests for requireUser / requireAdmin — the chokepoints every
// authenticated endpoint relies on. If these drift, the whole site
// loses its authorization layer (CLAUDE.md: "There's no RLS to save
// you if you forget").
//
// These helpers are ASYNC (the bearer-token fallback verifies against
// GoTrue over the network), so every call is awaited.
import { test } from "node:test";
import assert from "node:assert/strict";
import { requireUser, requireAdmin, isAdmin } from "../auth.mjs";

function mockContext(user) {
  return { clientContext: user ? { user } : null };
}

// A request whose only header is Authorization: Bearer <token>.
function mockReq(bearer) {
  return {
    headers: {
      get: (k) => (k.toLowerCase() === "authorization" ? `Bearer ${bearer}` : null),
    },
  };
}

// Swap global fetch for the duration of fn(), then restore. node:test
// runs top-level tests sequentially, so this is safe without isolation.
async function withFetch(impl, fn) {
  const orig = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = orig;
  }
}

// ---- the edge-verified (clientContext.user) path -------------------

test("requireUser: returns 401 when there's no Identity user", async () => {
  const result = await requireUser(mockContext(null));
  assert.ok(result.response, "missing-user case must return a response, not a user");
  assert.equal(result.response.status, 401);
});

test("requireUser: returns 401 when sub is missing", async () => {
  const result = await requireUser(mockContext({ email: "x@y.com" }));
  assert.ok(result.response, "user without `sub` must be rejected");
  assert.equal(result.response.status, 401);
});

test("requireUser: returns shaped user object on success", async () => {
  const result = await requireUser(mockContext({
    sub: "user-uuid-123",
    email: "Olen@example.com",
    user_metadata: { full_name: "Olen", phone: "555-0100" },
    app_metadata: { roles: ["customer"] },
  }));
  assert.ok(!result.response, "valid user should not return a response");
  assert.equal(result.user.id, "user-uuid-123");
  assert.equal(result.user.email, "Olen@example.com");
  assert.equal(result.user.fullName, "Olen");
  assert.deepEqual(result.user.roles, ["customer"]);
});

test("requireUser: coerces missing roles to empty array (never undefined)", async () => {
  // Downstream code uses `.includes("admin")` on roles — if it's
  // undefined we crash. The helper must always return an array.
  const result = await requireUser(mockContext({ sub: "u1", email: "x@y.com" }));
  assert.ok(Array.isArray(result.user.roles), "roles must always be an array");
});

test("requireAdmin: returns 401 when not signed in", async () => {
  const result = await requireAdmin(mockContext(null));
  assert.equal(result.response?.status, 401);
});

test("requireAdmin: returns 403 when signed in but no admin role", async () => {
  const result = await requireAdmin(mockContext({
    sub: "u1", email: "customer@x.com",
    app_metadata: { roles: ["customer"] },
  }));
  assert.equal(result.response?.status, 403);
});

test("requireAdmin: accepts the 'admin' role on the JWT", async () => {
  const result = await requireAdmin(mockContext({
    sub: "u1", email: "lusik@x.com",
    app_metadata: { roles: ["admin"] },
  }));
  assert.ok(!result.response, "admin role should pass");
  assert.equal(result.user.id, "u1");
});

test("requireAdmin: ADMIN_EMAILS env fallback works (case-insensitive)", async () => {
  const orig = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "Lusik@example.com, son@example.com";
  try {
    const result = await requireAdmin(mockContext({
      sub: "u1", email: "LUSIK@example.com",
      app_metadata: { roles: [] },
    }));
    assert.ok(!result.response, "ADMIN_EMAILS match should pass even without role");
  } finally {
    process.env.ADMIN_EMAILS = orig;
  }
});

test("requireAdmin: ADMIN_EMAILS fallback rejects unrelated emails", async () => {
  const orig = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "lusik@example.com";
  try {
    const result = await requireAdmin(mockContext({
      sub: "u1", email: "random@example.com",
      app_metadata: { roles: [] },
    }));
    assert.equal(result.response?.status, 403, "non-listed email must still 403");
  } finally {
    process.env.ADMIN_EMAILS = orig;
  }
});

// ---- the bearer-token fallback path (the forgery fix) --------------
// These prove the function never trusts a token's claims without
// verifying it against the issuer.

const FORGED = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhdHRhY2tlciIsImFwcF9tZXRhZGF0YSI6eyJyb2xlcyI6WyJhZG1pbiJdfX0.bogus";

test("fallback: a forged admin token is REJECTED when the issuer rejects it", async () => {
  // GoTrue returns 401 for an invalid signature. The helper must honor
  // that and not fall back to trusting the decoded payload.
  await withFetch(async () => new Response("unauthorized", { status: 401 }), async () => {
    const ctx = { clientContext: { identity: { url: "https://site.test/.netlify/identity" } } };
    const result = await requireAdmin(mockReq(FORGED), ctx);
    assert.ok(result.response, "forged token must not produce a user");
    assert.equal(result.response.status, 401);
  });
});

test("fallback: fails closed when no issuer endpoint is configured", async () => {
  // No clientContext.identity.url and no URL env → nothing to verify
  // against → reject rather than trust the token blindly.
  const origUrl = process.env.URL;
  const origDeploy = process.env.DEPLOY_PRIME_URL;
  delete process.env.URL;
  delete process.env.DEPLOY_PRIME_URL;
  let fetchCalled = false;
  try {
    await withFetch(async () => { fetchCalled = true; return new Response("{}", { status: 200 }); }, async () => {
      const result = await requireUser(mockReq(FORGED), { clientContext: {} });
      assert.equal(result.response?.status, 401);
    });
    assert.equal(fetchCalled, false, "must not even attempt a call with no endpoint");
  } finally {
    if (origUrl === undefined) delete process.env.URL; else process.env.URL = origUrl;
    if (origDeploy === undefined) delete process.env.DEPLOY_PRIME_URL; else process.env.DEPLOY_PRIME_URL = origDeploy;
  }
});

test("fallback: a token the issuer accepts is honored (and normalized)", async () => {
  // GoTrue's /user returns { id, email, app_metadata, ... }. The helper
  // must map id → sub and surface roles for the admin gate.
  await withFetch(async (url, opts) => {
    assert.match(String(url), /\/user$/, "must hit the GoTrue /user endpoint");
    assert.match(opts.headers.Authorization, /^Bearer /, "must forward the bearer token");
    return new Response(JSON.stringify({
      id: "verified-uuid", email: "real@example.com",
      app_metadata: { roles: ["admin"] }, user_metadata: { full_name: "Real" },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }, async () => {
    const ctx = { clientContext: { identity: { url: "https://site.test/.netlify/identity" } } };
    const result = await requireAdmin(mockReq("a.real.token"), ctx);
    assert.ok(!result.response, "issuer-verified admin should pass");
    assert.equal(result.user.id, "verified-uuid");
    assert.equal(result.user.fullName, "Real");
  });
});

test("fallback: a network error fails closed", async () => {
  await withFetch(async () => { throw new Error("connection refused"); }, async () => {
    const ctx = { clientContext: { identity: { url: "https://site.test/.netlify/identity" } } };
    const result = await requireUser(mockReq("a.real.token"), ctx);
    assert.equal(result.response?.status, 401, "issuer unreachable → unauthenticated");
  });
});

// ---- the shared isAdmin() predicate (used by order-photo-get too) ---

test("isAdmin: true for role, true for ADMIN_EMAILS, false otherwise", () => {
  const orig = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "lusik@example.com";
  try {
    assert.equal(isAdmin({ roles: ["admin"], email: "anyone@x.com" }), true);
    assert.equal(isAdmin({ roles: [], email: "LUSIK@example.com" }), true);
    assert.equal(isAdmin({ roles: ["customer"], email: "nope@x.com" }), false);
    assert.equal(isAdmin(null), false);
  } finally {
    process.env.ADMIN_EMAILS = orig;
  }
});
