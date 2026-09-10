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
import { requireUser, isAdmin } from "./_lib/auth.mjs";
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
        // Lusik reads the same timeline from the admin panel, and she is
        // not the order's owner — same pattern as order-photo-get.
        if (isAdmin(auth.user)) {
          allowed = true;
        } else {
          const owned = await sql`
            SELECT 1 FROM orders WHERE id = ${orderId} AND user_id = ${auth.user.id} LIMIT 1
          `;
          allowed = (owned?.length ?? 0) > 0;
        }
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
      SELECT order_number, fulfillment_status, created_at, gift
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

    // What is in the box, by name. NOT what it cost.
    //
    // This link is a capability URL: whoever holds it can read this, and
    // for a gift that is meant to be the recipient. Naming the pieces
    // tells them what they are waiting for, which is the whole point of
    // a page called "your piece, step by step". A price would tell them
    // what somebody spent on them, which is exactly what the gift
    // checkbox exists to prevent — so `unit_price_cents` is not in this
    // query at all, rather than selected and then dropped.
    const items = await sql`
      SELECT product_name, variant_label, quantity
      FROM order_items
      WHERE order_id = ${orderId}
      ORDER BY created_at ASC, id ASC
    `;

    // The card message, and only when this really is a gift. It was
    // written TO the person reading this. Everything else on the gift
    // record — whether prices were hidden, whether it was wrapped — is
    // the buyer's business and Lusik's, not the recipient's.
    const gift = order.gift && order.gift.is_gift === true
      ? { isGift: true, message: typeof order.gift.message === "string" ? order.gift.message.slice(0, 200) : "" }
      : null;

    return new Response(JSON.stringify({
      orderNumber: order.order_number,
      status: order.fulfillment_status,
      placedAt: order.created_at,
      items: (items ?? []).map((i) => ({
        name: i.product_name,
        variant: i.variant_label ?? null,
        qty: Number(i.quantity) || 1,
      })),
      gift,
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
