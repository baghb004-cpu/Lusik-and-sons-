// ============================================================
// Lead-time drift + math guard
// ============================================================
// The queue dials live twice on purpose:
//   - Server: netlify/functions/lead-time.mjs — the buffer the public
//     endpoint reports from the live order queue.
//   - Browser: CONFIG.LEAD_TIMES (src/data/config.js), consumed through
//     src/lib/leadTime.js — the dates a customer actually reads.
//
// They MUST agree, or a product page quotes a date the shop is not
// working toward. This test enforces lockstep plus the shape of the
// per-product table and the date math itself.
//
// It also guards the owner's copy rule: the lead-time strings must not
// explain WHY a piece takes as long as it does.
// ============================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { CONFIG } = await import("../../../../src/data/config.js");
const lead = await import("../../../../src/lib/leadTime.js");

const queue = await import("../lead-time-queue.mjs");

test("the server's queue dials match CONFIG.LEAD_TIMES", () => {
  assert.equal(queue.QUEUE_DAYS_PER_OPEN_ORDER, CONFIG.LEAD_TIMES.QUEUE_DAYS_PER_OPEN_ORDER,
    "QUEUE_DAYS_PER_OPEN_ORDER drift between config.js and _lib/lead-time-queue.mjs");
  assert.equal(queue.QUEUE_BUFFER_CAP_DAYS, CONFIG.LEAD_TIMES.QUEUE_BUFFER_CAP_DAYS,
    "QUEUE_BUFFER_CAP_DAYS drift between config.js and _lib/lead-time-queue.mjs");
  assert.equal(queue.QUEUE_ENABLED, CONFIG.LEAD_TIMES.QUEUE_ENABLED,
    "QUEUE_ENABLED drift between config.js and _lib/lead-time-queue.mjs");
});

test("server and browser compute the SAME buffer for real inputs", () => {
  // Behavioural, not textual: an earlier version matched the Function's
  // source with a regex and passed happily when the formula was mutated.
  for (const n of [0, 1, 2, 3, 5, 7, 10, 11, 20, 500, -3, 1.7, NaN]) {
    assert.equal(queue.queueDaysFor(n), lead.queueBufferDays(n),
      `queue buffer drift at openOrders=${n}`);
  }
});

test("the endpoint actually uses the shared queue math", () => {
  // Cheap structural guard: the Function must not re-inline the formula.
  const src = readFileSync(new URL("../../lead-time.mjs", import.meta.url), "utf8");
  assert.match(src, /queueDaysFor\(/, "lead-time.mjs must call the shared queueDaysFor()");
  assert.equal(/QUEUE_DAYS_PER_OPEN_ORDER\s*=/.test(src), false,
    "lead-time.mjs must not redeclare the queue dials — import them");
});

test("every live product has a lead time, ordered low-to-high and sane", () => {
  const weeks = CONFIG.LEAD_TIMES.WEEKS;
  for (const key of ["blanket-alphabet", "blanket-full-alphabet", "bib-single", "bib",
                     "bib-days-of-week", "bib-hy-em", "bib-anushig-pair",
                     "bib-bari-akhorzhak-set"]) {
    const w = weeks[key];
    assert.ok(Array.isArray(w) && w.length === 2, `missing lead time for ${key}`);
    assert.ok(w[0] >= 1 && w[0] <= w[1] && w[1] <= 26, `implausible lead time for ${key}: ${w}`);
  }
});

test("weeksFor falls back for an unknown key instead of throwing", () => {
  assert.deepEqual(lead.weeksFor("blanket-alphabet"), [4, 6]);
  assert.deepEqual(lead.weeksFor("no-such-product"), CONFIG.LEAD_TIMES.DEFAULT_WEEKS);
  assert.deepEqual(lead.weeksFor(undefined), CONFIG.LEAD_TIMES.DEFAULT_WEEKS);
});

test("queue buffer scales per open order and stops at the cap", () => {
  const per = CONFIG.LEAD_TIMES.QUEUE_DAYS_PER_OPEN_ORDER;
  const cap = CONFIG.LEAD_TIMES.QUEUE_BUFFER_CAP_DAYS;
  assert.equal(lead.queueBufferDays(0), 0);
  assert.equal(lead.queueBufferDays(1), per);
  assert.equal(lead.queueBufferDays(3), 3 * per);
  assert.equal(lead.queueBufferDays(9999), cap);
  assert.equal(lead.queueBufferDays(-5), 0);
  assert.equal(lead.queueBufferDays(NaN), 0);
});

test("dates: the ship window opens after the build time and never runs backwards", () => {
  const today = new Date("2026-03-02T12:00:00Z"); // a Monday
  const blanket = lead.getLeadTime("blanket-alphabet", { today, queueDays: 0 });
  assert.deepEqual(blanket.weeks, [4, 6]);
  // 4 weeks out, to the day
  assert.equal(blanket.shipMin.toISOString().slice(0, 10), "2026-03-30");
  assert.equal(blanket.shipMax.toISOString().slice(0, 10), "2026-04-13");
  assert.ok(blanket.shipMax >= blanket.shipMin);
  assert.match(blanket.shipBy, /–/);
  assert.match(blanket.arrives, /–/);

  // A queue pushes the whole window back by exactly that many days.
  const queued = lead.getLeadTime("blanket-alphabet", { today, queueDays: 6 });
  assert.equal(queued.shipMin.toISOString().slice(0, 10), "2026-04-05");
  assert.equal(queued.queueDays, 6);

  // The heirloom blanket really is the long one.
  const full = lead.getLeadTime("blanket-full-alphabet", { today });
  assert.ok(full.shipMin > blanket.shipMin, "full alphabet must quote later than the ABC blanket");
});

test("the slowest piece in a bag decides the ship date", () => {
  assert.equal(lead.slowestKey(["bib-single", "blanket-full-alphabet"]), "blanket-full-alphabet");
  assert.equal(lead.slowestKey(["bib-single", "bib-hy-em"]), "bib-single");
  assert.equal(lead.slowestKey([]), null);
  assert.equal(lead.slowestKey(null), null);
});

test("weeksLabel reads as plain language", () => {
  assert.equal(lead.weeksLabel("blanket-alphabet"), "about 4 to 6 weeks");
  assert.equal(lead.weeksLabel("blanket-full-alphabet"), "about 10 to 12 weeks");
});

test("the lead-time copy never explains WHY a piece takes as long as it does", () => {
  // The owner's rule: state the time, offer a phone call, say nothing
  // about the maker's schedule or workload.
  const forbidden = /working alone|second job|day job|evenings?\b|after work|only has|spare time|buffer for life/i;
  const files = [
    "content/pages/faq.json",
    "content/products/full-alphabet-crib-blanket.json",
    "content/products/days-of-the-week-bib-set.json",
    "content/products/anushig-bib-set.json",
    "content/products/bari-akhorzhak-bib-burp-cloth-set.json",
    "content/products/hy-em-armenian-bib.json",
    "src/data/config.js",
    "src/data/policies.js",
    "src/i18n/translations.js",
  ];
  for (const rel of files) {
    const text = readFileSync(new URL(`../../../../${rel}`, import.meta.url), "utf8");
    const hit = forbidden.exec(text);
    assert.equal(hit, null, `${rel} explains the lead time ("${hit?.[0]}") — state the time, not the reason`);
  }
});
