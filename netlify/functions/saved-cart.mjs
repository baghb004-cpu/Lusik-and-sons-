// ============================================================
// /.netlify/functions/saved-cart
// ============================================================
// GET -> { cart: [...] | null }
// PUT body: { cart: [...] } -> upsert (one row per user)
//
// The cart is stored as JSONB so its shape can change with the UI
// without DDL. Replaces the old Supabase saved_carts table.
// ============================================================

import { sql }         from "./_lib/db.mjs";
import { requireUser } from "./_lib/auth.mjs";
import { json }        from "./_lib/json.mjs";

export default async (req, context) => {
  const auth = await requireUser(req, context);
  if (auth.response) return auth.response;
  const { user } = auth;

  if (req.method === "GET") {
    const rows = await sql`
      SELECT cart_data FROM saved_carts WHERE user_id = ${user.id}
    `;
    return json(200, { cart: rows[0]?.cart_data ?? null });
  }

  if (req.method === "PUT") {
    const body = await req.json().catch(() => ({}));
    if (!Array.isArray(body.cart)) {
      return json(400, { error: "Body must be { cart: [...] }" });
    }
    // Minimal shape check on each row. The cart can hold many fields
    // (image paths, custom metadata, etc.) so we don't validate every
    // key — but `id`, `qty`, and `name` are the load-bearing ones the
    // browser reads back unconditionally. Reject obviously malformed
    // entries so a hand-crafted PUT can't poison a saved cart.
    if (body.cart.length > 50) {
      return json(400, { error: "Cart has too many items (max 50)" });
    }
    for (const item of body.cart) {
      if (!item || typeof item !== "object") {
        return json(400, { error: "Cart entries must be objects" });
      }
      if (typeof item.id !== "string" || item.id.length === 0 || item.id.length > 500) {
        return json(400, { error: "Cart entry missing valid id" });
      }
      if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) {
        return json(400, { error: "Cart entry qty must be an integer 1-99" });
      }
      if (typeof item.name !== "string" || item.name.length > 500) {
        return json(400, { error: "Cart entry missing valid name" });
      }
    }
    // Soft cap on payload size. JSONB can theoretically hold a lot but
    // base64 product images in the cart can balloon — refuse anything
    // egregiously large so a runaway cart doesn't fill the DB row by row.
    const asJson = JSON.stringify(body.cart);
    if (asJson.length > 1_000_000) {
      return json(413, { error: "Cart payload too large (>1MB)" });
    }
    await sql`
      INSERT INTO saved_carts (user_id, cart_data, updated_at)
      VALUES (${user.id}, ${asJson}::jsonb, now())
      ON CONFLICT (user_id)
      DO UPDATE SET cart_data = EXCLUDED.cart_data, updated_at = now()
    `;
    return json(200, { ok: true });
  }

  return json(405, { error: "Method not allowed" });
};
