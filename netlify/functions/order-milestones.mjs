// ============================================================
// /.netlify/functions/order-milestones
// ============================================================
// GET ?order_id=<uuid>[&token=<signed>] → that order's timeline:
//   { orderNumber, status, milestones: [{ milestone, note, photoKey, at }] }
//
// Two ways in, both read-only:
//   * A signed-in customer who owns the order (Identity JWT).
//   * A guest holding the signed link from their confirmation email.
//     The token is an HMAC of the order id (_lib/order-tokens.mjs), so
//     it cannot be guessed or edited into someone else's order.
//
// Deliberately narrow: milestones, the order number, and the fulfillment
// status. No address, no email, no payment detail, nothing writable.
// A wrong or missing credential gets 404, not 403, so the endpoint never
// confirms that an order id exists.
// ============================================================

import { sql }  from "./_lib/db.mjs";
import { json } from "./_lib/json.mjs";
import { requireUser } from "./_lib/auth.mjs";
import { verifyOrderToken } from "./_lib/order-tokens.mjs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async (req, context) => {
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });

  const url = new URL(req.url);
  const orderId = String(url.searchParams.get("order_id") || "");
  const token = url.searchParams.get("token");
  if (!UUID_RE.test(orderId)) return json(400, { error: "order_id must be a UUID" });

  // Establish the right to read this one order before touching it.
  let allowed = false;
  if (token) {
    allowed = verifyOrderToken(orderId, token);
  } else {
    const auth = await requireUser(req, context);
    if (!auth.response && auth.user?.id) {
      try {
        const owned = await sql`
          SELECT 1 FROM orders WHERE id = ${orderId} AND user_id = ${auth.user.id} LIMIT 1
        `;
        allowed = (owned?.length ?? 0) > 0;
      } catch (err) {
        console.error("order-milestones ownership check failed:", err?.message || err);
        return json(500, { error: "Could not load the timeline" });
      }
    }
  }
  // Same answer for "no such order" and "not yours": never confirm an id.
  if (!allowed) return json(404, { error: "Not found" });

  try {
    const orders = await sql`
      SELECT order_number, fulfillment_status, created_at
      FROM orders WHERE id = ${orderId} LIMIT 1
    `;
    const order = orders?.[0];
    if (!order) return json(404, { error: "Not found" });

    const rows = await sql`
      SELECT milestone, note, photo_key, created_at
      FROM order_milestones
      WHERE order_id = ${orderId}
      ORDER BY created_at ASC, id ASC
    `;

    return new Response(JSON.stringify({
      orderNumber: order.order_number,
      status: order.fulfillment_status,
      placedAt: order.created_at,
      milestones: (rows ?? []).map((r) => ({
        milestone: r.milestone,
        note: r.note ?? null,
        photoKey: r.photo_key ?? null,
        at: r.created_at,
      })),
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // A signed guest link is a capability URL; never let a shared
        // cache hold one visitor's timeline for another.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("order-milestones read failed:", err?.message || err);
    return json(500, { error: "Could not load the timeline" });
  }
};
