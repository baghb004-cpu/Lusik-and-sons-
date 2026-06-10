// ============================================================
// zip-lookup — input shape, hits, misses, cache headers
// ============================================================
// The checkout page's first-party ZIP→city/state confirmation. Display
// only (shipping is priced by shipping-zones from the ZIP itself), but
// it must validate strictly, cache hard, and never 500 on garbage.
// ============================================================
import { test } from "node:test";
import assert from "node:assert/strict";

const handler = (await import("../../zip-lookup.mjs")).default;

const get = (qs) => handler(new Request(`https://site.test/.netlify/functions/zip-lookup${qs}`));

test("known ZIP → 200 with city/state and a long-lived public cache", async () => {
  const res = await get("?zip=90630");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, { zip: "90630", city: "Cypress", state: "CA" });
  assert.match(res.headers.get("Cache-Control"), /public/);
  assert.match(res.headers.get("Netlify-CDN-Cache-Control") ?? "", /durable/);
});

test("territories are covered (San Juan, PR)", async () => {
  const res = await get("?zip=00901");
  assert.equal(res.status, 200);
  assert.equal((await res.json()).state, "PR");
});

test("unknown-but-well-formed ZIP → 404, still cacheable", async () => {
  const res = await get("?zip=00000");
  assert.equal(res.status, 404);
  assert.match(res.headers.get("Cache-Control"), /public/);
});

test("malformed input → 400 (never a lookup, never a 500)", async () => {
  for (const bad of ["", "?zip=abcde", "?zip=1234", "?zip=123456", "?zip=90630-1234"]) {
    const res = await get(bad);
    assert.equal(res.status, 400, `expected 400 for "${bad}"`);
  }
});

test("non-GET → 405", async () => {
  const res = await handler(new Request("https://site.test/x?zip=90630", { method: "POST" }));
  assert.equal(res.status, 405);
});
