// ============================================================
// /.netlify/functions/admin-waitlist-notify
// ============================================================
// POST { product_key, product_name, product_url }
//   → emails every waitlist entry with notified_at IS NULL
//     for that product_key, then stamps notified_at on success.
//
// Admin-only. The product_name + product_url come from the
// admin UI so we don't have to make assumptions about how the
// product is exposed — Lusik can point the email at the bib
// PDP, a journal post, or the home page.
//
// Caps the batch at MAX_PER_RUN. If Lusik built up a huge
// waitlist before launch she might need to click Notify a few
// times; on each click the response tells her how many remain.
// ============================================================

import { sql }                      from "./_lib/db.mjs";
import { requireAdmin }             from "./_lib/auth.mjs";
import { json }                     from "./_lib/json.mjs";
import { sendWaitlistAvailableEmail } from "./_lib/email.mjs";

const MAX_PER_RUN = 100;

export default async (req, context) => {
  const auth = await requireAdmin(req, context);
  if (auth.response) return auth.response;

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const body = await req.json().catch(() => ({}));
  // Cap lengths + shape-validate even though this is admin-gated: a
  // careless or compromised admin shouldn't be able to blast an
  // unbounded name or a phishing link from the trusted sender to up to
  // 100 customers. product_key is parameterized in SQL (no injection),
  // but we still bound it.
  const productKey  = typeof body?.product_key === "string"  ? body.product_key.trim().slice(0, 64)   : "";
  const productName = typeof body?.product_name === "string" ? body.product_name.trim().slice(0, 200) : "";
  const rawUrl      = typeof body?.product_url === "string"  ? body.product_url.trim()                 : "";

  if (!productKey || !/^[a-z][a-z0-9_-]{0,63}$/.test(productKey)) {
    return json(400, { error: "Missing or malformed product_key" });
  }
  if (!productName) {
    return json(400, { error: "Missing product_name" });
  }
  // The CTA link is embedded in an email sent from lusikandsons.com.
  // Only allow https URLs so it can never become a javascript:/http
  // phishing vector. Empty is fine (the email composer omits the CTA).
  let productUrl = "";
  if (rawUrl) {
    let parsed;
    try { parsed = new URL(rawUrl); } catch { parsed = null; }
    if (!parsed || parsed.protocol !== "https:") {
      return json(400, { error: "product_url must be an https:// link" });
    }
    productUrl = parsed.toString();
  }

  const eligible = await sql`
    SELECT id, email
      FROM product_waitlist
     WHERE product_key = ${productKey}
       AND notified_at IS NULL
     ORDER BY created_at ASC
     LIMIT ${MAX_PER_RUN}
  `;

  let sent = 0;
  let failed = 0;
  for (const row of eligible) {
    const ok = await sendWaitlistAvailableEmail({
      to:          row.email,
      productName,
      productUrl,
    }).catch((err) => {
      // Log the row id, not the email — admin-scoped logs still
      // shouldn't have raw PII in them.
      console.warn("[admin-waitlist-notify] send threw for row", row.id, err?.message ?? err);
      return false;
    });
    if (ok) {
      await sql`UPDATE product_waitlist SET notified_at = now() WHERE id = ${row.id}`;
      sent += 1;
    } else {
      failed += 1;
    }
  }

  // After processing this batch, report how many are still pending
  // so the admin UI can show "X remaining — click Notify again."
  const [{ remaining }] = await sql`
    SELECT COUNT(*)::int AS remaining
      FROM product_waitlist
     WHERE product_key = ${productKey}
       AND notified_at IS NULL
  `;

  return json(200, { sent, failed, remaining });
};
