// ============================================================
// /.netlify/functions/addresses
// ============================================================
// GET                       -> list this user's saved addresses
// POST  body: { ...address } -> insert a new address
// DELETE ?id=<uuid>         -> delete one of this user's addresses
//
// All three operations gate on user.id matching the row's user_id.
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
      SELECT id, label, recipient, line1, line2, city, state, postal_code,
             country, is_default, created_at
      FROM addresses
      WHERE user_id = ${user.id}
      ORDER BY is_default DESC, created_at DESC
    `;
    return json(200, { addresses: rows });
  }

  if (req.method === "POST") {
    const a = await req.json().catch(() => ({}));
    // Minimal validation — the UI already validates, but never trust it.
    for (const key of ["recipient", "line1", "city", "state", "postal_code"]) {
      if (!a[key] || typeof a[key] !== "string") {
        return json(400, { error: `Missing or invalid field: ${key}` });
      }
    }

    // Length caps. Without these the browser could paste megabytes
    // into any field, bloating the row + every subsequent GET. Caps
    // are generous enough for a real international shipping address.
    const cap = (v, n) => (typeof v === "string" ? v.slice(0, n) : v);
    const label       = cap(a.label,       80);
    const recipient   = cap(a.recipient,  120);
    const line1       = cap(a.line1,      200);
    const line2       = cap(a.line2,      200);
    const city        = cap(a.city,       100);
    const state       = cap(a.state,       80);
    const postalCode  = cap(a.postal_code, 20);
    const country     = cap((typeof a.country === "string" && a.country.trim()) || "US", 3);
    const isDefault   = !!a.is_default;

    // If this address is being marked default, clear is_default on
    // any other rows for the same user first. Without this mutual
    // exclusion the UI shows two "default" rows and the GET ordering
    // (`is_default DESC, created_at DESC`) picks arbitrarily.
    if (isDefault) {
      await sql`
        UPDATE addresses SET is_default = false
         WHERE user_id = ${user.id} AND is_default = true
      `;
    }

    const rows = await sql`
      INSERT INTO addresses (
        user_id, label, recipient, line1, line2, city, state, postal_code, country, is_default
      ) VALUES (
        ${user.id},
        ${label ?? null},
        ${recipient},
        ${line1},
        ${line2 ?? null},
        ${city},
        ${state},
        ${postalCode},
        ${country},
        ${isDefault}
      )
      RETURNING id, label, recipient, line1, line2, city, state, postal_code,
                country, is_default, created_at
    `;
    return json(201, { address: rows[0] });
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return json(400, { error: "Missing id" });
    // Filter by user_id so a user can only delete their OWN addresses.
    await sql`DELETE FROM addresses WHERE id = ${id} AND user_id = ${user.id}`;
    return json(200, { ok: true });
  }

  return json(405, { error: "Method not allowed" });
};
