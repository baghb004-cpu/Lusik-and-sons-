// ============================================================
// OrderHistory — list of the customer's orders
// ============================================================
// Polls listOrders on mount; renders an OrderCard for each.
// Post-checkout polling logic (refetch a couple of times after
// a Stripe return) is handled by the parent (AccountView).
//
// MIRRORED FROM index.html (~line 7641).
// ============================================================

import React, { useState, useEffect } from "react";
import { db } from "../lib/db.js";
import { Skeleton } from "./Skeleton.jsx";
import { OrderCard } from "./OrderCard.jsx";

export function OrderHistory({ userId, onReorder }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pollingForOrder, setPollingForOrder] = useState(false);

  // Detect post-checkout return from URL
  const justCheckedOut = (() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("order") === "success";
  })();

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    let attempts = 0;
    let pollTimer = null;
    const maxAttempts = justCheckedOut ? 6 : 1;
    const pollDelay = 2500;

    const fetchOnce = async () => {
      attempts += 1;
      // Try to claim any guest orders first (idempotent, cheap)
      if (attempts === 1) {
        await db.linkGuestOrders().catch(() => {});
      }
      const { orders: rows } = await db.listOrders();
      if (!mounted) return;
      setOrders(rows);
      setLoading(false);

      // If we're polling for a fresh order and didn't see one yet, retry.
      if (justCheckedOut && rows.length === 0 && attempts < maxAttempts) {
        setPollingForOrder(true);
        pollTimer = setTimeout(fetchOnce, pollDelay);
      } else {
        setPollingForOrder(false);
        // Strip the URL param once we've found the order, so a refresh
        // doesn't keep polling.
        if (justCheckedOut && rows.length > 0 && typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.delete("order");
          url.searchParams.delete("session_id");
          window.history.replaceState({}, "", url.toString());
        }
      }
    };

    fetchOnce();
    return () => {
      mounted = false;
      // Cancel any pending poll so the timer doesn't fire after
      // unmount (would log a stale 401 on db.listOrders if the user
      // signed out mid-poll).
      if (pollTimer !== null) clearTimeout(pollTimer);
    };
  }, [userId]);

  if (loading) {
    // Skeleton placeholders shaped like OrderCard so the layout
    // doesn't jump when the real data arrives.
    return (
      <div className="space-y-4">
        {[0, 1].map((i) => (
          <div key={i} className="p-5 lg:p-6" style={{ border: "1px solid rgba(26,22,18,0.08)" }}>
            <div className="flex items-start justify-between mb-4 gap-3">
              <div className="flex-1">
                <Skeleton className="w-32 h-4 mb-2" />
                <Skeleton className="w-24 h-3" />
              </div>
              <div className="text-right">
                <Skeleton className="w-20 h-3 mb-2 ml-auto" />
                <Skeleton className="w-16 h-4 ml-auto" />
              </div>
            </div>
            <Skeleton className="w-full h-6 mb-4" />
            <div className="space-y-2">
              <Skeleton className="w-3/4 h-3" />
              <Skeleton className="w-1/2 h-3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (pollingForOrder && orders.length === 0) {
    return (
      <div className="p-5" style={{ background: "rgba(176,136,66,0.08)", border: "1px solid rgba(176,136,66,0.3)" }}>
        <p className="text-sm leading-relaxed">
          <span style={{ fontWeight: 500, color: "#B08842" }}>Thank you for your order!</span> We're confirming the details with Stripe — this usually takes a few seconds. Hold tight.
        </p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <p className="text-sm opacity-60 italic max-w-md leading-relaxed">
        No orders yet. When Lusik finishes your blanket and ships it, your order history will appear here — with tracking, photos of the finished piece, and care instructions.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((o) => <OrderCard key={o.id} order={o} onReorder={onReorder} />)}
    </div>
  );
}
