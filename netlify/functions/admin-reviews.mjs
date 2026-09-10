// ============================================================
// /.netlify/functions/admin-reviews
// ============================================================
// GET                       → { reviews: [...] }  everything, newest first
// PUT { id, status }        → approve or hide one review
//
// Admin only. This is the gate that makes review-submit safe to leave
// public: a customer's words go in as `pending` and nothing reaches the
// site until Lusik has read them.
//
// She can only move `status`. She cannot edit the words, and she cannot
// grant photo consent — a review published in words the customer did not
// write, or a photograph shown that they did not agree to, is worse than
// no reviews at all. Clearing consent is the customer's to ask for and
// is done by hiding the review.
// ============================================================

import { sql }          from "./_lib/db.mjs";
import { requireAdmin } from "./_lib/auth.mjs";
import { json }         from "./_lib/json.mjs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["pending", "approved", "hidden"]);
const MAX_ROWS = 200;

export default async (req, context) => {
  const auth = await requireAdmin(req, context);
  if (auth.response) return auth.response;

  if (req.method === "GET") {
    try {
      const rows = await sql`
        SELECT r.id, r.order_id, r.product_key, r.rating, r.body, r.display_name,
               r.photo_key, r.photo_consent, r.status, r.created_at, r.reviewed_at,
               o.order_number
          FROM reviews r
          JOIN orders o ON o.id = r.order_id
         ORDER BY (r.status = 'pending') DESC, r.created_at DESC
         LIMIT ${MAX_ROWS}
      `;
      return json(200, {
        reviews: (rows ?? []).map((r) => ({
          id: r.id,
          orderNumber: r.order_number,
          productKey: r.product_key,
          rating: Number(r.rating),
          body: r.body ?? "",
          name: r.display_name ?? "",
          photoKey: r.photo_key ?? null,
          photoConsent: r.photo_consent === true,
          status: r.status,
          at: r.created_at,
          reviewedAt: r.reviewed_at ?? null,
        })),
      });
    } catch (err) {
      console.error("admin-reviews read failed:", err?.message || err);
      return json(500, { error: "Could not load reviews" });
    }
  }

  if (req.method !== "PUT") return json(405, { error: "Method not allowed" });

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const id = String(payload?.id ?? "").trim();
  const status = String(payload?.status ?? "").trim();
  if (!UUID_RE.test(id)) return json(400, { error: "id must be a UUID" });
  if (!STATUSES.has(status)) return json(400, { error: "status must be pending, approved or hidden" });

  try {
    const rows = await sql`
      UPDATE reviews
         SET status = ${status}, reviewed_at = now()
       WHERE id = ${id}
       RETURNING id, status
    `;
    if (!rows?.[0]) return json(404, { error: "Not found" });
    return json(200, { ok: true, id: rows[0].id, status: rows[0].status });
  } catch (err) {
    console.error("admin-reviews write failed:", err?.message || err);
    return json(500, { error: "Could not update that review" });
  }
};
