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

// How often to refetch order history while the account page is open
// AND the tab is visible. Lusik's status changes and admin messages
// land on the customer's view through this poll. 45s strikes a
// balance: feels live enough for a Domino's-tracker-style UX without
// burning the Functions free-tier quota.
const POLL_MS = 45000;

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
    let pollTimer       = null; // post-checkout fast poll for the new order
    let livePollTimer   = null; // slow "Domino's tracker" poll for status updates
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

    // Light refetch — used by the visibility/focus listeners and the
    // slow background poll. Does NOT touch loading state so the UI
    // doesn't flicker back to skeletons mid-session.
    const refetchLive = async () => {
      if (!mounted) return;
      try {
        const { orders: rows } = await db.listOrders();
        if (mounted && Array.isArray(rows)) setOrders(rows);
      } catch {}
    };

    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        refetchLive();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("focus", refetchLive);
    }

    // Slow background poll. setInterval keeps a stable cadence; the
    // visibility check inside short-circuits when the tab is hidden
    // so a backgrounded tab doesn't burn requests.
    livePollTimer = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        refetchLive();
      }
    }, POLL_MS);

    fetchOnce();
    return () => {
      mounted = false;
      if (pollTimer     !== null) clearTimeout(pollTimer);
      if (livePollTimer !== null) clearInterval(livePollTimer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("focus", refetchLive);
      }
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
