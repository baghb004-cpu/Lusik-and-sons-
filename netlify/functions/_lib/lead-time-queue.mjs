// ============================================================
// _lib/lead-time-queue — the queue half of the lead-time promise
// ============================================================
// Lusik works one piece at a time, so an order placed behind an existing
// queue starts later. This module holds the arithmetic on its own, free
// of any database import, for one reason: the drift unit test can call
// it directly and compare it to the browser's queueBufferDays()
// (src/lib/leadTime.js) for real inputs.
//
// An earlier version inlined this in lead-time.mjs and the test matched
// the source text with a regex — which passed happily when the formula
// itself was mutated. Behaviour is the thing worth testing.
//
// MIRRORS CONFIG.LEAD_TIMES in src/data/config.js. Change both together;
// lead-time-drift.test.mjs fails loudly otherwise.
// ============================================================

export const QUEUE_ENABLED = true;
export const QUEUE_DAYS_PER_OPEN_ORDER = 2;
export const QUEUE_BUFFER_CAP_DAYS = 21;

/** Buffer in days for a number of orders still on the table. */
export function queueDaysFor(openOrders) {
  if (!QUEUE_ENABLED) return 0;
  const n = Number.isFinite(openOrders) && openOrders > 0 ? Math.floor(openOrders) : 0;
  return Math.max(0, Math.min(Math.ceil(n * QUEUE_DAYS_PER_OPEN_ORDER), QUEUE_BUFFER_CAP_DAYS));
}
