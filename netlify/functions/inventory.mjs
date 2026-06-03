// ============================================================
// /.netlify/functions/inventory
// ============================================================
// GET → public availability snapshot for every live product group:
//   { inventory: { "<group>": { remaining, limit, soldOut }, ... } }
//
// Drives the browser's sold-out states and quantity caps. This is a
// DISPLAY aid only — the authoritative overselling guard lives in
// create-checkout-session (server-side), so a stale or failed read
// here can never let a customer actually oversell.
//
// Fail-soft: on any DB error we return an empty map (HTTP 200) so
// product pages render as "available" rather than breaking. The
// checkout-time check still protects against overselling.
// ============================================================

import { sql }  from "./_lib/db.mjs";
import { json } from "./_lib/json.mjs";
import { availabilitySnapshot } from "./_lib/inventory.mjs";

export default async (req) => {
  if (req.method !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const inventory = await availabilitySnapshot(sql);
    return new Response(JSON.stringify({ inventory }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Short cache: availability changes only when an order lands,
        // and a few seconds of staleness is harmless (the checkout
        // guard is authoritative). Keeps product pages snappy.
        "Cache-Control": "public, max-age=15, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("inventory snapshot failed (returning empty):", err?.message || err);
    return json(200, { inventory: {} });
  }
};
