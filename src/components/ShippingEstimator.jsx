"use client";

import React from "react";
import { useState, useEffect } from "react";
import { CONFIG } from "../data/config.js";
import { db } from "../lib/db.js";
import { estimateShippingForZip, SHIPPING_FROM_DOLLARS } from "../data/shippingZones.js";

export function ShippingEstimator({ subtotalCents }) {
  const [zip, setZip]               = useState("");
  const [expanded, setExpanded]     = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  // City/state echo for the submitted ZIP ("Cypress, CA") — same
  // first-party lookup checkout uses; silent when unavailable.
  const [place, setPlace]           = useState(null);
  useEffect(() => {
    setPlace(null);
    if (!submitted || !/^\d{5}$/.test(zip.trim())) return undefined;
    let stale = false;
    db.lookupZip(zip.trim()).then(({ place: p }) => { if (!stale) setPlace(p); });
    return () => { stale = true; };
  }, [submitted, zip]);

  const earnsFreeShipping = CONFIG.FREE_SHIPPING_ENABLED
                          && subtotalCents >= CONFIG.FREE_SHIPPING_THRESHOLD_CENTS;
  const zipValid = /^\d{5}$/.test(zip.trim());

  // State 1 — earned free shipping; nothing to estimate.
  if (earnsFreeShipping) {
    return (
      <p className="text-xs leading-relaxed mb-3">
        <span style={{ color: "var(--accent)", fontWeight: 500 }}>Shipping:</span>{" "}
        <span className="opacity-80">Free U.S. shipping. Lusik picks the carrier at checkout.</span>
      </p>
    );
  }

  // State 2 — collapsed teaser.
  if (!expanded) {
    return (
      <div className="text-xs mb-3 leading-relaxed">
        <span className="opacity-70">Shipping from ${SHIPPING_FROM_DOLLARS.toFixed(2)} — priced by distance from Cypress, CA. </span>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="underline opacity-80 hover:opacity-100"
        >
          Estimate for my ZIP →
        </button>
      </div>
    );
  }

  // State 3 — submitted, valid ZIP, show the zone rate. The estimate
  // comes from src/data/shippingZones.js, the drift-tested mirror of
  // the zone table checkout actually charges from.
  if (submitted && zipValid) {
    const est = estimateShippingForZip(zip);
    return (
      <div className="text-xs mb-3 leading-relaxed p-3" style={{ background: "rgba(176,136,66,0.06)", border: "1px solid rgba(176,136,66,0.18)" }}>
        <p className="opacity-70 mb-2">
          Shipping to <span style={{ fontWeight: 500 }}>{place ? `${place.city}, ${place.state} ${zip}` : `ZIP ${zip}`}</span>:
        </p>
        <div className="flex justify-between tabular-nums mb-2">
          <span className="opacity-85">{est.label}</span>
          <span style={{ fontWeight: 500 }}>${est.dollars.toFixed(2)}</span>
        </div>
        <p className="opacity-55 italic mt-1.5">
          {est.daysMin}–{est.daysMax} business days transit once it ships — add Lusik's production time (5–10 business days) for the full lead. Free over ${(CONFIG.FREE_SHIPPING_THRESHOLD_CENTS / 100).toFixed(0)}.
        </p>
        <button
          type="button"
          onClick={() => { setSubmitted(false); setZip(""); }}
          className="underline opacity-70 hover:opacity-100 mt-2 inline-block"
        >
          Try a different ZIP
        </button>
      </div>
    );
  }

  // State 4 — expanded, awaiting submit.
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (zipValid) setSubmitted(true); }}
      className="text-xs mb-3"
    >
      <label className="block mb-1.5 opacity-70">Enter your ZIP code:</label>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
          placeholder="90630"
          className="flex-1 px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[rgba(176,136,66,0.4)] tabular-nums"
          style={{ border: "1px solid rgba(26,22,18,0.15)" }}
          aria-label="ZIP code for shipping estimate"
          autoFocus
        />
        <button
          type="submit"
          disabled={!zipValid}
          className="px-3 text-[0.65rem] tracking-[0.2em] uppercase whitespace-nowrap transition"
          style={{
            background: zipValid ? "#1A1612" : "rgba(26,22,18,0.3)",
            color: "#F5EFE3",
            fontWeight: 500,
            cursor: zipValid ? "pointer" : "not-allowed",
          }}
        >
          Estimate
        </button>
      </div>
      <button
        type="button"
        onClick={() => { setExpanded(false); setZip(""); }}
        className="underline opacity-70 hover:opacity-100 mt-2 inline-block"
      >
        Cancel
      </button>
    </form>
  );
}
