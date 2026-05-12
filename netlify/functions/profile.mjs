// ============================================================
// /.netlify/functions/profile
// ============================================================
// GET  -> returns the signed-in user's profile row, creating an
//         empty one on first sign-in (lazy upsert).
// PUT  -> updates whitelisted profile fields. Email is not editable
//         here — that's an Identity-side change.
// ============================================================

import { sql }          from "./_lib/db.mjs";
import { requireUser }  from "./_lib/auth.mjs";
import { json }         from "./_lib/json.mjs";

export default async (req, context) => {
  const auth = requireUser(context);
  if (auth.response) return auth.response;
  const { user } = auth;

  if (req.method === "GET") {
    // First read; if the row doesn't exist yet (brand-new signup), create
    // it from Identity-side metadata. This replaces the old Supabase
    // handle_new_user trigger.
    let rows = await sql`
      SELECT id, email, full_name, phone, avatar_url, created_at, updated_at
      FROM profiles
      WHERE id = ${user.id}
    `;

    if (rows.length === 0) {
      rows = await sql`
        INSERT INTO profiles (id, email, full_name, phone)
        VALUES (${user.id}, ${user.email}, ${user.fullName}, ${user.phone})
        ON CONFLICT (id) DO NOTHING
        RETURNING id, email, full_name, phone, avatar_url, created_at, updated_at
      `;
      // If the INSERT raced and conflicted, re-read.
      if (rows.length === 0) {
        rows = await sql`
          SELECT id, email, full_name, phone, avatar_url, created_at, updated_at
          FROM profiles WHERE id = ${user.id}
        `;
      }
    }
    return json(200, { profile: rows[0] ?? null });
  }

  if (req.method === "PUT") {
    const body = await req.json().catch(() => ({}));
    // Whitelist: never trust the client to set id, email, created_at.
    const fullName  = typeof body.full_name === "string" ? body.full_name : null;
    const phone     = typeof body.phone === "string" ? body.phone : null;
    const avatarUrl = typeof body.avatar_url === "string" ? body.avatar_url : null;

    const rows = await sql`
      UPDATE profiles
      SET full_name  = COALESCE(${fullName},  full_name),
          phone      = COALESCE(${phone},     phone),
          avatar_url = COALESCE(${avatarUrl}, avatar_url),
          updated_at = now()
      WHERE id = ${user.id}
      RETURNING id, email, full_name, phone, avatar_url, created_at, updated_at
    `;
    return json(200, { profile: rows[0] ?? null });
  }

  return json(405, { error: "Method not allowed" });
};
