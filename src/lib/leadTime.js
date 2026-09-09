// ============================================================
// leadTime — how long a piece really takes, per product
// ============================================================
// Replaces the old flat "5 to 10 business days" constant with the
// owner's real, per-product lead times (SITE_OVERHAUL_HANDOFF.md, PR 9).
// These are the same numbers printed in the delivery brochure under
// print/ — the site and the box must say the same thing.
//
// Two parts add up to the promise a customer sees:
//
//   1. The product's own build time, in weeks (CONFIG.LEAD_TIMES.WEEKS).
//      A seven-bib hand-stitched set is not a two-week job.
//   2. A queue buffer: Lusik works one piece at a time, so an order
//      placed behind five open orders starts later. The /lead-time
//      Function counts the open queue and returns the buffer in days;
//      when it is unavailable the buffer is simply 0 and the customer
//      sees the product's own time.
//
// Then transit on top, which is ordinary ground shipping.
//
// Plain JavaScript on purpose: the Node unit test imports this module
// directly (CI runs Node 20, which cannot load .ts), the same reason
// src/lib/capabilityTier.js is .js. Keep it free of DOM access.
//
// DELIBERATELY NOT SAID ANYWHERE IN THE UI: *why* the lead times are
// what they are. The copy states the time and offers a phone call for
// a specific date. That is the owner's rule.
// ============================================================

import { CONFIG } from "../data/config.js";

const LEAD = CONFIG.LEAD_TIMES || {};
const TRANSIT_MIN_BIZ_DAYS = 3;
const TRANSIT_MAX_BIZ_DAYS = 5;

/** Build-time range in weeks for a product key, e.g. [4, 6]. */
export function weeksFor(productKey) {
  const table = LEAD.WEEKS || {};
  const hit = table[productKey];
  if (Array.isArray(hit) && hit.length === 2) return [hit[0], hit[1]];
  const fallback = LEAD.DEFAULT_WEEKS;
  return Array.isArray(fallback) && fallback.length === 2 ? [fallback[0], fallback[1]] : [3, 5];
}

/**
 * Queue buffer in days for a number of open orders. Lusik works one
 * piece at a time, so each order already in the queue pushes a new one
 * back. Capped so a busy month never quotes an absurd date.
 */
export function queueBufferDays(openOrders) {
  if (!LEAD.QUEUE_ENABLED) return 0;
  const n = Number.isFinite(openOrders) && openOrders > 0 ? Math.floor(openOrders) : 0;
  const perOrder = Number(LEAD.QUEUE_DAYS_PER_OPEN_ORDER) || 0;
  const cap = Number(LEAD.QUEUE_BUFFER_CAP_DAYS) || 0;
  return Math.max(0, Math.min(Math.ceil(n * perOrder), cap));
}

export function addBusinessDays(date, n) {
  const d = new Date(date.getTime());
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d;
}

function addCalendarDays(date, n) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

function fmtMonthDay(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * The full promise for one product.
 *
 * @param {string} productKey
 * @param {{ today?: Date, queueDays?: number }} [opts]
 * @returns {{ weeks: [number, number], startBy: string, shipBy: string,
 *             arrives: string, queueDays: number, shipMin: Date, shipMax: Date }}
 */
export function getLeadTime(productKey, opts = {}) {
  const today = opts.today instanceof Date ? opts.today : new Date();
  const queueDays = Number.isFinite(opts.queueDays) ? Math.max(0, opts.queueDays) : 0;
  const [minWeeks, maxWeeks] = weeksFor(productKey);

  // Lusik starts the piece once the queue ahead of it clears.
  const start = addCalendarDays(today, queueDays);
  const shipMin = addCalendarDays(start, minWeeks * 7);
  const shipMax = addCalendarDays(start, maxWeeks * 7);
  const arriveMin = addBusinessDays(shipMin, TRANSIT_MIN_BIZ_DAYS);
  const arriveMax = addBusinessDays(shipMax, TRANSIT_MAX_BIZ_DAYS);

  return {
    weeks: [minWeeks, maxWeeks],
    queueDays,
    startBy: fmtMonthDay(start),
    shipBy: `${fmtMonthDay(shipMin)} – ${fmtMonthDay(shipMax)}`,
    arrives: `${fmtMonthDay(arriveMin)} – ${fmtMonthDay(arriveMax)}`,
    shipMin,
    shipMax,
  };
}

/** "about 4 to 6 weeks" — the plain-language version for body copy. */
export function weeksLabel(productKey) {
  const [a, b] = weeksFor(productKey);
  return a === b ? `about ${a} weeks` : `about ${a} to ${b} weeks`;
}

/**
 * The slowest product in a bag decides when the whole order ships,
 * because Lusik sends an order as one parcel.
 */
export function slowestKey(productKeys) {
  const keys = Array.isArray(productKeys) ? productKeys.filter(Boolean) : [];
  if (!keys.length) return null;
  let worst = keys[0];
  let worstMax = weeksFor(worst)[1];
  for (const k of keys.slice(1)) {
    const m = weeksFor(k)[1];
    if (m > worstMax) { worst = k; worstMax = m; }
  }
  return worst;
}
