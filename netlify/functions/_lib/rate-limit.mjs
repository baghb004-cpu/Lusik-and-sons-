// ============================================================
// rate-limit — shared per-IP bucket for public endpoints
// ============================================================
// Every endpoint that accepts unauthenticated POSTs is a free
// abuse target. The pattern below is the same one waitlist.mjs
// pioneered — IP-keyed daily count in a Netlify Blob — extracted
// here so every public endpoint can opt in without copy-paste.
//
// Usage:
//   import { ipFromRequest, checkRateLimit } from "./_lib/rate-limit.mjs";
//
//   const ip = ipFromRequest(req, context);
//   const rl = await checkRateLimit({
//     bucket: "newsletter",  // namespace; keep per-endpoint
//     ip,
//     limit: 10,
//   });
//   if (!rl.ok) return json(429, { error: "Too many requests" });
//
// Why this is the right granularity:
//   - Per-IP: an attacker can rotate IPs, but most bot operators
//     don't bother for low-value endpoints (newsletter signup,
//     waitlist) — and the ones that do hit our budget on dollars
//     long before they hit it on signups.
//   - Per-day: keeps memory low. The blob key embeds today's
//     date (UTC), so yesterday's keys naturally fall out of the
//     working set; the scheduled cleanup function (see
//     scheduled-blob-cleanup.mjs) sweeps them.
//   - Strict-consistency blob: avoids a race where two requests
//     in the same second both read count=0 and both pass.
//
// What this is NOT:
//   - A WAF. A determined attacker with a botnet won't be
//     stopped here. The goal is to keep the cost-of-abuse
//     non-trivial for the single-laptop attacker.
//   - A user-level limit. Authenticated endpoints should layer
//     a user-level limit ON TOP of this; per-IP alone is too
//     coarse for CGNAT'd mobile users.
// ============================================================

import { getStore } from "@netlify/blobs";

/**
 * Extract the caller's IP from a Netlify request context. Only sources Netlify
 * sets itself are trusted: `context.ip` and the `x-nf-client-connection-ip`
 * header (the platform overwrites the latter at the edge). We deliberately do
 * NOT fall back to `x-forwarded-for` — that header is fully client-controlled,
 * so an attacker could rotate it to mint unlimited rate-limit buckets and slip
 * every per-IP cap. Returns null when no trusted IP is recoverable;
 * checkRateLimit treats a null IP as "deny" (fail closed).
 */
export function ipFromRequest(req, context) {
  return (
    context?.ip ??
    req.headers.get("x-nf-client-connection-ip") ??
    null
  );
}

/**
 * Check + increment an IP's daily count for a given bucket.
 * Returns { ok, used } — `used` reflects the count AFTER this
 * call (for over-limit calls it stays at the limit).
 *
 * Bucket names should be short, lowercase, and unique per endpoint
 * (e.g. "newsletter", "waitlist", "link-guest", "checkout-anon").
 * They're embedded in the blob store name, so they namespace cleanly.
 */
export async function checkRateLimit({ bucket, ip, limit }) {
  if (!bucket || !ip || !Number.isInteger(limit) || limit < 1) {
    // Refuse silently rather than crash — better to deny one
    // signup than to throw an uncaught exception.
    return { ok: false, used: 0 };
  }
  const store = getStore({ name: `rate-limit-${bucket}`, consistency: "strong" });
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const key = `${ip}/${today}`;
  const current = (await store.get(key, { type: "json" })) ?? { count: 0 };
  if (current.count >= limit) {
    return { ok: false, used: current.count };
  }
  await store.setJSON(key, { count: current.count + 1 });
  return { ok: true, used: current.count + 1 };
}
