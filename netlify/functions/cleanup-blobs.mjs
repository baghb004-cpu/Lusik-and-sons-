// ============================================================
// /.netlify/functions/cleanup-blobs  (scheduled)
// ============================================================
// Daily sweep that prunes stale entries in two blob stores:
//
//   1. pending-orders
//      One entry is written per `create-checkout-session` call,
//      keyed by Stripe session id. Normal lifecycle: the
//      stripe-webhook deletes the entry on `checkout.session.
//      completed` or `checkout.session.expired`. But if either
//      webhook event fails to deliver (Stripe outage, our
//      function 500s past Stripe's retry budget, etc.), the
//      entry can be orphaned indefinitely — bloating the store
//      and keeping the customer's cart + email accessible
//      longer than is necessary.
//
//   2. rate-limit-*
//      Per-IP per-day counters. The keys embed the date, so
//      yesterday's keys are inert — but they never get deleted
//      automatically. A single misbehaving subnet over a year
//      of operation can leave thousands of zombie keys.
//
// Retention: anything older than 30 days gets deleted. That's
// well past Stripe's longest retry window (3 days) and gives
// Lusik a month to look at audit data if anything goes wrong
// in the order pipeline.
//
// This function is privacy-positive (PII shrinks every day) and
// budget-positive (storage shrinks). The cost is one daily
// function invocation plus N blob list+delete calls — well
// within Netlify's free tier even at 100x current volume.
// ============================================================

import { getStore } from "@netlify/blobs";
import { isScheduledInvocation, forbidden } from "./_lib/scheduled.mjs";

// Daily at 04:00 UTC. Off-peak for everyone, no overlap with
// the gift-reminder scheduled function (09:00 UTC) so a slow
// cleanup can't block reminders.
export const config = { schedule: "0 4 * * *" };

const RETENTION_DAYS = 30;

// The full list of rate-limit buckets we know about, so the
// cleanup is exhaustive and doesn't depend on `listStores()`
// (which @netlify/blobs doesn't expose). When a new endpoint
// adds a `checkRateLimit({ bucket: "foo" })` call, add "foo"
// here so its zombie keys get pruned too.
const RATE_LIMIT_BUCKETS = [
  "waitlist",
  "checkout-start",
  "link-guest",
  "chat-session",
  "chat-ip",
];

// Pending-orders blobs are keyed by Stripe session id (no date
// in the key), so we can't filter by name alone — we have to
// list each blob and read its metadata or stored timestamp.
// We stored `createdAt` in the JSON body when stashing, so use
// that.
async function cleanupPendingOrders(cutoffIso) {
  const store = getStore({ name: "pending-orders", consistency: "strong" });
  let pruned = 0, kept = 0, errors = 0;
  for await (const { key } of store.list()) {
    try {
      const blob = await store.get(key, { type: "json" });
      // Malformed or empty entries are also safe to drop — they
      // can't be the source of a useful order recovery anyway.
      const createdAt = blob?.createdAt;
      if (!createdAt || typeof createdAt !== "string" || createdAt < cutoffIso) {
        await store.delete(key);
        pruned++;
      } else {
        kept++;
      }
    } catch (err) {
      console.warn("[cleanup-blobs] pending-orders error on", key, err?.message);
      errors++;
    }
  }
  return { pruned, kept, errors };
}

// Rate-limit blobs use keys of shape `<ip>/<YYYY-MM-DD>`. The
// date is right there in the key, so we don't need to read
// the body — string-compare against the cutoff date.
async function cleanupRateLimitBucket(bucket, cutoffDate) {
  const store = getStore({ name: `rate-limit-${bucket}`, consistency: "strong" });
  let pruned = 0, kept = 0, errors = 0;
  for await (const { key } of store.list()) {
    try {
      // Key shape: `<ip>/<date>`. If the suffix isn't a date,
      // err on the safe side and keep it; that's a weird key
      // and we don't want to silently delete something we
      // don't recognize.
      const datePart = key.split("/").pop();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        kept++;
        continue;
      }
      if (datePart < cutoffDate) {
        await store.delete(key);
        pruned++;
      } else {
        kept++;
      }
    } catch (err) {
      console.warn(`[cleanup-blobs] ${bucket} error on`, key, err?.message);
      errors++;
    }
  }
  return { pruned, kept, errors };
}

export default async (req) => {
  // HTTP gate — Netlify scheduled functions are reachable at the
  // public function URL. Without this check an attacker could
  // race-trigger pruning of pending-orders blobs that the webhook
  // is about to consume, or rapidly inflate function-invocation
  // counts against the project's plan. See _lib/scheduled.mjs.
  if (!(await isScheduledInvocation(req))) return forbidden();

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);
  const cutoffIso  = cutoff.toISOString();
  const cutoffDate = cutoffIso.slice(0, 10); // YYYY-MM-DD

  const summary = {
    cutoff: cutoffIso,
    pendingOrders: await cleanupPendingOrders(cutoffIso),
    rateLimit: {},
  };
  for (const bucket of RATE_LIMIT_BUCKETS) {
    summary.rateLimit[bucket] = await cleanupRateLimitBucket(bucket, cutoffDate);
  }
  console.log("[cleanup-blobs]", JSON.stringify(summary));
  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
