// ============================================================
// /.netlify/functions/order-photo-get
// ============================================================
// GET ?key=<blob-key> → streams the finished-piece photo back.
//
// Authorization model: any signed-in user whose own order
// matches the blob's parent folder (the key prefix is the order
// UUID) can view it. Guest viewing isn't allowed since order
// IDs aren't intended to be shareable.
//
// We deliberately don't require an admin role here — customers
// need to see their OWN finished photos in their account.
// ============================================================

import { getStore }     from "@netlify/blobs";
import { sql }          from "./_lib/db.mjs";
import { requireUser }  from "./_lib/auth.mjs";
import { json }         from "./_lib/json.mjs";

const STORE_NAME = "order-finished-photos";

export default async (req, context) => {
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });

  const auth = requireUser(req, context);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key) return json(400, { error: "Missing key" });

  // Key format: "<order_id>/finished-<ts>.<ext>". The owning
  // order must belong to the requesting user, OR the user must
  // be an admin. Admins can view any photo (Lusik reviewing her
  // own work shouldn't be blocked).
  const orderId = key.split("/")[0];
  // UUID-shape gate before the SQL lookup so attacker-controlled
  // path segments (".." etc.) can't reach the query.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId || "")) {
    return json(400, { error: "Malformed key" });
  }

  // Admin check uses the same logic as requireAdmin() in _lib/auth.mjs —
  // role on the JWT OR the ADMIN_EMAILS env fallback. Previously this
  // function honored only the role, which would 403 admins still
  // relying on the pre-role-assignment escape hatch.
  const envAdminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = (auth.user.roles?.includes("admin"))
              || (auth.user.email && envAdminEmails.includes(auth.user.email.toLowerCase()));
  if (!isAdmin) {
    const rows = await sql`SELECT user_id FROM orders WHERE id = ${orderId} LIMIT 1`;
    if (rows.length === 0)            return json(404, { error: "Not found" });
    if (rows[0].user_id !== auth.user.id) return json(403, { error: "Not yours" });
  }

  const store = getStore({ name: STORE_NAME });
  const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
  if (!result) return json(404, { error: "Not found" });

  const contentType = result.metadata?.contentType ?? "application/octet-stream";
  return new Response(result.data, {
    status: 200,
    headers: {
      "Content-Type":          contentType,
      "Cache-Control":         "private, max-age=3600",
      // Browser must honor the declared Content-Type and not infer
      // anything richer from the bytes — defense against a future
      // upload path that accepts a wider type set.
      "X-Content-Type-Options": "nosniff",
    },
  });
};
