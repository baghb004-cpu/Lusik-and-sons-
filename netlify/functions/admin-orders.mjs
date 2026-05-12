// ============================================================
// /.netlify/functions/admin-orders
// ============================================================
// Lusik's admin endpoint for the order-management view.
//
//   GET    /admin-orders                  → { orders: [...] }
//   GET    /admin-orders?id=<order_id>    → { order: {...} }
//   PUT    /admin-orders?id=<order_id>    → { order: {...} }
//                                           body fields (all optional):
//                                             fulfillment_status
//                                             carrier
//                                             tracking_number
//                                             estimated_ship_date  (ISO YYYY-MM-DD)
//                                             admin_notes
//
// Auth: requireAdmin (Identity role "admin" OR ADMIN_EMAILS env-var
// fallback). No customer can hit this — every path returns 403 if
// the JWT doesn't carry the role.
// ============================================================

import { sql }          from "./_lib/db.mjs";
import { requireAdmin } from "./_lib/auth.mjs";
import { json }         from "./_lib/json.mjs";

// Whitelisted enum values — anything outside this set is rejected
// at the PUT layer so a malformed payload can't put an order into
// an unknown state.
const ALLOWED_STATUSES = [
  "awaiting_lusik",
  "in_production",
  "quality_check",
  "ready_to_ship",
  "shipped",
  "delivered",
  "refunded",
];
const ALLOWED_CARRIERS = [
  "USPS Ground Advantage",
  "UPS Ground",
  "FedEx Home Delivery",
  "Free U.S. shipping",
  null,
  "",
];

export default async (req, context) => {
  const auth = requireAdmin(context);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const id  = url.searchParams.get("id");

  // ----- GET -----
  if (req.method === "GET") {
    if (id) {
      const rows = await sql`
        SELECT
          o.*,
          COALESCE(
            (
              SELECT json_agg(json_build_object(
                'id',               oi.id,
                'product_key',      oi.product_key,
                'product_name',     oi.product_name,
                'variant_label',    oi.variant_label,
                'quantity',         oi.quantity,
                'unit_price_cents', oi.unit_price_cents,
                'is_custom',        oi.is_custom,
                'custom_image_url', oi.custom_image_url,
                'custom_metadata',  oi.custom_metadata
              ) ORDER BY oi.created_at)
              FROM order_items oi WHERE oi.order_id = o.id
            ),
            '[]'::json
          ) AS order_items
        FROM orders o
        WHERE o.id = ${id}
        LIMIT 1
      `;
      if (rows.length === 0) return json(404, { error: "Order not found" });
      return json(200, { order: rows[0] });
    }
    // List view — newest first, with line-item count for the
    // summary cards. Skip line-item details in the list to keep
    // the payload small; the detail view fetches them on demand.
    const rows = await sql`
      SELECT
        o.id,
        o.order_number,
        o.customer_email,
        o.user_id,
        o.status,
        o.fulfillment_status,
        o.subtotal_cents,
        o.total_cents,
        o.shipping_cents,
        o.carrier,
        o.tracking_number,
        o.estimated_ship_date,
        o.shipping_address,
        o.gift,
        o.social_consent,
        o.finished_photo_key,
        o.admin_notes,
        o.created_at,
        COALESCE((SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id), 0)::int AS item_count
      FROM orders o
      ORDER BY o.created_at DESC
      LIMIT 200
    `;
    return json(200, { orders: rows });
  }

  // ----- PUT -----
  if (req.method === "PUT") {
    if (!id) return json(400, { error: "Missing id" });
    const body = await req.json().catch(() => ({}));

    const updates = {};
    if (typeof body.fulfillment_status === "string") {
      if (!ALLOWED_STATUSES.includes(body.fulfillment_status)) {
        return json(400, { error: `Unknown fulfillment_status: ${body.fulfillment_status}` });
      }
      updates.fulfillment_status = body.fulfillment_status;
    }
    if ("carrier" in body) {
      const c = body.carrier === null ? null : String(body.carrier);
      if (!ALLOWED_CARRIERS.includes(c)) {
        return json(400, { error: `Unknown carrier: ${c}` });
      }
      updates.carrier = c || null;
    }
    if ("tracking_number" in body) {
      const t = body.tracking_number === null ? null : String(body.tracking_number).trim();
      updates.tracking_number = t || null;
    }
    if ("estimated_ship_date" in body) {
      const d = body.estimated_ship_date;
      if (d && !/^\d{4}-\d{2}-\d{2}$/.test(String(d))) {
        return json(400, { error: "estimated_ship_date must be YYYY-MM-DD" });
      }
      updates.estimated_ship_date = d || null;
    }
    if ("admin_notes" in body) {
      const n = body.admin_notes === null ? null : String(body.admin_notes);
      updates.admin_notes = n || null;
    }

    if (Object.keys(updates).length === 0) {
      return json(400, { error: "No updatable fields in body" });
    }

    // Use COALESCE so missing keys preserve existing values.
    const rows = await sql`
      UPDATE orders SET
        fulfillment_status  = COALESCE(${updates.fulfillment_status  ?? null}, fulfillment_status),
        carrier             = CASE WHEN ${'carrier' in updates} THEN ${updates.carrier ?? null} ELSE carrier END,
        tracking_number     = CASE WHEN ${'tracking_number' in updates} THEN ${updates.tracking_number ?? null} ELSE tracking_number END,
        estimated_ship_date = CASE WHEN ${'estimated_ship_date' in updates} THEN ${updates.estimated_ship_date ?? null}::date ELSE estimated_ship_date END,
        admin_notes         = CASE WHEN ${'admin_notes' in updates} THEN ${updates.admin_notes ?? null} ELSE admin_notes END
      WHERE id = ${id}
      RETURNING *
    `;
    if (rows.length === 0) return json(404, { error: "Order not found" });
    return json(200, { order: rows[0] });
  }

  return json(405, { error: "Method not allowed" });
};
