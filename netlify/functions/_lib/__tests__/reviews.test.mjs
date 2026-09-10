// ============================================================
// REVIEWS
// ============================================================
// A public write endpoint on a shop this small is a liability unless
// three things hold, and this file holds all three.
//
//   1. The link is a capability for ONE order, with its own purpose
//      prefix, so the token that lets somebody watch their order cannot
//      also post a review on it.
//   2. Nothing a customer writes reaches the site until Lusik approves
//      it. The public read filters on status.
//   3. A photograph is published only with BOTH approval and explicit
//      consent, and either one going away takes the picture down.
//
// The token tests run the real functions. The rest are read against the
// source, because the shape of a query IS the boundary here: a column
// that is never selected cannot leak, and that is a property of the text
// rather than of a mock.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fn = (name) => readFileSync(new URL(`../../${name}`, import.meta.url), "utf8");
const stripComments = (s) => s.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

// A secret has to exist before the token module is imported, because the
// helpers read it at call time and return null without one.
process.env.ORDER_LINK_SECRET = "test-secret-for-review-tokens-0123456789";
const { signOrderToken, signReviewToken, verifyOrderToken, verifyReviewToken } =
  await import("../order-tokens.mjs");

const ORDER = "11111111-2222-4333-8444-555555555555";
const OTHER = "99999999-8888-4777-8666-555555555555";

test("a review token verifies for its own order and nothing else", () => {
  const token = signReviewToken(ORDER);
  assert.ok(token && token.length > 20);
  assert.equal(verifyReviewToken(ORDER, token), true);
  assert.equal(verifyReviewToken(OTHER, token), false);
  assert.equal(verifyReviewToken(ORDER, token.slice(0, -1)), false);
  assert.equal(verifyReviewToken(ORDER, ""), false);
  assert.equal(verifyReviewToken(ORDER, null), false);
});

test("the two capabilities cannot be swapped", () => {
  // The purpose prefix is the whole reason there are two functions.
  // Without it, the link in a shipping email would also be a licence to
  // write a review, and a review link would open the order timeline.
  const view = signOrderToken(ORDER);
  const review = signReviewToken(ORDER);
  assert.notEqual(view, review);
  assert.equal(verifyReviewToken(ORDER, view), false, "an order-view token was accepted as a review token");
  assert.equal(verifyOrderToken(ORDER, review), false, "a review token was accepted as an order-view token");
});

test("no secret means no links, rather than guessable ones", async () => {
  const saved = { a: process.env.ORDER_LINK_SECRET, b: process.env.REMINDER_SECRET };
  process.env.ORDER_LINK_SECRET = "";
  process.env.REMINDER_SECRET = "";
  try {
    assert.equal(signReviewToken(ORDER), null);
    assert.equal(verifyReviewToken(ORDER, "anything"), false);
  } finally {
    process.env.ORDER_LINK_SECRET = saved.a;
    process.env.REMINDER_SECRET = saved.b;
  }
});

test("a submitted review is never published by the act of submitting it", () => {
  const src = stripComments(fn("review-submit.mjs"));
  assert.ok(/status\s*\)?\s*\n?\s*VALUES[\s\S]*'pending'/.test(src) || src.includes("'pending'"),
    "review-submit does not insert as pending");
  assert.ok(!src.includes("'approved'"),
    "review-submit can write an approved review, so a public POST publishes straight to the site");
  // Editing must not keep an old approval: otherwise an approved review
  // can be rewritten into something else after the fact.
  assert.ok(/status\s*=\s*'pending'/.test(src), "an edited review does not go back to pending");
});

test("the product a review lands on comes from the order, not the request", () => {
  const src = stripComments(fn("review-submit.mjs"));
  assert.ok(src.includes("SELECT product_key FROM order_items"),
    "review-submit no longer reads the product from the order");
  assert.ok(!/payload\??\.\s*productKey|payload\??\.\s*product_key/.test(src),
    "review-submit takes a product key from the request body, so a bib token could review the blanket");
});

test("the public read only ever returns approved rows", () => {
  const src = stripComments(fn("reviews.mjs"));
  const queries = src.split("sql`").slice(1);
  assert.ok(queries.length >= 2, "the review queries are no longer where this test looks");
  for (const q of queries) {
    const body = q.slice(0, q.indexOf("`"));
    assert.ok(/status\s*=\s*'approved'/.test(body), `a public review query has no approved filter:\n${body}`);
  }
  // Nothing that identifies the buyer.
  for (const column of ["customer_email", "order_id", "order_number", "shipping_address"]) {
    assert.ok(!src.includes(column), `the public review read returns ${column}`);
  }
});

test("the wall needs consent as well as approval", () => {
  const src = stripComments(fn("reviews.mjs"));
  const wall = src.slice(src.indexOf("wall"), src.indexOf("} else {"));
  assert.ok(/photo_consent\s*=\s*true/.test(wall), "the wall query does not check photo consent");
  assert.ok(/photo_key IS NOT NULL/.test(wall), "the wall query can return rows with no photograph");
});

test("a review photograph is served only while approved AND consented", () => {
  const src = stripComments(fn("review-photo-get.mjs"));
  const gate = src.slice(src.indexOf("SELECT 1 FROM reviews"), src.lastIndexOf("getStore"));
  assert.ok(gate.length > 40, "the photo gate query is no longer where this test looks");
  assert.ok(/status\s*=\s*'approved'/.test(gate), "the photo gate does not require approval");
  assert.ok(/photo_consent\s*=\s*true/.test(gate), "the photo gate does not require consent");
  // Checked live rather than baked into the key, because consent is
  // something a person can withdraw.
  assert.ok(src.includes("photo_key = ${key}"), "the photo gate does not look the key up at request time");
  assert.ok(!/max-age=\s*(?:[1-9]\d{4,})/.test(src),
    "the photograph is cached for long enough to outlive a withdrawn consent");
});

test("only Lusik can change a review, and only its status", () => {
  const src = stripComments(fn("admin-reviews.mjs"));
  assert.ok(src.includes("requireAdmin"), "admin-reviews is not admin-gated");
  const update = src.slice(src.indexOf("UPDATE reviews"), src.indexOf("RETURNING"));
  assert.ok(/SET status = \$\{status\}/.test(update), "the admin update no longer sets status");
  for (const column of ["body", "display_name", "rating", "photo_consent", "photo_key"]) {
    assert.ok(!update.includes(column),
      `admin-reviews can write ${column} — words a customer did not write, or consent they did not give`);
  }
});

test("the post-delivery ask is stamped before it is sent, and released on failure", () => {
  const src = stripComments(fn("review-request.mjs"));
  const claimAt = src.indexOf("SET review_request_sent_at = now()");
  const sendAt = src.indexOf("sendReviewRequest(");
  assert.ok(claimAt > -1 && sendAt > -1, "the claim or the send moved");
  assert.ok(claimAt < sendAt, "the send happens before the claim, so a retry double-sends");
  assert.ok(src.includes("SET review_request_sent_at = NULL"),
    "a failed send never releases its claim, so that order is never asked again");
  assert.ok(src.includes("isScheduledInvocation"), "the scheduled job is publicly callable");
  // Fourteen days, and never for a cancelled order.
  assert.ok(/INTERVAL '14 days'/.test(src), "the fortnight wait changed without the copy changing with it");
  assert.ok(/fulfillment_status <> 'cancelled'/.test(src),
    "a cancelled order still gets asked how its piece is holding up");
});

test("nothing is offered in exchange for a review", () => {
  // A review that was paid for is not a review. Cheap to state, and the
  // kind of thing that gets added later by somebody optimising.
  const src = fn("_lib/email.mjs");
  const block = src.slice(src.indexOf("export async function sendReviewRequest"), src.indexOf("sendCartAbandonmentRecovery"));
  assert.ok(block.length > 200, "the review-request email moved");
  assert.ok(!/discount|coupon|% off|promo/i.test(block.replace(/\/\/.*$/gm, "")),
    "the review request offers something in return");
});
