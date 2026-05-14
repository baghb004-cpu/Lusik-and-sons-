// ============================================================
// OrderProgressTimeline + OrderCard
// ============================================================
// Two components co-located because OrderCard renders the
// timeline inline. The timeline is a stepped horizontal
// progress indicator (awaiting_lusik → in_production →
// quality_check → ready_to_ship → shipped → delivered).
//
// OrderCard shows everything for one order: header, status,
// items, shipping info, finished-photo if uploaded, reorder
// button. Imports the tracking-URL builder from lib.
//
// MIRRORED FROM index.html (~lines 7939 + 8010).
// ============================================================

import React from "react";
import { getTrackingUrl } from "../lib/tracking.js";
import { ArrowRight, Check } from "./icons.jsx";

export function OrderProgressTimeline({ status }) {
  if (status === "refunded") return null;
  const current = statusToStageIndex(status);
  return (
    <ol className="flex items-start justify-between mb-4 mt-2 gap-1 sm:gap-2" aria-label="Order progress">
      {ORDER_STAGES.map((stage, i) => {
        const isComplete = i < current;
        const isCurrent  = i === current;
        const isLast     = i === ORDER_STAGES.length - 1;
        const bg     = isComplete || isCurrent ? "#B08842" : "rgba(26,22,18,0.15)";
        const fg     = isComplete || isCurrent ? "#F5EFE3" : "rgba(26,22,18,0.4)";
        const lineBg = isComplete             ? "#B08842" : "rgba(26,22,18,0.12)";
        return (
          <li key={stage.key} className="flex-1 flex flex-col items-center text-center" aria-current={isCurrent ? "step" : undefined}>
            <div className="relative w-full flex items-center justify-center">
              {/* Connector line — half before the dot, half after.
                  Skipping the first half on stage 0 and the last
                  half on stage N keeps the line from spilling out. */}
              {i > 0 && (
                <span aria-hidden="true" className="absolute left-0 right-1/2 top-1/2 -translate-y-1/2 h-px" style={{ background: lineBg }} />
              )}
              {!isLast && (
                <span aria-hidden="true" className="absolute left-1/2 right-0 top-1/2 -translate-y-1/2 h-px" style={{
                  // The line AFTER this stage fills if the NEXT stage
                  // is complete or current.
                  background: i + 1 <= current ? "#B08842" : "rgba(26,22,18,0.12)"
                }} />
              )}
              <span
                className={"relative z-10 inline-flex items-center justify-center rounded-full " + (isCurrent ? "order-stage-current" : "")}
                style={{
                  width: 22, height: 22,
                  background: bg,
                  color: fg,
                  border: isCurrent ? "1.5px solid #B08842" : "none",
                  boxShadow: isCurrent ? "0 0 0 4px rgba(176,136,66,0.15)" : "none",
                }}
              >
                {isComplete ? (
                  <Check size={11} strokeWidth={2.5} />
                ) : (
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: fg, display: "block" }} />
                )}
              </span>
            </div>
            <span className="text-[0.55rem] sm:text-[0.6rem] tracking-[0.12em] uppercase mt-2 leading-tight px-0.5" style={{ color: isComplete || isCurrent ? "#1A1612" : "rgba(26,22,18,0.5)", fontWeight: isCurrent ? 600 : 400 }}>
              {stage.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
export function OrderCard({ order, onReorder }) {
  const statusLabel = (() => {
    // Money-status takes precedence over fulfillment-status for
    // the headline badge — a refunded order is "Refunded"
    // regardless of where it was in production when the refund
    // hit. Partial refunds still show the original fulfillment
    // label since the customer is still getting most of it.
    if (order.status === "refunded")           return { text: "Refunded",          color: "#8B2C2C" };
    if (order.status === "partially_refunded") return { text: "Partially refunded", color: "#8B2C2C" };
    switch (order.fulfillment_status) {
      case "awaiting_lusik":  return { text: "Awaiting Lusik",     color: "#B08842" };
      case "in_production":   return { text: "Lusik is stitching", color: "#B08842" };
      case "quality_check":   return { text: "Final review",       color: "#B08842" };
      case "ready_to_ship":   return { text: "Ready to ship",      color: "#3D5A3D" };
      case "shipped":         return { text: "Shipped",            color: "#3D5A3D" };
      case "delivered":       return { text: "Delivered",          color: "#3D5A3D" };
      case "refunded":        return { text: "Refunded",           color: "#8B2C2C" };
      default:                return { text: order.fulfillment_status || "Pending", color: "#666" };
    }
  })();

  const orderDate = order.created_at ? new Date(order.created_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  }) : "";

  return (
    <div className="p-5 lg:p-6" style={{ border: "1px solid rgba(26,22,18,0.12)" }}>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <p className="font-display text-lg" style={{ fontWeight: 500 }}>{order.order_number}</p>
          <p className="text-xs opacity-60">{orderDate}</p>
        </div>
        <div className="text-right">
          <p className="text-[0.65rem] tracking-[0.2em] uppercase" style={{ color: statusLabel.color, fontWeight: 500 }}>
            {statusLabel.text}
          </p>
          <p className="text-sm" style={{ fontWeight: 500 }}>${(order.total_cents / 100).toFixed(2)}</p>
        </div>
      </div>

      {/* Refund banner — surfaces refunded_cents prominently
          when any portion of the order has been refunded. Full
          refunds also kill the timeline (the order is over);
          partial refunds keep the timeline so the customer can
          still see the rest of their order in motion. */}
      {(order.refunded_cents ?? 0) > 0 && (() => {
        const isFull       = order.status === "refunded" || order.refunded_cents >= order.total_cents;
        const refundedFmt  = (order.refunded_cents / 100).toFixed(2);
        const remainingFmt = ((order.total_cents - order.refunded_cents) / 100).toFixed(2);
        return (
          <div className="mb-4 p-3" style={{ background: "rgba(139,44,44,0.06)", border: "1px solid rgba(139,44,44,0.25)" }}>
            <p className="text-[0.6rem] tracking-[0.25em] uppercase mb-1.5" style={{ color: "#8B2C2C", fontWeight: 600 }}>
              {isFull ? "Refunded" : "Partial refund"}
            </p>
            <p className="text-sm leading-relaxed">
              <span style={{ fontWeight: 500 }}>${refundedFmt}</span>
              <span className="opacity-75"> returned to your card</span>
              {!isFull && (
                <>
                  <span className="opacity-50"> · </span>
                  <span style={{ fontWeight: 500 }}>${remainingFmt}</span>
                  <span className="opacity-75"> remaining</span>
                </>
              )}
            </p>
            <p className="text-[0.65rem] opacity-65 mt-1 leading-snug italic">
              Refunds usually appear on your card within 5–10 business days, depending on your bank.
            </p>
          </div>
        );
      })()}

      {/* Stepped progress — only when the order is in a normal
          fulfillment state. Full refunds get the refund banner
          above instead; partial refunds keep the timeline since
          the customer's still getting most of the order. */}
      {order.fulfillment_status !== "refunded" && (
        <OrderProgressTimeline status={order.fulfillment_status} />
      )}

      {/* Finished-piece photo — uploaded by Lusik from the admin
          view. Shows up forever once attached, as a small keepsake
          of the actual blanket made for this customer. Click to
          open full-size in a new tab. */}
      {order.finished_photo_key && (
        <a
          href={`/.netlify/functions/order-photo-get?key=${encodeURIComponent(order.finished_photo_key)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block mb-4 overflow-hidden transition hover:opacity-90"
          style={{ border: "1px solid rgba(176,136,66,0.3)" }}
          aria-label="View finished-piece photo full size"
        >
          <img
            src={`/.netlify/functions/order-photo-get?key=${encodeURIComponent(order.finished_photo_key)}`}
            alt="The finished blanket Lusik made for this order"
            className="w-full h-auto object-cover"
            style={{ maxHeight: "240px", display: "block" }}
            loading="lazy"
          />
          <p className="px-3 py-2 text-[0.65rem] tracking-[0.18em] uppercase opacity-70" style={{ background: "rgba(176,136,66,0.06)" }}>
            <span style={{ color: "#B08842", fontWeight: 500 }}>From Lusik</span> · photo of your finished blanket
          </p>
        </a>
      )}

      {/* Items */}
      <div className="space-y-2 mb-4 pb-4" style={{ borderBottom: "1px solid rgba(26,22,18,0.08)" }}>
        {(order.order_items ?? []).map((item) => (
          <div key={item.id} className="flex items-start justify-between text-sm gap-3">
            <div className="flex-1">
              <p style={{ fontWeight: 500 }}>
                {item.product_name}
                {item.is_custom && <span className="ml-2 text-[0.55rem] tracking-[0.15em] uppercase px-1.5 py-0.5" style={{ background: "#B08842", color: "#F5EFE3", fontWeight: 500 }}>Custom</span>}
              </p>
              {item.variant_label && <p className="text-xs opacity-60">{item.variant_label}</p>}
              <p className="text-xs opacity-60">Qty {item.quantity}</p>
            </div>
            <p className="text-sm opacity-70">${((item.unit_price_cents * item.quantity) / 100).toFixed(2)}</p>
          </div>
        ))}
      </div>

      {/* Shipping + tracking */}
      <div className="text-xs opacity-70 space-y-1">
        {order.carrier && (() => {
          const trackUrl = getTrackingUrl(order.carrier, order.tracking_number);
          return (
            <p>
              {order.carrier}
              {order.tracking_number && (
                <>
                  {" · "}
                  {trackUrl ? (
                    <a
                      href={trackUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:opacity-100"
                      style={{ color: "#B08842", fontWeight: 500 }}
                    >
                      Track {order.tracking_number}
                    </a>
                  ) : (
                    <span className="underline">{order.tracking_number}</span>
                  )}
                </>
              )}
            </p>
          );
        })()}
        {order.estimated_ship_date && (
          <p>Estimated ship date: {new Date(order.estimated_ship_date).toLocaleDateString()}</p>
        )}
        {order.shipping_address && (
          <p className="opacity-60 italic">
            Shipping to {order.shipping_address.city}, {order.shipping_address.state}
          </p>
        )}
      </div>

      {/* Reorder — re-adds the order's items to the current cart.
          Currently handles blankets (the main SKU); skips any
          line items whose metadata can't be re-resolved into the
          live product config and toasts the customer about it. */}
      {onReorder && (order.order_items?.length ?? 0) > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(26,22,18,0.06)" }}>
          <button
            onClick={() => onReorder(order)}
            className="text-[0.65rem] tracking-[0.2em] uppercase px-3 py-2 inline-flex items-center gap-2 hover:bg-[rgba(26,22,18,0.04)] transition"
            style={{ border: "1px solid rgba(26,22,18,0.2)", color: "#1A1612", fontWeight: 500 }}
          >
            Order again <ArrowRight size={12} strokeWidth={1.75} />
          </button>
        </div>
      )}
    </div>
  );
}
