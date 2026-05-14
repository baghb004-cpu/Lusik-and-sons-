// ============================================================
// /.netlify/functions/link-guest-order
// ============================================================
// POST -> claim any past orders whose customer_email matches the
//         currently-signed-in user's email but whose user_id is
//         NULL (i.e. placed as a guest, then the customer signed
//         up later). Returns { linkedCount }.
//
// Replaces the Supabase `link_guest_order_to_user` RPC.
// ============================================================

import { sql }         from "./_lib/db.mjs";
import { requireUser } from "./_lib/auth.mjs";
import { json }        from "./_lib/json.mjs";

export default async (req, context) => {
  const auth = requireUser(context);
  if (auth.response) return auth.response;
  const { user } = auth;

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  if (!user.email) {
    return json(200, { linkedCount: 0 });
  }

  // Defense in depth: only link if the Identity user's email is
  // verified. The expected Netlify Identity config is "email
  // confirmation required" — but if that ever gets toggled off, an
  // attacker could register with a victim's email and inherit every
  // guest order on that email (including shipping addresses + gift
  // recipient PII). Verifying here makes a config slip benign
  // rather than a data leak.
  //
  // Netlify Identity records the "verified" signal in different
  // places depending on the signup flow — `confirmed_at` is the
  // canonical truth for the password-confirm flow (GoTrue sets it
  // when the customer clicks the confirm link in their email),
  // while OAuth signups land the boolean as `email_verified` at
  // the top level OR inside `app_metadata`. Accept any of the
  // three; treat absence everywhere as unverified.
  const raw = user.raw ?? {};
  const verified =
    !!raw.confirmed_at ||
    raw.email_verified === true ||
    raw.app_metadata?.email_verified === true;
  if (!verified) {
    return json(200, { linkedCount: 0 });
  }

  // Case-insensitive email match — Identity stores email lowercased on
  // most paths, but defensive lowercasing here protects against
  // historical mixed-case rows in `orders`.
  const result = await sql`
    UPDATE orders
       SET user_id = ${user.id}
     WHERE user_id IS NULL
       AND lower(customer_email) = lower(${user.email})
    RETURNING id
  `;
  return json(200, { linkedCount: result.length });
};
