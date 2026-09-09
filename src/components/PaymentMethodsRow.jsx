// ============================================================
// PaymentMethodsRow — small "we accept" badge row
// ============================================================
// Renders below the buy buttons / in the footer / on Checkout.
// Hardcoded list of method names; Stripe Checkout actually
// determines what's accepted at runtime, so this is purely
// visual reassurance for the customer browsing the page.
//
// ============================================================

import React from "react";

export function PaymentMethodsRow({ className = "", align = "center" }) {
  const methods = ["Visa", "Mastercard", "Amex", "Apple Pay", "Google Pay"];
  const justify = align === "center" ? "justify-center" : "justify-start";
  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${justify} ${className}`}>
      {methods.map((m) => (
        <span
          key={m}
          className="text-[0.55rem] tracking-[0.18em] uppercase px-2 py-1"
          style={{
            // Tokens, not literals: the hardcoded ink read 1.03:1 against the
            // dark page — the whole row vanished in dark mode.
            color: "var(--text-muted)",
            border: "1px solid var(--border-default)",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          {m}
        </span>
      ))}
    </div>
  );
}
