"use client";

// ------------------------------------------------------------
// AdvertisingChoices — the CPRA do-not-share switch, rendered
// inside the privacy policy's "Advertising pixels" section by
// BOTH consumers of the policy text (PolicyModal and the
// standalone /privacy page). Reads the persisted opt-out after
// mount (SSR-safe) and writes through src/lib/adConsent so the
// pixels stand down immediately.
// ------------------------------------------------------------

import React, { useEffect, useState } from "react";
import { hasGpcSignal, hasStoredOptOut, setAdsOptedOut } from "../lib/adConsent";

export function AdvertisingChoices() {
  const [optedOut, setOptedOut] = useState(false);
  const [gpc, setGpc] = useState(false);
  useEffect(() => {
    setOptedOut(hasStoredOptOut());
    setGpc(hasGpcSignal());
  }, []);

  // GPC alone is enough to stop sharing; the stored choice also stands on
  // its own so it travels to browsers without a GPC signal turned on.
  const off = optedOut || gpc;
  const statusText = gpc
    ? "Your browser is sending a Global Privacy Control signal, so sharing is already off on this device — no switch needed."
    : optedOut
      ? "Sharing is off on this device. The Meta and Google tags will not load."
      : "Sharing is currently on. Flip the switch and both tags stop loading on this device, immediately and on future visits.";

  return (
    <div
      data-ads-choices
      className="mt-4 p-4 flex items-center justify-between gap-4"
      style={{ border: "1px solid var(--border-default)", background: "rgba(176,136,66,0.06)" }}
    >
      <div>
        <p className="text-sm" style={{ fontWeight: 600 }}>
          Do not sell or share my personal information
        </p>
        <p className="text-xs opacity-70 mt-1 leading-relaxed">{statusText}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={off}
        aria-label="Do not sell or share my personal information"
        onClick={() => {
          const next = !optedOut;
          setAdsOptedOut(next);
          setOptedOut(next);
        }}
        className="flex-shrink-0"
        style={{
          width: 46,
          height: 26,
          borderRadius: 999,
          position: "relative",
          background: off ? "var(--accent)" : "rgba(26,22,18,0.25)",
          border: "1px solid rgba(26,22,18,0.15)",
          transition: "background 0.18s ease",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 2,
            left: off ? 21 : 2,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#FFFFFF",
            boxShadow: "0 1px 3px rgba(26,22,18,0.3)",
            transition: "left 0.18s ease",
          }}
        />
      </button>
    </div>
  );
}
