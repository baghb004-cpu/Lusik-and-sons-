// ============================================================
// /.netlify/functions/admin-order-photo
// ============================================================
// Lusik uploads a "finished-piece" photo for a specific order.
// The customer then sees it on their OrderCard forever — a small
// digital keepsake of the blanket made for them.
//
//   POST  body: { orderId, filename, contentType, dataBase64 }
//         → stores the file in Netlify Blobs and stamps the
//           orders.finished_photo_key column with the new key.
//
// Auth: requireAdmin. Same allowed image types + size caps as the
// customer avatar upload, applied here so the orders table doesn't
// grow blob references to unexpected formats.
// ============================================================

import { getStore }      from "@netlify/blobs";
import { sql }           from "./_lib/db.mjs";
import { requireAdmin }  from "./_lib/auth.mjs";
import { json }          from "./_lib/json.mjs";

const MAX_BYTES     = 8 * 1024 * 1024;  // 8 MB — Lusik's phone photos can be chunky
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_EXTS  = new Set(["png", "jpg", "jpeg", "webp"]);
const STORE_NAME    = "order-finished-photos";

export default async (req, context) => {
  const auth = requireAdmin(context);
  if (auth.response) return auth.response;

  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const body = await req.json().catch(() => ({}));
  const { orderId, filename, contentType, dataBase64 } = body ?? {};

  if (!orderId)                  return json(400, { error: "Missing orderId" });
  if (!filename || !contentType || !dataBase64) {
    return json(400, { error: "Need filename, contentType, dataBase64" });
  }
  if (!ALLOWED_TYPES.has(contentType)) {
    return json(415, { error: "Unsupported image type" });
  }
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    return json(400, { error: "Unsupported file extension" });
  }

  // Verify the order exists before writing.
  const existing = await sql`SELECT id FROM orders WHERE id = ${orderId} LIMIT 1`;
  if (existing.length === 0) return json(404, { error: "Order not found" });

  let bytes;
  try { bytes = Buffer.from(dataBase64, "base64"); }
  catch { return json(400, { error: "Invalid base64" }); }
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    return json(413, { error: `Image must be 1 byte – ${MAX_BYTES} bytes` });
  }

  // Key pattern: <order_id>/finished-<timestamp>.<ext>
  // Folder-by-order keeps the namespace tidy and lets us
  // (eventually) store multiple shots per order without name
  // collisions.
  const key = `${orderId}/finished-${Date.now()}.${ext}`;
  const store = getStore({ name: STORE_NAME, consistency: "strong" });
  await store.set(key, bytes, {
    metadata: { contentType, uploadedAt: new Date().toISOString(), uploaderEmail: auth.user.email ?? "unknown" },
  });

  // Stamp the key on the order so the customer's OrderCard can
  // load it. Only the most recent photo per order is shown — the
  // previous blob (if any) is left in storage for now; Netlify
  // Blobs are cheap and an audit trail of finished photos is
  // useful if Lusik ever wants to look back.
  await sql`UPDATE orders SET finished_photo_key = ${key} WHERE id = ${orderId}`;

  const url = `/.netlify/functions/order-photo-get?key=${encodeURIComponent(key)}`;
  return json(201, { url, key });
};
