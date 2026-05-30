"use client";

// ============================================================
// TrackingForm — public order-tracking form on the home page
// ============================================================
// Self-service tracking by carrier + number. Doesn't hit our
// backend — just opens the carrier's own tracking URL in a
// new tab. The carrier URLs duplicate what _lib/tracking.js
// exports; left inline here because this form's flow is its
// own thing.
//
// MIRRORED FROM index.html (~line 9397).
// ============================================================

import React, { useState } from "react";
import { ArrowRight } from "./icons.jsx";

export function TrackingForm() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("usps");
  const trackUrls = {
    usps: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`,
    ups: (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
    fedex: (n) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
  };
  const handleTrack = () => {
    if (trackingNumber.trim()) {
      window.open(trackUrls[carrier](trackingNumber.trim()), "_blank", "noopener,noreferrer");
    }
  };
  return (
    <div>
      <p className="text-xs tracking-[0.2em] uppercase opacity-70 mb-4">Track your order</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="px-3 py-3.5 bg-transparent border text-sm" style={{ borderColor: "rgba(26,22,18,0.2)" }}>
          <option value="usps">USPS</option>
          <option value="ups">UPS</option>
          <option value="fedex">FedEx</option>
        </select>
        <input type="text" placeholder="Tracking number" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleTrack()} autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} className="flex-1 px-4 py-3.5 bg-transparent border text-sm" style={{ borderColor: "rgba(26,22,18,0.2)" }} />
        <button onClick={handleTrack} className="px-6 py-3.5 text-sm tracking-wide flex items-center justify-center gap-2" style={{ background: "var(--ink)", color: "var(--text-on-ink)" }}>
          Track <ArrowRight size={14} />
        </button>
      </div>
      <p className="text-xs opacity-60 mt-3">Opens the carrier's tracking page in a new tab.</p>
    </div>
  );
}
