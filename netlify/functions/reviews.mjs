// ============================================================
// /.netlify/functions/reviews
// ============================================================
// GET ?product=<key>   → { reviews: [...] }  approved reviews for one piece
// GET ?wall=1          → { reviews: [...] }  the "Made for" wall
//
// Public and cacheable. The two shapes are deliberately different reads
// of the same table:
//
//   - the PRODUCT read filters on status='approved' and returns the
//     words. A photograph only comes with it when photo_consent is true.
//   - the WALL read filters on status='approved' AND photo_consent AND a
//     photograph. Somebody can be happy for their words to appear and
//     not a picture of their child, and the two flags exist so that
//     approving one never publishes the other.
//
// Nothing identifying is returned: no order number, no email, no order
// id. `display_name` is whatever the customer chose to be called, and it
// is optional.
// ============================================================

import { sql }  from "./_lib/db.mjs";
import { json } from "./_lib/json.mjs";

const PRODUCT_KEY_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const MAX_ROWS = 24;

function shape(row, { withPhoto }) {
  return {
    rating: Number(row.rating),
    body: row.body ?? "",
    name: row.display_name ?? "",
    at: row.created_at,
    productKey: row.product_key,
    // The photo key, never a URL: the browser fetches it through
    // review-photo-get, which is the only thing that touches the store.
    photoKey: withPhoto ? (row.photo_key ?? null) : null,
  };
}

export default async (req) => {
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });

  const url = new URL(req.url);
  const wall = url.searchParams.get("wall") === "1";
  const product = (url.searchParams.get("product") || "").trim();

  try {
    let rows;
    if (wall) {
      rows = await sql`
        SELECT rating, body, display_name, created_at, product_key, photo_key
          FROM reviews
         WHERE status = 'approved' AND photo_consent = true AND photo_key IS NOT NULL
         ORDER BY created_at DESC
         LIMIT ${MAX_ROWS}
      `;
    } else {
      // A missing or malformed key returns an empty list rather than an
      // error: this read is decoration on a product page, and a product
      // page must never fail because a review query did.
      if (!PRODUCT_KEY_PATTERN.test(product)) return json(200, { reviews: [] });
      rows = await sql`
        SELECT rating, body, display_name, created_at, product_key, photo_key, photo_consent
          FROM reviews
         WHERE status = 'approved' AND product_key = ${product}
         ORDER BY created_at DESC
         LIMIT ${MAX_ROWS}
      `;
    }

    const reviews = (rows ?? []).map((r) => shape(r, {
      withPhoto: wall ? true : r.photo_consent === true,
    }));

    return new Response(JSON.stringify({ reviews }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Public and slow-moving. Five minutes keeps a product page off
        // the database on a busy day without holding a newly approved
        // review back for long.
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    console.error("reviews read failed:", err?.message || err);
    // Same reasoning as the malformed key: never take a product page
    // down over its testimonials.
    return json(200, { reviews: [] });
  }
};
