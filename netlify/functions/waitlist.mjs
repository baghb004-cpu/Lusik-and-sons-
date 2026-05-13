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
// ============================================================

import { sql }  from "./_lib/db.mjs";
import { json } from "./_lib/json.mjs";

// Cheap bot filter — same honeypot pattern the old Netlify Forms
// flow used. Real users never fill it; bots scraping inputs do.
const HONEYPOT_FIELD = "bot-field";

export default async (req) => {
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
  if (!productKey || productKey.length > 64) {
    return json(400, { error: "Missing or invalid product key." });
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
