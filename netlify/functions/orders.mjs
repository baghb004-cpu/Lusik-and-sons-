// ============================================================
// /.netlify/functions/orders
// ============================================================
// GET -> the signed-in user's order history (orders + items),
//        newest first. Shape matches what the OrderHistory
//        component expects, so the React side doesn't need to
//        reshape anything.
// ============================================================

import { sql }         from "./_lib/db.mjs";
import { requireUser } from "./_lib/auth.mjs";
import { json }        from "./_lib/json.mjs";

export default async (req, context) => {
  const auth = requireUser(context);
  if (auth.response) return auth.response;
  const { user } = auth;

  if (req.method !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  // One round-trip via json_agg so we don't N+1. Each order row
  // already contains its `order_items` array.
  //
  // What's deliberately NOT in this SELECT (kept on the server
  // side only): admin_notes (Lusik's internal scratchpad),
  // stripe_session_id and stripe_payment_intent (Stripe-side
  // identifiers customers don't need), social_consent
  // (customer's own opt-in record — they can see it in their
  // /account-export download), finished_photo_emailed_at
  // (internal dedupe state).
  const rows = await sql`
    SELECT
      o.id,
      o.order_number,
      o.status,
      o.fulfillment_status,
      o.subtotal_cents,
      o.shipping_cents,
      o.tax_cents,
      o.total_cents,
      o.refunded_cents,
      o.shipping_address,
      o.carrier,
      o.tracking_number,
      o.estimated_ship_date,
      o.shipped_at,
      o.confirmed_at,
      o.finished_photo_key,
      o.admin_message,
      o.admin_message_updated_at,
      o.gift,
      o.created_at,
      COALESCE(
        (
          SELECT json_agg(json_build_object(
            'id',                oi.id,
            'product_name',      oi.product_name,
            'variant_label',     oi.variant_label,
            'quantity',          oi.quantity,
            'unit_price_cents',  oi.unit_price_cents,
            'is_custom',         oi.is_custom,
            'custom_image_url',  oi.custom_image_url
          ) ORDER BY oi.created_at)
          FROM order_items oi WHERE oi.order_id = o.id
        ),
        '[]'::json
      ) AS order_items
    FROM orders o
    WHERE o.user_id = ${user.id}
    ORDER BY o.created_at DESC
  `;
  return json(200, { orders: rows });
};
