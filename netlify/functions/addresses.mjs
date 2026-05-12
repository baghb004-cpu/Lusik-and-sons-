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
  const auth = requireUser(context);
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
    const country = (typeof a.country === "string" && a.country.trim()) || "US";

    const rows = await sql`
      INSERT INTO addresses (
        user_id, label, recipient, line1, line2, city, state, postal_code, country, is_default
      ) VALUES (
        ${user.id},
        ${a.label ?? null},
        ${a.recipient},
        ${a.line1},
        ${a.line2 ?? null},
        ${a.city},
        ${a.state},
        ${a.postal_code},
        ${country},
        ${!!a.is_default}
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
