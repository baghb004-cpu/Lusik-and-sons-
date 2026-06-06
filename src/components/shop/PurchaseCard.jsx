"use client";

// ============================================================
// PurchaseCard — Apple-style product "buy" bubble
// ============================================================
// One rounded card that groups, top → bottom:
//   1. the "Show / Hide delivery and pickup details" collapsible
//   2. (optional) a price line
//   3. the Add-to-Bag / Buy-now button(s)  ← passed as children
//
// Matches the Apple Store product purchase card (the floating panel
// with delivery details on top and the buy button at the bottom).
// Drop it around a product's buy buttons; pass an optional priceNode
// to show the price inside the card just above the button.
// ============================================================

import React from "react";
import { DeliveryPickupDetails } from "../DeliveryPickupDetails.jsx";

export function PurchaseCard({ children, priceNode = null, className = "" }) {
  return (
    <div
      className={`rounded-2xl overflow-hidden ${className}`}
      style={{
        border: "1px solid var(--border-default)",
        background: "var(--bg-surface, #FFFFFF)",
        boxShadow: "0 2px 18px rgba(26,22,18,0.08)",
      }}
    >
      {/* Delivery & pickup disclosure — top of the card */}
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-soft)" }}>
        <DeliveryPickupDetails />
      </div>

      {/* Price (optional) + buy buttons — bottom of the card */}
      <div className="px-5 py-5 flex flex-col gap-2">
        {priceNode}
        {children}
      </div>
    </div>
  );
}
