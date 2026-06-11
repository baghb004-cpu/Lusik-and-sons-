import { test } from "node:test";
import assert from "node:assert/strict";

import { requireBuilderAdmin } from "../server/auth.ts";

const req = (token?: string) =>
  new Request("http://localhost/api/builder/docs", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

const gotrue = (status: number, body: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

const BASE_ENV = { URL: "https://lusikandsons.com" } as unknown as NodeJS.ProcessEnv;

test("no bearer token → 401", async () => {
  const result = await requireBuilderAdmin(req(), BASE_ENV, gotrue(200, {}));
  assert.equal(result.ok, false);
  assert.equal(result.response!.status, 401);
});

test("local token mode: exact match passes, mismatch falls through to issuer", async () => {
  const env = { ...BASE_ENV, BUILDER_LOCAL_TOKEN: "a".repeat(32) };
  const ok = await requireBuilderAdmin(req("a".repeat(32)), env, gotrue(401, {}));
  assert.equal(ok.ok, true);
  assert.equal(ok.who, "local-operator");

  const bad = await requireBuilderAdmin(req("b".repeat(32)), env, gotrue(401, {}));
  assert.equal(bad.ok, false);
  assert.equal(bad.response!.status, 401);
});

test("local tokens shorter than 16 chars are never accepted", async () => {
  const env = { ...BASE_ENV, BUILDER_LOCAL_TOKEN: "short" };
  const result = await requireBuilderAdmin(req("short"), env, gotrue(401, {}));
  assert.equal(result.ok, false);
});

test("identity path: admin role passes, plain user gets 403", async () => {
  const admin = await requireBuilderAdmin(
    req("some-jwt"),
    BASE_ENV,
    gotrue(200, { id: "u1", email: "lusik@x.com", app_metadata: { roles: ["Admin"] } })
  );
  assert.equal(admin.ok, true);
  assert.equal(admin.who, "lusik@x.com");

  const guest = await requireBuilderAdmin(
    req("some-jwt"),
    BASE_ENV,
    gotrue(200, { id: "u2", email: "guest@x.com", app_metadata: { roles: [] } })
  );
  assert.equal(guest.ok, false);
  assert.equal(guest.response!.status, 403);
});

test("ADMIN_EMAILS fallback grants access without the role", async () => {
  const env = { ...BASE_ENV, ADMIN_EMAILS: "owner@x.com, lusik@x.com" };
  const result = await requireBuilderAdmin(
    req("jwt"),
    env,
    gotrue(200, { id: "u3", email: "Lusik@X.com", app_metadata: {} })
  );
  assert.equal(result.ok, true);
});

test("issuer rejection, garbage payloads, and network failure all fail closed", async () => {
  const rejected = await requireBuilderAdmin(req("forged"), BASE_ENV, gotrue(401, {}));
  assert.equal(rejected.ok, false);

  const garbage = await requireBuilderAdmin(req("jwt"), BASE_ENV, gotrue(200, { nope: true }));
  assert.equal(garbage.ok, false);

  const down = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  const offline = await requireBuilderAdmin(req("jwt"), BASE_ENV, down);
  assert.equal(offline.ok, false);
  assert.equal(offline.response!.status, 401);
});

test("no issuer configured and no local token → 401, never open", async () => {
  const result = await requireBuilderAdmin(
    req("jwt"),
    {} as unknown as NodeJS.ProcessEnv,
    gotrue(200, { id: "u" })
  );
  assert.equal(result.ok, false);
});
