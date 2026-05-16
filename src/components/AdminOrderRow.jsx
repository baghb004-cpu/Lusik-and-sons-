// ============================================================
// AdminOrderRow — summary card for one order in the admin list
// ============================================================
// Click-to-open card. All editing (status step-buttons, tracking,
// admin message, finished-photo upload, internal notes) lives in
// AdminOrderDetail. Keeping the list lightweight lets Lusik scan a
// long list of orders on her phone without 12 inline forms loaded.
//
// The previous version of this component carried an inline edit
// form that referenced undefined globals (ADMIN_STATUS_OPTIONS,
// ADMIN_CARRIER_OPTIONS) — that was a latent ReferenceError caught
// only by the ErrorBoundary. The detail-page split fixes that.
// ============================================================

import React from "react";
import { STATUS_LABEL, statusAccent } from "./adminStatusLabels.js";

export function AdminOrderRow({ order, onOpen }) {
  const statusLabel = STATUS_LABEL[order.fulfillment_status] ?? order.fulfillment_status;
  const accent = statusAccent(order);
  const orderDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";
  const ship = order.shipping_address;

  // Payment-status badge: "Paid" by default, but a refund swap (full
  // or partial) gets a louder cue so Lusik doesn't accidentally ship
  // an order that the customer already got their money back for.
  const paymentBadge = (() => {
    if (order.status === "refunded")           return { text: "Refunded",          color: "#8B2C2C", bg: "rgba(139,44,44,0.10)" };
    if (order.status === "partially_refunded") return { text: "Partial refund",    color: "#8B2C2C", bg: "rgba(139,44,44,0.10)" };
    if (order.status === "cancelled")          return { text: "Cancelled",         color: "#8B2C2C", bg: "rgba(139,44,44,0.10)" };
    return null; // "paid" is the silent default
  })();

  // Did the admin message change since the last time the customer's
  // page polled? Hard to know without per-customer state, but we can
  // at least surface whether a message exists at all so Lusik
  // remembers what she said.
  const hasAdminMessage = !!order.admin_message;

  return (
    <button
      type="button"
      onClick={() => onOpen?.(order.id)}
      className="w-full p-5 lg:p-6 text-left transition hover:bg-[rgba(176,136,66,0.04)] focus:outline-none focus:ring-2 focus:ring-[rgba(176,136,66,0.4)]"
      style={{ border: "1px solid rgba(26,22,18,0.12)" }}
      aria-label={`Open order ${order.order_number}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap mb-1">
            <p className="font-display text-lg" style={{ fontWeight: 500 }}>{order.order_number}</p>
            <p className="text-xs opacity-60">{orderDate}</p>
            {order.gift?.is_gift && (
              <span className="text-[0.55rem] tracking-[0.18em] uppercase px-2 py-0.5" style={{ background: "rgba(176,136,66,0.15)", color: "#B08842", fontWeight: 500 }}>
                Gift
              </span>
            )}
            {paymentBadge && (
              <span className="text-[0.55rem] tracking-[0.18em] uppercase px-2 py-0.5" style={{ background: paymentBadge.bg, color: paymentBadge.color, fontWeight: 500 }}>
                {paymentBadge.text}
              </span>
            )}
            {hasAdminMessage && (
              <span className="text-[0.55rem] tracking-[0.18em] uppercase px-2 py-0.5" style={{ background: "rgba(61,90,61,0.10)", color: "#3D5A3D", fontWeight: 500 }}>
                Message to customer
              </span>
            )}
          </div>
          <p className="text-xs opacity-70 truncate">
            {order.customer_email}
            {ship && <span> · {ship.name ? `${ship.name} — ` : ""}{ship.city}, {ship.state ?? ship.region}</span>}
            <span> · {order.item_count ?? (order.order_items?.length ?? 0)} item{(order.item_count ?? (order.order_items?.length ?? 1)) === 1 ? "" : "s"}</span>
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[0.65rem] tracking-[0.2em] uppercase mb-1" style={{ color: accent, fontWeight: 500 }}>{statusLabel}</p>
          <p className="text-sm" style={{ fontWeight: 500 }}>${(order.total_cents / 100).toFixed(2)}</p>
        </div>
      </div>
    </button>
  );
}
