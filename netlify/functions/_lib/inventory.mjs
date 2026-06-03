// ============================================================
// _lib/inventory.mjs — handmade-stock safety cap
// ============================================================
// These are handmade, made-to-order goods. The shop may go a few
// days unchecked, so we cap how many of each product can be sold
// before it shows "sold out" — a safety net against overselling
// Lusik's time, not a real-time warehouse system.
//
// SOURCE OF TRUTH: the `order_items` table, which is written ONLY by
// stripe-webhook on a completed payment. "Units sold" for a product
// is the SUM of order_items.quantity across non-refunded / non-
// cancelled orders. There is no separate counter to drift or corrupt
// — we read the orders we already record.
//
// remaining = limit - unitsSold  (floored at 0).
//
// CONCURRENCY: two checkouts for the last unit could both pass the
// pre-payment check and both pay, overselling by a small amount. For
// a low-volume handmade shop with a cap of 5 that residual risk is
// acceptable; the authoritative count (order_items) only ever counts
// real payments, and the per-checkout check catches the common case.
// ============================================================

import { TRUSTED_PRODUCTS } from "./trusted-products.mjs";

// Starting stock for every live product, unless overridden below.
export const DEFAULT_STOCK_LIMIT = 5;

// Per-group overrides. Key = inventory group (see inventoryGroup()).
// Empty = every product uses DEFAULT_STOCK_LIMIT. To give one product
// more or fewer units, add e.g. `"bib": 20` here — one line, no other
// changes needed.
export const STOCK_LIMITS = {};

// A product and its "+ cap" variant share one pool of stock — the cap
// is an add-on; the constrained resource is the bib/set itself. The
// group key strips the trailing "-with-cap" so both SKUs count toward
// (and deplete) the same limit.
export function inventoryGroup(productKey) {
  if (!productKey || typeof productKey !== "string") return null;
  return productKey.replace(/-with-cap$/, "");
}

export function limitForGroup(group) {
  if (group && Object.prototype.hasOwnProperty.call(STOCK_LIMITS, group)) {
    return STOCK_LIMITS[group];
  }
  return DEFAULT_STOCK_LIMIT;
}

// Every distinct inventory group that maps to a sellable SKU. Derived
// from TRUSTED_PRODUCTS so adding a product automatically gives it a
// stock cap with no extra wiring.
export function liveGroups() {
  const set = new Set();
  for (const key of Object.keys(TRUSTED_PRODUCTS)) {
    const g = inventoryGroup(key);
    if (g) set.add(g);
  }
  return [...set];
}

// Units already sold per inventory group, from real (non-refunded,
// non-cancelled) paid orders. Returns a Map<group, unitsSold>.
export async function soldByGroup(sql) {
  const rows = await sql`
    SELECT oi.product_key AS product_key, SUM(oi.quantity)::int AS sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status NOT IN ('refunded', 'cancelled')
    GROUP BY oi.product_key
  `;
  const map = new Map();
  for (const r of rows ?? []) {
    const g = inventoryGroup(r.product_key);
    if (!g) continue;
    map.set(g, (map.get(g) ?? 0) + (Number(r.sold) || 0));
  }
  return map;
}

// remaining for one group given a sold-map.
export function remainingFor(group, soldMap) {
  return Math.max(0, limitForGroup(group) - (soldMap.get(group) ?? 0));
}

// Full availability snapshot for every live group, for the public
// /inventory endpoint and the browser UI.
export async function availabilitySnapshot(sql) {
  const sold = await soldByGroup(sql);
  const out = {};
  for (const group of liveGroups()) {
    const limit = limitForGroup(group);
    const remaining = remainingFor(group, sold);
    out[group] = { remaining, limit, soldOut: remaining <= 0 };
  }
  return out;
}

// Given a cart (array of { productKey, qty }), return the first group
// that would exceed its remaining stock, or null if all fit. Used by
// create-checkout-session to reject overselling before payment.
export async function findInventoryViolation(sql, cart) {
  const requested = new Map();
  for (const item of cart) {
    const g = inventoryGroup(item?.productKey);
    if (!g) continue;
    const q = Number.isInteger(item?.qty) && item.qty > 0 ? Math.min(99, item.qty) : 1;
    requested.set(g, (requested.get(g) ?? 0) + q);
  }
  if (requested.size === 0) return null;

  const sold = await soldByGroup(sql);
  for (const [group, want] of requested) {
    const remaining = remainingFor(group, sold);
    if (want > remaining) {
      return { group, requested: want, remaining };
    }
  }
  return null;
}
