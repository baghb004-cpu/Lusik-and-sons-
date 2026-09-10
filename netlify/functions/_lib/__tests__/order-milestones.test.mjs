// ============================================================
// Order milestones — token safety and timeline shape
// ============================================================
// Two things must hold for the guest follow-along link:
//   1. A token opens exactly one order and nothing else.
//   2. It cannot be confused with the gift-reminder unsubscribe token,
//      which signs the same order id with the same secret.
// Plus: the browser's step list and the database CHECK constraint must
// describe the same six milestones, or a saved step renders as nothing.
// ============================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.REMINDER_SECRET = process.env.REMINDER_SECRET || "unit-test-secret-value-long-enough";

const { signOrderToken, verifyOrderToken, MILESTONES, isMilestone } =
  await import("../order-tokens.mjs");
const { signReminderToken } = await import("../email.mjs");
const browser = await import("../../../../src/lib/milestones.js");

const A = "11111111-2222-3333-4444-555555555555";
const B = "99999999-8888-7777-6666-555555555555";

test("a token opens its own order and no other", () => {
  const token = signOrderToken(A);
  assert.ok(token && token.length > 20, "a token must be produced when a secret is set");
  assert.equal(verifyOrderToken(A, token), true);
  assert.equal(verifyOrderToken(B, token), false, "a token must not open a different order");
});

test("garbage never verifies", () => {
  const token = signOrderToken(A);
  for (const bad of [null, undefined, "", "x", token + "x", token.slice(0, -1), 12345, {}]) {
    assert.equal(verifyOrderToken(A, bad), false, `accepted ${JSON.stringify(bad)}`);
  }
});

test("a view token is not an unsubscribe token", () => {
  // Both sign the same order id with the same secret; only the purpose
  // prefix keeps one from being replayed as the other.
  const view = signOrderToken(A);
  const unsub = signReminderToken(A);
  assert.notEqual(view, unsub, "view and unsubscribe tokens must differ");
  assert.equal(verifyOrderToken(A, unsub), false, "an unsubscribe token must not open an order");
});

test("with no secret configured, no link is minted", () => {
  const savedReminder = process.env.REMINDER_SECRET;
  const savedOrder = process.env.ORDER_LINK_SECRET;
  delete process.env.REMINDER_SECRET;
  delete process.env.ORDER_LINK_SECRET;
  try {
    assert.equal(signOrderToken(A), null, "a guessable link must never be produced");
    assert.equal(verifyOrderToken(A, "anything"), false);
  } finally {
    if (savedReminder !== undefined) process.env.REMINDER_SECRET = savedReminder;
    if (savedOrder !== undefined) process.env.ORDER_LINK_SECRET = savedOrder;
  }
});

test("the browser's steps and the database constraint describe the same milestones", () => {
  const schema = readFileSync(new URL("../../../schema.sql", import.meta.url), "utf8");
  const block = /order_milestones_milestone_check[\s\S]*?CHECK \(milestone IN \(([\s\S]*?)\)\)/.exec(schema);
  assert.ok(block, "schema.sql must constrain the milestone column");
  const inSchema = [...block[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...MILESTONES], inSchema, "server list drifted from the CHECK constraint");
  assert.deepEqual(browser.MILESTONE_KEYS.slice(), inSchema, "browser step list drifted from the CHECK constraint");
});

test("isMilestone rejects anything not in the list", () => {
  assert.equal(isMilestone("stitching"), true);
  for (const bad of ["", "Stitching", "dropped", null, 7, undefined]) {
    assert.equal(isMilestone(bad), false, `accepted ${JSON.stringify(bad)}`);
  }
});

test("the timeline shows every step, marks what is done, and keeps the newest note", () => {
  const rows = [
    { milestone: "received",  note: null,        at: "2026-03-01T10:00:00Z" },
    { milestone: "stitching", note: "first pass", at: "2026-03-05T10:00:00Z" },
    { milestone: "stitching", note: "corrected",  at: "2026-03-06T10:00:00Z" },
    { milestone: "bogus",     note: "ignored",    at: "2026-03-07T10:00:00Z" },
  ];
  const t = browser.buildTimeline(rows);
  assert.equal(t.length, 6, "all six steps render, done or not");
  assert.equal(t.find((s) => s.key === "received").done, true);
  assert.equal(t.find((s) => s.key === "stitching").note, "corrected", "append-only: the newest row wins");
  assert.equal(t.find((s) => s.key === "backing").done, false);
  assert.equal(browser.currentStep(rows).key, "stitching");
  // Malformed input must not throw.
  assert.equal(browser.buildTimeline(null).length, 6);
  assert.equal(browser.currentStep([]), null);
});

// ============================================================
// Every email composer must actually render
// ============================================================
// The follow-along block was once pasted into the cart-recovery
// composer, which has no `order` in scope: every recovery send threw a
// ReferenceError, the webhook swallowed it, and the email was lost for
// good. Nothing caught it because no test ever rendered a composer.
//
// With RESEND_API_KEY unset, sendEmail() returns false AFTER the body is
// built, so a broken template still surfaces as a rejection here.

const ORDER = {
  id: A,
  customer_email: "customer@example.com",
  order_number: "LS-2026-0001",
  total_cents: 6500,
  shipping_address: { city: "Buena Park", state: "CA" },
};

test("every composer renders without throwing", async () => {
  const saved = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    const email = await import("../email.mjs");
    await assert.doesNotReject(() => email.sendCartAbandonmentRecovery({
      to: "customer@example.com",
      items: [{ productName: "The Custom Name Bib", quantity: 1, unitPriceCents: 2200 }],
      totalCents: 2200,
    }), "cart recovery must render");
    await assert.doesNotReject(() => email.sendCustomerOrderConfirmation({
      order: ORDER,
      items: [{ productName: "The Custom Name Bib", quantity: 1 }],
      pending: null,
      customerName: "Ann",
    }), "order confirmation must render");
    await assert.doesNotReject(() => email.sendStitchingStartedEmail({
      to: "customer@example.com",
      orderNumber: ORDER.order_number,
      orderId: ORDER.id,
      note: "Starting on the border today.",
    }), "stitching notice must render");
  } finally {
    if (saved !== undefined) process.env.RESEND_API_KEY = saved;
  }
});

test("the follow-along link lives in the confirmation email, not the cart recovery", async () => {
  // Capture what would be sent by stubbing fetch, so the assertion is
  // about the real body rather than the absence of a throw.
  const savedKey = process.env.RESEND_API_KEY;
  const savedFetch = globalThis.fetch;
  const bodies = [];
  process.env.RESEND_API_KEY = "test-key";
  globalThis.fetch = async (_u, init) => {
    bodies.push(JSON.parse(init.body));
    return { ok: true, status: 200, text: async () => "" };
  };
  try {
    const email = await import("../email.mjs");
    bodies.length = 0;
    await email.sendCustomerOrderConfirmation({
      order: ORDER, items: [{ productName: "Bib", quantity: 1 }], pending: null, customerName: "Ann",
    });
    assert.match(bodies[0]?.html ?? "", /\/order\//, "the confirmation must carry the follow link");

    bodies.length = 0;
    await email.sendCartAbandonmentRecovery({
      to: "customer@example.com",
      items: [{ productName: "Bib", quantity: 1, unitPriceCents: 2200 }],
      totalCents: 2200,
    });
    assert.equal(/\/order\//.test(bodies[0]?.html ?? ""), false,
      "an abandoned cart has no order yet — it must not carry an order link");
  } finally {
    globalThis.fetch = savedFetch;
    if (savedKey !== undefined) process.env.RESEND_API_KEY = savedKey; else delete process.env.RESEND_API_KEY;
  }
});

// ============================================================
// What a capability link is allowed to return
// ============================================================
// The follow-along page is reached by an HMAC link, which means whoever
// holds it can read this — and for a gift that is meant to be the
// recipient. Naming the pieces tells them what they are waiting for. A
// price would tell them what somebody spent on them, which is the one
// thing the gift checkbox exists to prevent.
//
// Source-level because the shape is the boundary: the query must not
// SELECT the price at all, so it cannot be dropped later by accident and
// cannot leak through a spread.
test("the guest read never selects a price", () => {
  const src = readFileSync(new URL("../../order-milestones.mjs", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("const items = await sql"), src.indexOf("return new Response"));
  assert.ok(body.length > 50, "the item query is no longer where this test looks");
  assert.ok(!/unit_price_cents|price/i.test(body.replace(/\/\/.*$/gm, "")),
    "the guest item query selects a price column");
  // And nothing else from the order row that is the buyer's business.
  const all = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const column of ["customer_email", "shipping_address", "stripe_payment_intent", "total_cents", "subtotal_cents"]) {
    assert.ok(!all.includes(column), `the guest read touches ${column}`);
  }
});

test("only the gift message crosses to the recipient", () => {
  const src = readFileSync(new URL("../../order-milestones.mjs", import.meta.url), "utf8");
  const block = src.slice(src.indexOf("const gift ="), src.indexOf("return new Response"));
  assert.ok(block.includes("is_gift === true"), "the gift block is returned for non-gift orders too");
  assert.ok(block.includes("message"), "the gift block no longer carries the message");
  // hide_prices and wrap are the buyer's arrangement with Lusik. Telling
  // the recipient that prices were hidden is itself telling them there
  // was a price worth hiding.
  assert.ok(!/hide_prices|wrap/.test(block), "the gift block leaks the buyer's packing choices");
});
