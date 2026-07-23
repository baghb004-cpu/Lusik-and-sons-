// ============================================================
// Unit tests — embroidery-order.mjs
// ============================================================
// The /embroidery order desk's submit endpoint. Email is the
// system of record (no DB row), so the boundary matters twice:
// nothing unvalidated may reach the mailbox, and the .pes
// attachment must be size-capped and magic-checked so the
// function can't be used to relay arbitrary files.
//
// Resend is stubbed via globalThis.fetch — each test inspects the
// exact payload the mailbox would receive. The rate-limit blob
// store is absent in this environment; the handler treats that as
// an infrastructure failure and fails open (documented in the
// function), which is also what lets these tests reach validation.
// A missing client IP still fails closed (429) — tested below.
// ============================================================

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const savedEnv = {};
const setEnv = (k, v) => { savedEnv[k] = process.env[k]; process.env[k] = v; };
const restoreEnv = (k) => {
  if (savedEnv[k] === undefined) delete process.env[k];
  else process.env[k] = savedEnv[k];
};

let handler;
let realFetch;
let resendCalls; // captured Resend payloads

// A tiny but well-formed PES prefix: "#PES0001" + a few bytes.
const PES_B64 = Buffer.from("#PES0001\x16\x00\x00\x00", "latin1").toString("base64");

const validBody = () => ({
  account: "company",
  contact: { name: "Gohar", phone: "714-555-0000" },
  product: { name: "White Spread Collar Shirt" },
  panel: { label: "Left cuff", area_mm: [90, 30] },
  design: { text: "Gohar", modeLine: "English · print: Gohar" },
  threadHex: "#1f2f6b", threadName: "Navy",
  fabricHex: "#f4f2ec", fabricName: "White",
  pes: { base64: PES_B64, stitchCount: 1200, jumps: 20, widthMm: 82.5, heightMm: 21 },
});

const post = (body, { origin = "https://site.test", ip = "203.0.113.7", method = "POST" } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (origin) headers["Origin"] = origin;
  if (ip) headers["x-nf-client-connection-ip"] = ip;
  return handler(new Request("https://site.test/.netlify/functions/embroidery-order", {
    method, headers, body: method === "POST" ? JSON.stringify(body) : undefined,
  }), {});
};

before(async () => {
  setEnv("URL", "https://site.test");
  setEnv("RESEND_API_KEY", "re_test_dummy");
  setEnv("ADMIN_NOTIFICATION_EMAIL", "orders@test.example");
  setEnv("REMINDER_SECRET", "x".repeat(40));

  realFetch = globalThis.fetch;
  resendCalls = [];
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("api.resend.com")) {
      resendCalls.push(JSON.parse(opts.body));
      return new Response(JSON.stringify({ id: "email_test" }), { status: 200 });
    }
    return realFetch(url, opts);
  };

  handler = (await import("../../embroidery-order.mjs")).default;
});

after(() => {
  globalThis.fetch = realFetch;
  ["URL", "RESEND_API_KEY", "ADMIN_NOTIFICATION_EMAIL", "REMINDER_SECRET"].forEach(restoreEnv);
});

test("non-POST → 405", async () => {
  const res = await post(null, { method: "GET" });
  assert.equal(res.status, 405);
});

test("missing or foreign Origin → 403, nothing emailed", async () => {
  const n = resendCalls.length;
  for (const origin of [null, "https://evil.example"]) {
    const res = await post(validBody(), { origin });
    assert.equal(res.status, 403);
  }
  assert.equal(resendCalls.length, n);
});

test("honeypot tripped → 200 without sending", async () => {
  const n = resendCalls.length;
  const res = await post({ ...validBody(), "bot-field": "gotcha" });
  assert.equal(res.status, 200);
  assert.equal(resendCalls.length, n);
});

test("missing client IP → 429 (rate limit fails closed)", async () => {
  const res = await post(validBody(), { ip: null });
  assert.equal(res.status, 429);
});

test("missing design details → 400", async () => {
  for (const strip of [
    (b) => { b.design.text = ""; },
    (b) => { delete b.product; },
    (b) => { b.panel.area_mm = []; },
  ]) {
    const body = validBody();
    strip(body);
    const res = await post(body);
    assert.equal(res.status, 400);
  }
});

test("public quote without an email → 400; with a bad email → 400", async () => {
  const noEmail = { ...validBody(), account: "public" };
  assert.equal((await post(noEmail)).status, 400);
  const badEmail = { ...validBody(), account: "public", contact: { email: "not-an-email" } };
  assert.equal((await post(badEmail)).status, 400);
});

test("company order happy path: 200 + ref, .pes attached, admin recipient", async () => {
  const res = await post(validBody());
  assert.equal(res.status, 200);
  const { ok, ref } = await res.json();
  assert.equal(ok, true);
  assert.match(ref, /^EMB-\d{8}-[0-9A-F]{4}$/);

  const mail = resendCalls.at(-1);
  assert.equal(mail.to, "orders@test.example");
  assert.ok(mail.subject.includes(ref));
  assert.ok(mail.subject.includes("Gohar"));
  assert.equal(mail.attachments.length, 1);
  assert.equal(mail.attachments[0].filename, `${ref}.pes`);
  assert.equal(mail.attachments[0].content, PES_B64);
  assert.ok(mail.html.includes("1200 stitches"));
  assert.equal(mail.reply_to, undefined); // no contact email on company orders
});

test("public quote sets reply_to to the requester", async () => {
  const body = { ...validBody(), account: "public", contact: { name: "Vrej", email: "vrej@test.example" } };
  const res = await post(body);
  assert.equal(res.status, 200);
  assert.equal(resendCalls.at(-1).reply_to, "vrej@test.example");
});

test("pes with wrong magic bytes → order accepted, attachment dropped", async () => {
  const body = validBody();
  body.pes.base64 = Buffer.from("GIF89a-not-a-pes", "latin1").toString("base64");
  const res = await post(body);
  assert.equal(res.status, 200);
  const mail = resendCalls.at(-1);
  assert.equal(mail.attachments, undefined);
  assert.ok(mail.text.includes("digitize manually"));
});

test("oversized pes base64 → order accepted, attachment dropped", async () => {
  const body = validBody();
  body.pes.base64 = "A".repeat(1_000_000);
  const res = await post(body);
  assert.equal(res.status, 200);
  assert.equal(resendCalls.at(-1).attachments, undefined);
});

test("string fields are bounded before they reach the mailbox", async () => {
  const body = validBody();
  body.notes = "n".repeat(50_000);
  body.design.text = "t".repeat(5_000);
  const res = await post(body);
  assert.equal(res.status, 200);
  const mail = resendCalls.at(-1);
  assert.ok(mail.text.length < 20_000, "email text stays bounded");
});

test("Resend failure → 502 so the customer knows the order did NOT land", async () => {
  const failFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("api.resend.com")) return new Response("nope", { status: 500 });
    return realFetch(url, opts);
  };
  try {
    const res = await post(validBody());
    assert.equal(res.status, 502);
  } finally {
    globalThis.fetch = failFetch;
  }
});
