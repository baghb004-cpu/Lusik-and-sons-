// ============================================================
// /.netlify/functions/lead-time
// ============================================================
// GET → the current queue buffer, in days, for the whole shop:
//   { openOrders: 3, queueDays: 6 }
//
// Lusik works one piece at a time, so an order placed behind an
// existing queue starts later than one placed on a quiet week. The
// browser adds this buffer to the product's own build time
// (src/lib/leadTime.js) before it quotes a start and ship date.
//
// DISPLAY aid only — nothing here gates a checkout or changes a price.
// Fail-soft: on any DB error we return a zero buffer (HTTP 200) so the
// page still quotes the product's own time rather than breaking.
//
// The number of days per open order and the ceiling are dials in
// CONFIG.LEAD_TIMES; this endpoint only reports the raw count and the
// derived buffer so a stale browser bundle can still do its own math.
// ============================================================

import { sql }  from "./_lib/db.mjs";
import { json } from "./_lib/json.mjs";

// Mirrors CONFIG.LEAD_TIMES (src/data/config.js); the lead-time drift
// unit test keeps the two in lockstep, same pattern as pricing.
const QUEUE_DAYS_PER_OPEN_ORDER = 2;
const QUEUE_BUFFER_CAP_DAYS = 21;

export default async (req) => {
  if (req.method !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    // Work still on Lusik's table: paid, not yet shipped, not refunded
    // or cancelled. `fulfillment_status` is the physical-work column.
    const rows = await sql`
      SELECT COUNT(*)::int AS open_orders
      FROM orders
      WHERE status NOT IN ('refunded', 'cancelled')
        AND fulfillment_status NOT IN ('shipped', 'delivered', 'cancelled')
    `;
    const openOrders = Number(rows?.[0]?.open_orders) || 0;
    const queueDays = Math.max(
      0,
      Math.min(Math.ceil(openOrders * QUEUE_DAYS_PER_OPEN_ORDER), QUEUE_BUFFER_CAP_DAYS),
    );

    return new Response(JSON.stringify({ openOrders, queueDays }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // The queue moves when an order lands or ships; ten minutes of
        // staleness cannot mislead anyone by more than a day.
        "Cache-Control": "public, max-age=600, stale-while-revalidate=1800",
      },
    });
  } catch (err) {
    console.error("lead-time queue read failed (returning zero buffer):", err?.message || err);
    return json(200, { openOrders: 0, queueDays: 0 });
  }
};
