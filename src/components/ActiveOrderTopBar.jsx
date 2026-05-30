"use client";

// ============================================================
// ActiveOrderTopBar — top banner that swaps between announce
// string and "your order is shipped → track" for signed-in
// customers with a live order
// ============================================================
// For signed-out / no-order users it just renders the
// announcement strap. For signed-in users with an active order
// (status ∈ ACTIVE_ORDER_STATUSES) it becomes a clickable bar
// that takes them to their account view to track the order.
//
// MIRRORED FROM index.html (~line 8826). The two helpers
// (ACTIVE_ORDER_STATUSES + statusToActiveBarMessage) co-locate
// with the component since they're only used here.
// ============================================================

import React, { useState, useEffect } from "react";
import { db } from "../lib/db.js";
import { useT } from "../i18n/LangContext.jsx";

const ACTIVE_ORDER_STATUSES = ["awaiting_lusik", "in_production", "quality_check", "ready_to_ship", "shipped"];

function statusToActiveBarMessage(status) {
  switch (status) {
    case "awaiting_lusik": return "Lusik has your order — she'll begin in a day or two.";
    case "in_production":  return "Lusik's hands are on your piece.";
    case "quality_check":  return "Final stitches — Lusik is checking it over.";
    case "ready_to_ship":  return "Your piece is folded, boxed, and ready to ship.";
    case "shipped":        return "On its way to you — track when you're ready.";
    default:               return null;
  }
}

export function ActiveOrderTopBar({ user, onOpenAccount }) {
  const t = useT();
  const [activeOrder, setActiveOrder] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Refetch when the user changes (sign-in, sign-out). Guests
  // skip the call entirely — no point fetching orders for a
  // logged-out browser session.
  useEffect(() => {
    if (!user?.id) { setActiveOrder(null); setLoaded(true); return; }
    let cancelled = false;
    db.listOrders().then(({ orders }) => {
      if (cancelled) return;
      const active = (orders ?? []).find((o) => ACTIVE_ORDER_STATUSES.includes(o.fulfillment_status));
      setActiveOrder(active ?? null);
      setLoaded(true);
    }).catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [user?.id]);

  // Until we know whether the user has an active order, render
  // the plain announce string so the bar doesn't flash twice.
  const message = activeOrder ? statusToActiveBarMessage(activeOrder.fulfillment_status) : null;

  if (!user || !loaded || !message) {
    return (
      <div className="text-center py-2.5 text-xs tracking-[0.2em] uppercase" style={{ background: "var(--ink)", color: "var(--text-on-ink)" }}>
        {t("announce")}
      </div>
    );
  }

  return (
    <button
      onClick={onOpenAccount}
      className="w-full text-center py-2.5 text-xs tracking-[0.15em] transition hover:opacity-90"
      style={{ background: "var(--ink)", color: "var(--text-on-ink)" }}
      aria-label={`${message} View your order.`}
    >
      <span style={{ color: "#C9A678", fontWeight: 500 }}>★ </span>
      <span>{message}</span>
      <span className="opacity-70"> · {activeOrder.order_number}</span>
      <span className="ml-2 underline opacity-80">view →</span>
    </button>
  );
}
