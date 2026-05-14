// Tests for requireUser / requireAdmin — the chokepoints every
// authenticated endpoint relies on. If these drift, the whole site
// loses its authorization layer (CLAUDE.md: "There's no RLS to save
// you if you forget").
import { test } from "node:test";
import assert from "node:assert/strict";
import { requireUser, requireAdmin } from "../auth.mjs";

function mockContext(user) {
  return { clientContext: user ? { user } : null };
}

test("requireUser: returns 401 when there's no Identity user", () => {
  const result = requireUser(mockContext(null));
  assert.ok(result.response, "missing-user case must return a response, not a user");
  assert.equal(result.response.status, 401);
});

test("requireUser: returns 401 when sub is missing", () => {
  const result = requireUser(mockContext({ email: "x@y.com" }));
  assert.ok(result.response, "user without `sub` must be rejected");
  assert.equal(result.response.status, 401);
});

test("requireUser: returns shaped user object on success", () => {
  const result = requireUser(mockContext({
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

test("requireUser: coerces missing roles to empty array (never undefined)", () => {
  // Downstream code uses `.includes("admin")` on roles — if it's
  // undefined we crash. The helper must always return an array.
  const result = requireUser(mockContext({ sub: "u1", email: "x@y.com" }));
  assert.ok(Array.isArray(result.user.roles), "roles must always be an array");
});

test("requireAdmin: returns 401 when not signed in", () => {
  const result = requireAdmin(mockContext(null));
  assert.equal(result.response?.status, 401);
});

test("requireAdmin: returns 403 when signed in but no admin role", () => {
  const result = requireAdmin(mockContext({
    sub: "u1", email: "customer@x.com",
    app_metadata: { roles: ["customer"] },
  }));
  assert.equal(result.response?.status, 403);
});

test("requireAdmin: accepts the 'admin' role on the JWT", () => {
  const result = requireAdmin(mockContext({
    sub: "u1", email: "lusik@x.com",
    app_metadata: { roles: ["admin"] },
  }));
  assert.ok(!result.response, "admin role should pass");
  assert.equal(result.user.id, "u1");
});

test("requireAdmin: ADMIN_EMAILS env fallback works (case-insensitive)", () => {
  const orig = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "Lusik@example.com, son@example.com";
  try {
    const result = requireAdmin(mockContext({
      sub: "u1", email: "LUSIK@example.com",
      app_metadata: { roles: [] },
    }));
    assert.ok(!result.response, "ADMIN_EMAILS match should pass even without role");
  } finally {
    process.env.ADMIN_EMAILS = orig;
  }
});

test("requireAdmin: ADMIN_EMAILS fallback rejects unrelated emails", () => {
  const orig = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "lusik@example.com";
  try {
    const result = requireAdmin(mockContext({
      sub: "u1", email: "random@example.com",
      app_metadata: { roles: [] },
    }));
    assert.equal(result.response?.status, 403, "non-listed email must still 403");
  } finally {
    process.env.ADMIN_EMAILS = orig;
  }
});
