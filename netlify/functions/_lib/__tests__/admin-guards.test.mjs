// ============================================================
// Unit tests — every admin function actually calls requireAdmin
// ============================================================
// `auth.test.mjs` tests the requireAdmin helper itself. This file
// tests the CALL SITES: each admin endpoint must short-circuit
// with a 401 (unauthenticated) or 403 (authenticated but no admin
// role) BEFORE doing anything else, so a future refactor that
// silently drops the guard line is caught by CI.
//
// Strategy:
//   - Dynamic-import each handler with NETLIFY_DATABASE_URL set
//     to a dummy (avoids the @netlify/neon load-time crash).
//   - Call each handler with three context shapes:
//       (a) no clientContext.user            → expect 401
//       (b) clientContext.user without admin → expect 403
//       (c) clientContext.user WITH admin    → expect NOT 401/403
//                                              (some other status,
//                                              but past the guard)
//   - The "WITH admin" case may fail later with a 4xx/5xx due to
//     missing query params or DB, which is fine — we're proving
//     the guard isn't blocking it.
// ============================================================

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const ADMIN_FUNCTIONS = [
  { name: "admin-orders",          path: "../../admin-orders.mjs",          method: "GET" },
  { name: "admin-order-photo",     path: "../../admin-order-photo.mjs",     method: "POST" },
  { name: "admin-waitlist",        path: "../../admin-waitlist.mjs",        method: "GET" },
  { name: "admin-waitlist-notify", path: "../../admin-waitlist-notify.mjs", method: "POST" },
];

const savedEnv = {};
const setEnv = (key, value) => {
  savedEnv[key] = process.env[key];
  process.env[key] = value;
};
const restoreEnv = (key) => {
  if (savedEnv[key] === undefined) delete process.env[key];
  else process.env[key] = savedEnv[key];
};

before(() => {
  setEnv("NETLIFY_DATABASE_URL", "postgres://dummy:dummy@127.0.0.1:5432/dummy");
  setEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  setEnv("REMINDER_SECRET", "x".repeat(40));
  // Make absolutely sure the env-var-fallback admin list is empty so
  // an unset role + unset email doesn't accidentally pass.
  setEnv("ADMIN_EMAILS", "");
});

after(() => {
  restoreEnv("NETLIFY_DATABASE_URL");
  restoreEnv("STRIPE_SECRET_KEY");
  restoreEnv("REMINDER_SECRET");
  restoreEnv("ADMIN_EMAILS");
});

function makeRequest(method) {
  return new Request("https://example.com/.netlify/functions/x", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? "{}" : undefined,
  });
}

const ctxNone = {};
const ctxNonAdmin = {
  clientContext: {
    user: {
      sub: "user-123",
      email: "joe@example.com",
      app_metadata: { roles: [] },
    },
  },
};
const ctxAdmin = {
  clientContext: {
    user: {
      sub: "admin-1",
      email: "lusik@example.com",
      app_metadata: { roles: ["admin"] },
    },
  },
};

for (const { name, path, method } of ADMIN_FUNCTIONS) {
  test(`${name}: no auth context → 401`, async () => {
    const { default: handler } = await import(path);
    const res = await handler(makeRequest(method), ctxNone);
    assert.equal(res.status, 401, `expected 401 for unauthenticated, got ${res.status}`);
  });

  test(`${name}: authenticated non-admin → 403`, async () => {
    const { default: handler } = await import(path);
    const res = await handler(makeRequest(method), ctxNonAdmin);
    assert.equal(res.status, 403, `expected 403 for non-admin, got ${res.status}`);
  });

  test(`${name}: admin context → NOT 401/403 (guard passes)`, async () => {
    const { default: handler } = await import(path);
    // The handler may throw after the guard (e.g. trying to query a
    // dummy DB). A thrown error means the guard PASSED — execution
    // got past requireAdmin into the real work. Anything 401/403
    // would have short-circuited at the guard and returned a clean
    // response object.
    let res;
    try {
      res = await handler(makeRequest(method), ctxAdmin);
    } catch (err) {
      // Thrown means past the guard. Pass.
      return;
    }
    assert.notEqual(res.status, 401, `admin shouldn't get 401`);
    assert.notEqual(res.status, 403, `admin shouldn't get 403`);
  });
}
