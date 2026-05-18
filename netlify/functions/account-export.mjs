// ============================================================
// /.netlify/functions/account-export
// ============================================================
// Right to portability (CCPA/CPRA, GDPR) — downloadable JSON of
// everything we have about the signed-in user. Customer hits
// the "Download my data" button in their account view, gets a
// JSON file they can keep, audit, or send to a privacy officer.
//
// What's included:
//   - Profile row (name, email, phone, avatar URL, saved
//     designs)
//   - All saved addresses
//   - Saved cart (the JSONB blob)
//   - All orders + their line items + design metadata
//
// What's deliberately NOT included:
//   - The Identity record itself (we don't have admin access
//     from here to read other users' records, and the IDs +
//     timestamps are already in the profile row)
//   - Stripe payment-method tokens (Stripe owns those; the
//     customer can pull them from Stripe's customer portal if
//     they ever want)
//   - Admin notes Lusik wrote internally (those are Lusik's
//     business records, not the customer's data — flagged in
//     the Privacy Policy disclosure)
// ============================================================

import { sql }         from "./_lib/db.mjs";
import { requireUser } from "./_lib/auth.mjs";
import { json }        from "./_lib/json.mjs";

export default async (req, context) => {
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });

  const auth = requireUser(req, context);
  if (auth.response) return auth.response;
  const { user } = auth;

  // Gather everything in parallel — independent reads, no FK
  // dependencies between them.
  const [profileRows, addresses, cartRows, orderRows] = await Promise.all([
    sql`
      SELECT id, email, full_name, phone, avatar_url, saved_designs,
             created_at, updated_at
      FROM profiles WHERE id = ${user.id}
    `,
    sql`
      SELECT id, label, recipient, line1, line2, city, state, postal_code,
             country, is_default, created_at
      FROM addresses WHERE user_id = ${user.id}
      ORDER BY is_default DESC, created_at DESC
    `,
    sql`SELECT cart_data, updated_at FROM saved_carts WHERE user_id = ${user.id}`,
    sql`
      SELECT
        o.id, o.order_number, o.status, o.fulfillment_status,
        o.subtotal_cents, o.shipping_cents, o.tax_cents, o.total_cents,
        o.shipping_address, o.carrier, o.tracking_number,
        o.estimated_ship_date, o.shipped_at, o.gift, o.social_consent,
        o.created_at,
        COALESCE(
          (SELECT json_agg(json_build_object(
             'product_name',     oi.product_name,
             'variant_label',    oi.variant_label,
             'quantity',         oi.quantity,
             'unit_price_cents', oi.unit_price_cents,
             'is_custom',        oi.is_custom,
             'custom_metadata',  oi.custom_metadata
           ) ORDER BY oi.created_at)
           FROM order_items oi WHERE oi.order_id = o.id),
          '[]'::json
        ) AS items
      FROM orders o
      WHERE o.user_id = ${user.id}
      ORDER BY o.created_at DESC
    `,
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    note: "This is a complete export of personal data Lusik & Sons holds about you. Admin notes Lusik wrote internally on past orders are not included here; email hello@lusikandsons.com to request a copy of those if you'd like.",
    identity: {
      id:    user.id,
      email: user.email,
    },
    profile:   profileRows[0] ?? null,
    addresses,
    saved_cart: cartRows[0]?.cart_data ?? null,
    orders:     orderRows,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type":        "application/json",
      "Content-Disposition": `attachment; filename="lusikandsons-data-${user.id}-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control":       "no-store",
    },
  });
};
