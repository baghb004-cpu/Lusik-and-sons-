// ShippingEstimator — MIRRORED FROM index.html (~line 4114).
import React from "react";
import { useState } from "react";
import { CONFIG } from "../data/config.js";
import { SHIPPING_CARRIERS } from "../data/shippingCarriers.js";

export function ShippingEstimator({ subtotalCents }) {
  const [zip, setZip]               = useState("");
  const [expanded, setExpanded]     = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  const earnsFreeShipping = CONFIG.FREE_SHIPPING_ENABLED
                          && subtotalCents >= CONFIG.FREE_SHIPPING_THRESHOLD_CENTS;
  const zipValid = /^\d{5}$/.test(zip.trim());

  // State 1 — earned free shipping; nothing to estimate.
  if (earnsFreeShipping) {
    return (
      <p className="text-xs leading-relaxed mb-3">
        <span style={{ color: "#B08842", fontWeight: 500 }}>Shipping:</span>{" "}
        <span className="opacity-80">Free U.S. shipping. Lusik picks the carrier at checkout.</span>
      </p>
    );
  }

  // State 2 — collapsed teaser.
  if (!expanded) {
    return (
      <div className="text-xs mb-3 leading-relaxed">
        <span className="opacity-70">Shipping from $9.99 — calculated at checkout. </span>
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

  // State 3 — submitted, valid ZIP, show rates.
  if (submitted && zipValid) {
    const t = getTransitDaysByZip(zip);
    return (
      <div className="text-xs mb-3 leading-relaxed p-3" style={{ background: "rgba(176,136,66,0.06)", border: "1px solid rgba(176,136,66,0.18)" }}>
        <p className="opacity-70 mb-2">
          Estimated rates to <span style={{ fontWeight: 500 }}>ZIP {zip}</span>
          {" "}<span className="opacity-70">· {t.min}–{t.max} business days transit:</span>
        </p>
        <div className="space-y-1 mb-2">
          {SHIPPING_RATES_DISPLAY.map((r) => (
            <div key={r.name} className="flex justify-between tabular-nums">
              <span className="opacity-85">{r.name}</span>
              <span style={{ fontWeight: 500 }}>${r.cost.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <p className="opacity-55 italic mt-1.5">
          Add Lusik's production time (5–10 business days) for the full lead. You'll pick a carrier on the next page.
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
        className="underline opacity-60 hover:opacity-100 mt-2 inline-block"
      >
        Cancel
      </button>
    </form>
  );
}
