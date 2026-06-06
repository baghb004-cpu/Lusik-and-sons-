"use client";

// ============================================================
// MobilePurchaseBar — Apple-style persistent mobile buy sheet
// ============================================================
// A fixed bottom sheet (mobile only) that is ALWAYS visible on a
// product page — the true mobile buy surface. It contains, top → bottom:
//   1. a "Show / Hide delivery and pickup details" toggle
//   2. a drawer that slides UP (expands) with the delivery + pickup info
//   3. the Add-to-Bag button, PINNED to the bottom (stays put while the
//      drawer opens above it)
//
// Rendered through a portal into <body> so `position: fixed` escapes the
// route's transformed ancestors (framer-motion page wrapper) and pins to
// the real viewport — same trick as the old StickyMobileBuyBar.
//
// On mobile this REPLACES the in-flow Add-to-Bag button (which is hidden
// via `hidden lg:block` on the PurchaseCard), so the buy action lives
// only here. Desktop never sees it (lg:hidden).
// ============================================================

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight } from "../icons.jsx";
import { CONFIG } from "../../data/config.js";

function Chevron({ open }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      style={{ transition: "transform 0.25s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function Row({ icon, title, body }) {
  return (
    <div className="flex gap-3">
      <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>
        <p className="text-sm" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{title}</p>
        <p className="text-[0.8rem] opacity-70 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

export function MobilePurchaseBar({ visible = true, label, price, onClick, disabled = false }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined" || !visible) return null;

  const pickup = CONFIG.LOCAL_PICKUP || {};
  const pickupOn = pickup.ENABLED !== false;
  const noun = pickupOn ? "delivery and pickup details" : "delivery details";

  return createPortal(
    <div
      className="lg:hidden fixed left-0 right-0 z-40 px-3"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}
    >
      <div
        style={{
          background: "var(--bg-surface, #FFFFFF)",
          borderRadius: 22,
          border: "1px solid var(--border-default)",
          boxShadow: "0 -8px 30px rgba(26,22,18,0.18)",
          overflow: "hidden",
        }}
      >
        {/* Toggle — opens the drawer above the pinned button */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-4 px-5 py-4"
          style={{ color: "var(--text-primary)" }}
        >
          <span className="text-sm" style={{ fontWeight: 600 }}>
            {open ? `Hide ${noun}` : `Show ${noun}`}
          </span>
          <span style={{ flexShrink: 0 }}><Chevron open={open} /></span>
        </button>

        {/* Drawer — slides up (grows the sheet upward; button stays pinned) */}
        <div style={{ maxHeight: open ? 320 : 0, overflow: "hidden", transition: "max-height 0.3s ease" }}>
          <div className="px-5 pb-4 flex flex-col gap-3.5" style={{ borderTop: "1px solid var(--border-soft)" }}>
            {pickupOn && (
              <Row icon={<PinIcon />} title="Local pickup"
                body={`Available in ${pickup.AREA || "select areas"} — message Lusik to arrange.`} />
            )}
            <Row icon={<BoxIcon />} title="Free U.S. shipping"
              body={CONFIG.DELIVERY_NOTE || "Made to order — hand-stitched, then shipped to your door."} />
          </div>
        </div>

        {/* Pinned Add-to-Bag */}
        <div className="px-4 pt-3 pb-4" style={{ borderTop: "1px solid var(--border-soft)" }}>
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-disabled={disabled}
            className="w-full py-4 text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-2"
            style={{
              background: disabled ? "var(--bg-subtle)" : "var(--ink)",
              color: disabled ? "var(--text-muted)" : "var(--text-on-ink)",
              borderRadius: 999,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            {label} — ${price} <ArrowRight size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
