// ============================================================
// /.netlify/functions/review-photo-get
// ============================================================
// GET ?key=<blob-key> → streams a review photograph back.
//
// PUBLIC, and that is the whole point of the gate below: a photograph
// only leaves this endpoint when its review is BOTH approved by Lusik
// AND carries the customer's explicit photo consent. Consent alone is
// not enough, approval alone is not enough.
//
// The check is a database read on every request rather than a guess
// from the key, because consent is something a person can change their
// mind about: hiding a review or clearing its consent has to make the
// photograph stop being served, immediately, without touching the blob.
// ============================================================

import { getStore } from "@netlify/blobs";
import { sql }      from "./_lib/db.mjs";
import { json }     from "./_lib/json.mjs";

const STORE_NAME = "review-photos";
// Keys are minted server-side as "<order uuid>/review-<ts>.<ext>". A key
// that does not look like one never reaches the store.
const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/review-\d+\.(png|jpg|webp)$/i;

export default async (req) => {
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });

  const url = new URL(req.url);
  const key = url.searchParams.get("key") || "";
  if (!KEY_PATTERN.test(key)) return json(400, { error: "Malformed key" });

  try {
    // Approved AND consented, checked live. Matching on the key rather
    // than the order id means a stale key from an earlier submission
    // stops resolving the moment a newer photograph replaces it.
    const rows = await sql`
      SELECT 1 FROM reviews
       WHERE photo_key = ${key}
         AND status = 'approved'
         AND photo_consent = true
       LIMIT 1
    `;
    if (!rows?.[0]) return json(404, { error: "Not found" });

    const store = getStore({ name: STORE_NAME });
    const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
    if (!result) return json(404, { error: "Not found" });

    return new Response(result.data, {
      status: 200,
      headers: {
        "Content-Type": result.metadata?.contentType ?? "application/octet-stream",
        // Public, but short: consent can be withdrawn, and a long cache
        // would keep serving a photograph after somebody asked us to
        // stop.
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("review-photo-get failed:", err?.message || err);
    return json(404, { error: "Not found" });
  }
};
