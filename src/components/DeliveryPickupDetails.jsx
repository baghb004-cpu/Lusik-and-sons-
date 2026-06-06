"use client";

// ============================================================
// DeliveryPickupDetails — Apple-style "Show / Hide delivery and
// pickup details" collapsible, baked into every product page.
// ============================================================
// A tappable row with a chevron on the right that FLIPS (down ↔ up)
// as it opens/closes, and the label toggles between "Show …" and
// "Hide …" — matching the Apple Store product page.
//
// Content is driven by CONFIG so the copy + pickup area live on the
// dial board (src/data/config.js):
//   - DELIVERY_NOTE        — always shown (free U.S. shipping note)
//   - LOCAL_PICKUP.ENABLED — when false, the pickup row is dropped
//                            AND the word "pickup" leaves the label
//   - LOCAL_PICKUP.AREA     — the area string for the pickup row
// ============================================================

import React, { useState } from "react";
import { CONFIG } from "../data/config.js";

function Chevron({ open }) {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none"
      aria-hidden="true"
      style={{ transition: "transform 0.25s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function DeliveryPickupDetails({ className = "" }) {
  const [open, setOpen] = useState(false);
  const pickup = CONFIG.LOCAL_PICKUP || {};
  const pickupOn = pickup.ENABLED !== false;
  const noun = pickupOn ? "delivery and pickup details" : "delivery details";

  return (
    <div className={`max-w-3xl mx-auto px-6 lg:px-12 ${className}`}>
      <div style={{ borderTop: "1px solid var(--border-default)", borderBottom: "1px solid var(--border-default)" }}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-4 py-4 text-left"
          style={{ color: "var(--text-primary)" }}
        >
          <span className="text-sm" style={{ fontWeight: 500 }}>
            {open ? `Hide ${noun}` : `Show ${noun}`}
          </span>
          <span style={{ color: "var(--accent)", flexShrink: 0 }}><Chevron open={open} /></span>
        </button>

        {open && (
          <div className="pb-5 flex flex-col gap-4 fade-in">
            <div className="flex gap-3">
              <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }}><BoxIcon /></span>
              <div>
                <p className="text-sm" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Free U.S. shipping</p>
                <p className="text-sm opacity-70 leading-relaxed">
                  {CONFIG.DELIVERY_NOTE || "Made to order — hand-stitched, then shipped to your door."}
                </p>
              </div>
            </div>

            {pickupOn && (
              <div className="flex gap-3">
                <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }}><PinIcon /></span>
                <div>
                  <p className="text-sm" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Local pickup</p>
                  <p className="text-sm opacity-70 leading-relaxed">
                    Available in {pickup.AREA || "select areas"} — message Lusik to arrange.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
