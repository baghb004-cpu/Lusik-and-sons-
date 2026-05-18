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
  const auth = requireUser(req, context);
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
    // Build the entry. We don't know its position in the array yet
    // because the label fallback uses current.length + 1 — so peek
    // once to get a sensible default; if the actual UPDATE finds a
    // different length it doesn't matter for the label (the customer
    // can rename in the UI).
    const peek = await sql`
      SELECT COALESCE(jsonb_array_length(saved_designs), 0) AS len
        FROM profiles WHERE id = ${user.id}
    `;
    const peekLen = peek[0]?.len ?? 0;
    const entry = {
      id:         makeId(),
      label:      label || `Design ${peekLen + 1}`,
      design,
      created_at: new Date().toISOString(),
    };
    // Atomic insert: the WHERE clause checks the cap inside the same
    // statement as the prepend, so two browser tabs racing Save can
    // never both succeed past the limit. The previous read-then-write
    // pattern had a tiny but real window where T1 and T2 both read
    // count=19, both wrote, and the array briefly held 21 entries
    // (or one of them silently overwrote the other).
    //
    // The `||` jsonb concat operator prepends our entry to the
    // existing array; we coalesce NULL → '[]' for first-time savers.
    const inserted = await sql`
      UPDATE profiles
         SET saved_designs = ${JSON.stringify(entry)}::jsonb
                          || COALESCE(saved_designs, '[]'::jsonb),
             updated_at = now()
       WHERE id = ${user.id}
         AND COALESCE(jsonb_array_length(saved_designs), 0) < ${MAX_DESIGNS}
       RETURNING saved_designs
    `;
    if (inserted.length === 0) {
      // Either the cap is hit, or the profile row doesn't exist
      // (which shouldn't happen — the upsert above ensures it does).
      return json(409, {
        error: `You can save up to ${MAX_DESIGNS} designs. Delete one to save another.`,
      });
    }
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
