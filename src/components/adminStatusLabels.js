// ============================================================
// Status taxonomy — single source of truth
// ============================================================
// One small module shared by AdminOrderRow, AdminView (filter
// chips), AdminOrderDetail (step buttons), and OrderCard
// (customer-facing labels + the OrderProgressTimeline). Keeping
// the label/order in one place means a relabel like
//   "Awaiting Lusik" -> "Confirmed"
// flips everywhere at once and the customer + admin sides stay
// in sync.
//
// The string values MUST match the orders_fulfillment_status_check
// CHECK constraint in netlify/schema.sql exactly. Adding a new
// step requires updating both the SQL constraint and this file.
// ============================================================

// Pipeline order, used for both the admin filter chips and the
// customer-facing stepped timeline.
export const STAGES = [
  { key: "in_progress",    label: "New" },
  { key: "awaiting_lusik", label: "Confirmed" },
  { key: "in_production",  label: "Stitching" },
  { key: "quality_check",  label: "Final review" },
  { key: "ready_to_ship",  label: "Ready to ship" },
  { key: "shipped",        label: "Shipped" },
  { key: "delivered",      label: "Delivered" },
];

// Map from fulfillment_status -> a single string label. Public
// (customer-facing) wording. The admin sees the same labels so
// what she clicks IS what they see — no "I clicked X and they
// see Y" confusion.
export const STATUS_LABEL = Object.fromEntries(
  STAGES.map((s) => [s.key, s.label]).concat([["refunded", "Refunded"]])
);

// Carriers Lusik picks from in the detail view. Matches
// ALLOWED_CARRIERS in netlify/functions/admin-orders.mjs exactly;
// adding a carrier means updating both.
export const ADMIN_CARRIER_OPTIONS = [
  { value: "",                       label: "— pick one —" },
  { value: "USPS Ground Advantage",  label: "USPS Ground Advantage" },
  { value: "UPS Ground",             label: "UPS Ground" },
  { value: "FedEx Home Delivery",    label: "FedEx Home Delivery" },
  { value: "Free U.S. shipping",     label: "Free U.S. shipping (no carrier)" },
];

// Admin dropdown — same list as STAGES plus a refunded option
// since CSP'd dropdowns can't be conditional but in practice
// refund flips are set by the Stripe webhook, not by hand.
export const ADMIN_STATUS_OPTIONS = STAGES.map((s) => ({ value: s.key, label: s.label }));

// The pipeline index a given status corresponds to. -1 means
// "off the pipeline" (refunded, unknown). Drives both the
// timeline's "filled in up to here" rendering and the
// detail-page step-button gating.
export function statusToStageIndex(status) {
  if (!status) return -1;
  const i = STAGES.findIndex((s) => s.key === status);
  return i; // -1 if not in pipeline
}

// Next status in the pipeline (or null at the end). Used by the
// Domino's-style step buttons in the detail view.
export function nextStatus(status) {
  const i = statusToStageIndex(status);
  if (i < 0 || i >= STAGES.length - 1) return null;
  return STAGES[i + 1].key;
}

// Color accent for the status pill. Warm gold for in-progress
// stages, sage for terminal positive states, muted red for
// refund. Kept inline (no Tailwind classes) so it works inside
// existing var(--ink)-styled rows.
export function statusAccent(order) {
  if (order.status === "refunded" || order.status === "partially_refunded" || order.status === "cancelled") {
    return "#8B2C2C";
  }
  const s = order.fulfillment_status;
  if (s === "shipped" || s === "delivered" || s === "ready_to_ship") return "#3D5A3D";
  if (s === "refunded") return "#8B2C2C";
  return "#B08842";
}

// Subset filter sets used by the admin chips. Keys map to a
// predicate over the order row.
export const ADMIN_FILTERS = [
  { key: "all",          label: "All",                 match: (_o) => true },
  { key: "new",          label: "New",                 match: (o) => o.fulfillment_status === "in_progress" && !o.confirmed_at },
  { key: "confirmed",    label: "Confirmed",           match: (o) => o.fulfillment_status === "awaiting_lusik" },
  { key: "in_production", label: "Stitching",          match: (o) => o.fulfillment_status === "in_production" || o.fulfillment_status === "quality_check" },
  { key: "ready_to_ship", label: "Ready to ship",      match: (o) => o.fulfillment_status === "ready_to_ship" },
  { key: "shipped",      label: "Shipped",             match: (o) => o.fulfillment_status === "shipped" },
  { key: "delivered",    label: "Delivered",           match: (o) => o.fulfillment_status === "delivered" },
  { key: "refunded",     label: "Refunded",            match: (o) => o.status === "refunded" || o.status === "partially_refunded" || o.fulfillment_status === "refunded" },
];
