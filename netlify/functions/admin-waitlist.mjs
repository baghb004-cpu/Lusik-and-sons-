// ============================================================
// /.netlify/functions/admin-waitlist
// ============================================================
// GET → { items: [{ product_key, product_name, pending, notified }] }
//
// Admin-only. Returns one row per product that has at least one
// waitlist signup, with counts of pending (not yet notified) and
// already-notified entries. The admin UI uses this to render the
// "Waitlists" panel with a Notify button per product.
//
// Email addresses are NOT returned — Lusik doesn't need to see
// them, and not exposing them means an admin-side breach doesn't
// leak the list.
// ============================================================

import { sql }           from "./_lib/db.mjs";
import { requireAdmin }  from "./_lib/auth.mjs";
import { json }          from "./_lib/json.mjs";

export default async (req, context) => {
  const auth = requireAdmin(context);
  if (auth.response) return auth.response;

  if (req.method !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const rows = await sql`
    SELECT
      product_key,
      MAX(product_name) AS product_name,
      COUNT(*) FILTER (WHERE notified_at IS NULL)    AS pending,
      COUNT(*) FILTER (WHERE notified_at IS NOT NULL) AS notified
    FROM product_waitlist
    GROUP BY product_key
    ORDER BY pending DESC, product_key ASC
  `;

  return json(200, {
    items: rows.map((r) => ({
      product_key:  r.product_key,
      product_name: r.product_name,
      pending:      Number(r.pending),
      notified:     Number(r.notified),
    })),
  });
};
