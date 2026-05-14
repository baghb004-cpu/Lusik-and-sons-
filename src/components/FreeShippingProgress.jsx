// ============================================================
// FreeShippingProgress — cart-drawer "${X} away from free shipping" bar
// ============================================================
// Returns null when the promotion isn't enabled, so the cart
// drawer doesn't need to know it exists. Both threshold and
// enabled-flag come from CONFIG.
//
// MIRRORED FROM index.html (~line 3609).
// ============================================================

import React from "react";
import { CONFIG } from "../data/config.js";

export function FreeShippingProgress({ subtotalCents }) {
  if (!CONFIG.FREE_SHIPPING_ENABLED) return null;
  const threshold = CONFIG.FREE_SHIPPING_THRESHOLD_CENTS;
  const remaining = Math.max(0, threshold - subtotalCents);
  const pct = Math.min(100, Math.round((subtotalCents / threshold) * 100));
  const isEarned = remaining === 0;
  return (
    <div className="px-6 pt-5 pb-3" aria-live="polite">
      <div className="flex justify-between items-baseline mb-2">
        <p className="text-xs leading-snug">
          {isEarned ? (
            <span style={{ color: "#B08842", fontWeight: 500 }}>You've earned free U.S. shipping.</span>
          ) : (
            <>
              <span style={{ fontWeight: 500 }}>${(remaining / 100).toFixed(2)}</span>
              <span className="opacity-70"> away from free U.S. shipping</span>
            </>
          )}
        </p>
        <span className="text-[0.65rem] opacity-50 tabular-nums">{pct}%</span>
      </div>
      <div
        className="w-full overflow-hidden"
        style={{
          background: "rgba(26,22,18,0.08)",
          height: "6px",
          borderRadius: "3px",
        }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress toward free shipping"
      >
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: "#B08842",
            borderRadius: "3px",
            minWidth: pct > 0 ? "6px" : "0",  // round end is always visible even at 1%
          }}
        />
      </div>
    </div>
  );
}
