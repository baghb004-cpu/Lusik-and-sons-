// ============================================================
// /.netlify/functions/saved-designs
// ============================================================
// Customer-side "design library". Each customer can save up to
// MAX_DESIGNS configurations from the blanket picker and load
// them later. Stored as a JSONB array on profiles.saved_designs
// rather than its own table — the cardinality is bounded per
// user and the access pattern is "load all then operate," so a
// separate table would be overkill.
//
//   GET    /saved-designs           -> { designs: [...] }
//   POST   /saved-designs           -> { design: {...} }   body { label, design }
//   DELETE /saved-designs?id=<uuid> -> { ok: true }
//
// Each design entry shape:
//   { id, label, design (the compact picker state object), created_at }
// ============================================================

import { sql }         from "./_lib/db.mjs";
import { requireUser } from "./_lib/auth.mjs";
import { json }        from "./_lib/json.mjs";

const MAX_DESIGNS         = 20;
const MAX_LABEL_LENGTH    = 48;
const MAX_DESIGN_BYTES    = 2_000;  // JSON-serialized; ample for the picker state

function makeId() {
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default async (req, context) => {
  const auth = requireUser(context);
  if (auth.response) return auth.response;
  const { user } = auth;

  // Ensure a profiles row exists for this user so the JSONB
  // reads/writes have something to talk to. Idempotent.
  await sql`
    INSERT INTO profiles (id, email)
    VALUES (${user.id}, ${user.email})
    ON CONFLICT (id) DO NOTHING
  `;

  if (req.method === "GET") {
    const rows = await sql`
      SELECT saved_designs FROM profiles WHERE id = ${user.id}
    `;
    return json(200, { designs: rows[0]?.saved_designs ?? [] });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const label  = typeof body.label === "string" ? body.label.trim().slice(0, MAX_LABEL_LENGTH) : "";
    const design = body.design;
    if (!design || typeof design !== "object") {
      return json(400, { error: "Missing or invalid `design` object" });
    }
    const serialized = JSON.stringify(design);
    if (serialized.length > MAX_DESIGN_BYTES) {
      return json(413, { error: "Design payload too large" });
    }
    // Read-modify-write. Concurrent saves from the same user
    // are vanishingly rare, so we don't need row-level locking.
    const existing = await sql`SELECT saved_designs FROM profiles WHERE id = ${user.id}`;
    const current = Array.isArray(existing[0]?.saved_designs) ? existing[0].saved_designs : [];
    if (current.length >= MAX_DESIGNS) {
      return json(409, {
        error: `You can save up to ${MAX_DESIGNS} designs. Delete one to save another.`,
      });
    }
    const entry = {
      id:         makeId(),
      label:      label || `Design ${current.length + 1}`,
      design,
      created_at: new Date().toISOString(),
    };
    const next = [entry, ...current];
    await sql`
      UPDATE profiles
         SET saved_designs = ${JSON.stringify(next)}::jsonb,
             updated_at = now()
       WHERE id = ${user.id}
    `;
    return json(201, { design: entry });
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id  = url.searchParams.get("id");
    if (!id) return json(400, { error: "Missing id" });
    const existing = await sql`SELECT saved_designs FROM profiles WHERE id = ${user.id}`;
    const current = Array.isArray(existing[0]?.saved_designs) ? existing[0].saved_designs : [];
    const next = current.filter((d) => d.id !== id);
    await sql`
      UPDATE profiles
         SET saved_designs = ${JSON.stringify(next)}::jsonb,
             updated_at = now()
       WHERE id = ${user.id}
    `;
    return json(200, { ok: true });
  }

  return json(405, { error: "Method not allowed" });
};
