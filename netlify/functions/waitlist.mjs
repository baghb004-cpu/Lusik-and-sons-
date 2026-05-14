// ============================================================
// /.netlify/functions/waitlist
// ============================================================
// POST { email, product_key, product_name }
//   → upserts a row into product_waitlist
//   → returns { ok: true } on success
//
// Public (no auth). Customers click "Notify me when this is
// available" on a placeholder catalog item, type an email,
// and we store it. The admin "Notify" sweep later reads from
// this table when Lusik flips the product live.
//
// UNIQUE (lower(email), product_key) means re-signups don't
// create duplicates; ON CONFLICT DO NOTHING quietly absorbs
// the second click.
//
// Rate-limited by client IP so an attacker can't bloat the
// table with fresh emails — same pattern as chat.mjs.
// productKey is shape-validated against a strict regex so
// random strings can't pad rows for non-existent products.
// ============================================================

import { getStore } from "@netlify/blobs";
import { sql }  from "./_lib/db.mjs";
import { json } from "./_lib/json.mjs";

// Cheap bot filter — same honeypot pattern the old Netlify Forms
// flow used. Real users never fill it; bots scraping inputs do.
const HONEYPOT_FIELD = "bot-field";

// Per-IP daily cap. Generous enough that a real customer signing up
// for every placeholder catalog item still gets through; tight
// enough that an attacker can't run away with the table.
const MAX_SIGNUPS_PER_IP_PER_DAY = 20;

// productKey shape: starts with a letter, lowercase alphanumeric +
// dashes + underscores, max 64 chars. Mirrors the shape of every key
// in CATALOG / PRODUCT.layouts. Strict enough that an attacker can't
// scribble HTML or path tricks into the column; loose enough that
// adding a new product never requires updating this function.
const PRODUCT_KEY_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;

async function checkAndIncrementIpBucket(ip) {
  if (!ip) return { ok: false, used: 0 }; // deny when we can't identify the caller
  const store = getStore({ name: "waitlist-rate", consistency: "strong" });
  const today = new Date().toISOString().slice(0, 10);
  const key = `${ip}/${today}`;
  const current = await store.get(key, { type: "json" }) ?? { count: 0 };
  if (current.count >= MAX_SIGNUPS_PER_IP_PER_DAY) {
    return { ok: false, used: current.count };
  }
  await store.setJSON(key, { count: current.count + 1 });
  return { ok: true, used: current.count + 1 };
}

export default async (req, context) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const body = await req.json().catch(() => ({}));
  if (body?.[HONEYPOT_FIELD]) {
    // Honeypot tripped — pretend it worked so the bot moves on.
    return json(200, { ok: true });
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const productKey = typeof body?.product_key === "string" ? body.product_key.trim() : "";
  const productName = typeof body?.product_name === "string"
    ? body.product_name.trim().slice(0, 200)
    : null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { error: "Please enter a valid email address." });
  }
  if (!productKey || !PRODUCT_KEY_PATTERN.test(productKey)) {
    return json(400, { error: "Unknown product." });
  }

  // Rate-limit by IP. If both IP and the resolved fallback fail we
  // deny — better to reject one signup than to leak abuse-budget.
  const ip = context?.ip
          || req.headers.get("x-nf-client-connection-ip")
          || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          || null;
  const rate = await checkAndIncrementIpBucket(ip);
  if (!rate.ok) {
    return json(429, { error: "Too many signups from this network today. Try again tomorrow or email hello@lusikandsons.com." });
  }

  // INSERT ... ON CONFLICT keeps the original notified_at if a
  // re-signup happens after the customer was already notified —
  // which means a duplicate signup won't double-email them.
  await sql`
    INSERT INTO product_waitlist (email, product_key, product_name)
    VALUES (${email.toLowerCase()}, ${productKey}, ${productName})
    ON CONFLICT (lower(email), product_key) DO NOTHING
  `;

  return json(200, { ok: true });
};
