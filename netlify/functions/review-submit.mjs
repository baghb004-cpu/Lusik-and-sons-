// ============================================================
// /.netlify/functions/review-submit
// ============================================================
// GET  ?id=<order id>&t=<token> → { orderNumber, items, review | null }
// POST { id, t, rating, body, displayName, photoConsent, photo }
//
// Both are gated by the HMAC review token from the post-delivery email,
// which is a capability for ONE order and has its own purpose prefix, so
// a token minted to watch an order's timeline cannot post a review and
// vice versa (see _lib/order-tokens.mjs).
//
// What this deliberately does NOT do:
//
//   - It never publishes. A submitted review is `pending`; the public
//     read filters on `approved`, and only Lusik moves it. A public
//     write that appears immediately is a page anybody with an order
//     number can graffiti.
//   - It never trusts the product key from the body. The pieces are
//     read from order_items, so a review can only ever attach to
//     something that order actually contained.
//   - It never takes a photograph without an explicit yes. `photo` is
//     stored only when photoConsent is true, and consent is a separate
//     column from status so approving the words never publishes the
//     picture.
//
// A second submission from the same link REPLACES the first. Somebody
// who thought better of what they wrote at 11pm should be able to fix
// it, and the UNIQUE(order_id) constraint makes that the natural shape.
// ============================================================

import { getStore } from "@netlify/blobs";
import { sql }  from "./_lib/db.mjs";
import { json } from "./_lib/json.mjs";
import { verifyReviewToken } from "./_lib/order-tokens.mjs";
import { sniffImageType } from "./_lib/image-sniff.mjs";
import { ipFromRequest, checkRateLimit } from "./_lib/rate-limit.mjs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_CHARS = 1200;
const MAX_NAME_CHARS = 60;
// 4 MB of base64 is about 3 MB of image. A phone photograph resized by
// the browser lands well under this; anything above it is a mistake or
// an attempt to fill a blob store.
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
// Per-IP daily cap. A real customer submits once, maybe twice if they
// edit. This only stops somebody hammering the endpoint with guesses.
const MAX_SUBMITS_PER_IP_PER_DAY = 30;

const PHOTO_STORE = "review-photos";
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const EXT_FOR = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Reject anything that is not a token-carrying request for one order. */
function credentials(url) {
  const orderId = (url.searchParams.get("id") || "").trim();
  const token = (url.searchParams.get("t") || "").trim();
  if (!UUID_RE.test(orderId)) return null;
  if (!verifyReviewToken(orderId, token)) return null;
  return { orderId };
}

export default async (req, context) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const creds = credentials(url);
    // The same answer for a bad token and an unknown order: a different
    // one turns this into an oracle for which order ids exist.
    if (!creds) return json(404, { error: "Not found" });

    try {
      const orders = await sql`
        SELECT order_number FROM orders WHERE id = ${creds.orderId} LIMIT 1
      `;
      if (!orders?.[0]) return json(404, { error: "Not found" });

      const items = await sql`
        SELECT product_key, product_name
          FROM order_items
         WHERE order_id = ${creds.orderId}
         ORDER BY created_at ASC, id ASC
      `;
      const existing = await sql`
        SELECT rating, body, display_name, photo_consent, status
          FROM reviews WHERE order_id = ${creds.orderId} LIMIT 1
      `;

      return new Response(JSON.stringify({
        orderNumber: orders[0].order_number,
        items: (items ?? []).map((i) => ({ key: i.product_key, name: i.product_name })),
        review: existing?.[0]
          ? {
            rating: existing[0].rating,
            body: existing[0].body ?? "",
            displayName: existing[0].display_name ?? "",
            photoConsent: existing[0].photo_consent === true,
            status: existing[0].status,
          }
          : null,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
      });
    } catch (err) {
      console.error("review-submit read failed:", err?.message || err);
      return json(500, { error: "Could not load that order" });
    }
  }

  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const orderId = String(payload?.id ?? "").trim();
  const token = String(payload?.t ?? "").trim();
  if (!UUID_RE.test(orderId) || !verifyReviewToken(orderId, token)) {
    return json(404, { error: "Not found" });
  }

  const ip = ipFromRequest(req, context);
  const allowed = await checkRateLimit({ bucket: "review-submit", ip, limit: MAX_SUBMITS_PER_IP_PER_DAY });
  if (!allowed) return json(429, { error: "Too many submissions today" });

  const rating = Math.floor(Number(payload?.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return json(400, { error: "rating must be 1 to 5" });
  }
  const body = typeof payload?.body === "string" ? payload.body.trim().slice(0, MAX_BODY_CHARS) : "";
  const displayName = typeof payload?.displayName === "string"
    ? payload.displayName.trim().slice(0, MAX_NAME_CHARS)
    : "";
  const photoConsent = payload?.photoConsent === true;

  try {
    // The product a review is about comes from the ORDER, never from the
    // body. Otherwise a valid token for a bib order could post a review
    // onto the blanket's page.
    const items = await sql`
      SELECT product_key FROM order_items WHERE order_id = ${orderId} ORDER BY created_at ASC, id ASC LIMIT 1
    `;
    if (!items?.[0]) return json(404, { error: "Not found" });
    const productKey = items[0].product_key;

    // The photograph, only with an explicit yes. Sniffed by magic bytes
    // rather than trusted by its data-URL prefix, the same way avatars
    // are: a declared content type is a claim, not a fact.
    let photoKey = null;
    if (photoConsent && typeof payload?.photo === "string" && payload.photo.startsWith("data:image/")) {
      const base64 = payload.photo.slice(payload.photo.indexOf(",") + 1);
      const buf = Buffer.from(base64, "base64");
      if (buf.length > MAX_PHOTO_BYTES) return json(413, { error: "That photo is too large" });
      // sniffImageType returns the real MIME from the magic bytes, or
      // null. The data-URL prefix is a claim; this is the fact.
      const mime = sniffImageType(buf);
      if (!mime || !ALLOWED_TYPES.has(mime)) {
        return json(400, { error: "That file is not an image we can read" });
      }
      photoKey = `${orderId}/review-${Date.now()}.${EXT_FOR[mime]}`;
      try {
        const store = getStore(PHOTO_STORE);
        await store.set(photoKey, buf, { metadata: { contentType: mime } });
      } catch (err) {
        // A blob outage must not lose the words. The review is still
        // worth having without the picture.
        console.warn("[review-submit] photo store failed:", err?.message || err);
        photoKey = null;
      }
    }

    // Replace rather than stack: one review per order, and somebody who
    // thought better of what they wrote can say so.
    await sql`
      INSERT INTO reviews (order_id, product_key, rating, body, display_name, photo_key, photo_consent, status)
      VALUES (${orderId}, ${productKey}, ${rating}, ${body || null}, ${displayName || null},
              ${photoKey}, ${photoConsent}, 'pending')
      ON CONFLICT (order_id) DO UPDATE SET
        product_key   = EXCLUDED.product_key,
        rating        = EXCLUDED.rating,
        body          = EXCLUDED.body,
        display_name  = EXCLUDED.display_name,
        -- Keep an earlier photograph when this submission has none, so
        -- fixing a typo does not silently drop the picture.
        photo_key     = COALESCE(EXCLUDED.photo_key, reviews.photo_key),
        photo_consent = EXCLUDED.photo_consent,
        -- An edited review goes back to pending. Anything else would let
        -- an approved review be rewritten into something else.
        status        = 'pending',
        reviewed_at   = NULL,
        created_at    = now()
    `;

    return json(200, { ok: true, status: "pending" });
  } catch (err) {
    console.error("review-submit write failed:", err?.message || err);
    return json(500, { error: "Could not save that just now" });
  }
};
