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
