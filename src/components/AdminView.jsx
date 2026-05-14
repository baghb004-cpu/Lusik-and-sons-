// ============================================================
// AdminView — Lusik's order dashboard + waitlists panel
// ============================================================
// Lists orders (with filtering by fulfillment_status), renders
// one AdminOrderRow per. Also includes WaitlistsPanel inline
// (per-product pending/notified counts + Notify buttons) and
// a CSV-export of the orders table.
//
// MIRRORED FROM index.html (~line 8465).
// ============================================================

import React, { useState, useEffect, useCallback } from "react";
import { db } from "../lib/db.js";
import { Skeleton } from "./Skeleton.jsx";
import { AdminOrderRow } from "./AdminOrderRow.jsx";
import { useToast } from "./ToastProvider.jsx";

export function AdminView({ user, onBack }) {
  const toast = useToast();
  const [orders, setOrders] = useState(null); // null = loading
  const [filter, setFilter] = useState("all");
  // Waitlists summary — null while loading, [] when there are no signups
  // yet. Loaded once on mount; refreshed locally after each Notify click.
  const [waitlists, setWaitlists] = useState(null);
  const [notifyingKey, setNotifyingKey] = useState(null);

  const refresh = useCallback(async () => {
    const { orders: rows, error } = await db.adminListOrders();
    if (error) {
      toast({ kind: "error", message: error.message || "Couldn't load orders." });
      setOrders([]);
      return;
    }
    setOrders(rows);
  }, [toast]);

  const refreshWaitlists = useCallback(async () => {
    const { items, error } = await db.adminListWaitlists();
    if (error) {
      console.warn("[admin] waitlist load failed:", error.message);
      setWaitlists([]);
      return;
    }
    setWaitlists(items);
  }, []);

  useEffect(() => { refreshWaitlists(); }, [refreshWaitlists]);

  const handleNotifyWaitlist = async (entry) => {
    if (entry.pending === 0) return;
    if (!confirm(`Send ${entry.pending} ${entry.product_name || entry.product_key} waitlist email${entry.pending === 1 ? "" : "s"} now? Each recipient gets one email saying the product is ready.`)) {
      return;
    }
    setNotifyingKey(entry.product_key);
    const { sent, failed, remaining, error } = await db.adminNotifyWaitlist({
      product_key:  entry.product_key,
      product_name: entry.product_name || entry.product_key,
      product_url:  `${window.location.origin}/`,
    });
    setNotifyingKey(null);
    if (error) {
      toast({ kind: "error", message: error.message || "Couldn't send the waitlist notification." });
      return;
    }
    if (sent > 0) {
      toast({
        kind: "success",
        message: failed > 0
          ? `Sent ${sent}. ${failed} failed — they'll retry next click. ${remaining} still pending.`
          : (remaining > 0
              ? `Sent ${sent}. ${remaining} more remain — click Notify again to send the next batch.`
              : `Sent ${sent}. Waitlist cleared.`),
      });
    } else {
      toast({ kind: "error", message: `No emails went out (${failed} failed). Try again or check the function logs.` });
    }
    refreshWaitlists();
  };

  useEffect(() => { refresh(); }, [refresh]);

  // Tiny filter buttons — "all" plus the two most-actionable
  // states for Lusik: in-progress (anything she still needs to
  // touch) and shipped (where she might need to look up a
  // tracking issue).
  const filtered = (orders ?? []).filter((o) => {
    if (filter === "all")        return true;
    if (filter === "in_progress") return ["awaiting_lusik", "in_production", "quality_check", "ready_to_ship"].includes(o.fulfillment_status);
    if (filter === "shipped")    return ["shipped", "delivered"].includes(o.fulfillment_status);
    return true;
  });

  // CSV export — built client-side from the already-loaded
  // orders so we don't add a new endpoint. Downloaded as
  // lusik-orders-YYYY-MM-DD.csv. Useful for bookkeeping or
  // handing off to an accountant.
  //
  // Each cell is escaped per RFC 4180: wrap in double quotes
  // and double up internal quotes. This handles commas, line
  // breaks, and quote chars in customer-supplied fields like
  // gift messages or admin notes without producing malformed
  // rows.
  const csvCell = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const exportCsv = () => {
    if (!orders || orders.length === 0) {
      toast({ kind: "info", message: "No orders to export yet." });
      return;
    }
    const columns = [
      ["Order #",    (o) => o.order_number],
      ["Date",       (o) => o.created_at ? new Date(o.created_at).toISOString() : ""],
      ["Status",     (o) => o.fulfillment_status],
      ["Customer",   (o) => o.customer_email],
      ["Recipient",  (o) => o.shipping_address?.name ?? ""],
      ["Ship to",    (o) => {
        const a = o.shipping_address;
        if (!a) return "";
        return [a.line1 ?? a.address_line1, a.line2 ?? a.address_line2, a.city, a.state ?? a.region, a.postal_code ?? a.zip, a.country]
          .filter(Boolean).join(", ");
      }],
      ["Subtotal",   (o) => ((o.subtotal_cents ?? 0) / 100).toFixed(2)],
      ["Shipping",   (o) => ((o.shipping_cents ?? 0) / 100).toFixed(2)],
      ["Tax",        (o) => ((o.tax_cents ?? 0) / 100).toFixed(2)],
      ["Total",      (o) => ((o.total_cents ?? 0) / 100).toFixed(2)],
      ["Carrier",    (o) => o.carrier ?? ""],
      ["Tracking",   (o) => o.tracking_number ?? ""],
      ["Shipped at", (o) => o.shipped_at ? new Date(o.shipped_at).toISOString() : ""],
      ["Gift",       (o) => o.gift?.is_gift ? "yes" : ""],
      ["Gift msg",   (o) => o.gift?.message ?? ""],
      ["Admin notes",(o) => o.admin_notes ?? ""],
    ];
    const header = columns.map(([h]) => csvCell(h)).join(",");
    const rows   = orders.map((o) => columns.map(([, fn]) => csvCell(fn(o))).join(","));
    const csv    = [header, ...rows].join("\r\n");
    const blob   = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    const today  = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `lusik-orders-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ kind: "success", message: `Exported ${orders.length} order${orders.length === 1 ? "" : "s"}.` });
  };

  return (
    <div className="fade-in max-w-5xl mx-auto px-6 lg:px-12 py-10 lg:py-16">
      <button onClick={onBack} className="text-xs tracking-[0.2em] uppercase opacity-60 hover:opacity-100 flex items-center gap-2 mb-6">
        ← Back to site
      </button>
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <p className="text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "#B08842" }}>Admin</p>
          <h1 className="font-display text-4xl lg:text-5xl" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>Orders.</h1>
          <p className="text-sm opacity-70 mt-1">{user?.email}</p>
        </div>
        <div className="flex gap-1.5 items-center flex-wrap">
          {[
            { key: "all",          label: "All" },
            { key: "in_progress",  label: "In progress" },
            { key: "shipped",      label: "Shipped" },
          ].map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className="px-3 py-2 text-[0.6rem] tracking-[0.2em] uppercase transition"
              style={{
                background: filter === f.key ? "#1A1612" : "transparent",
                color:      filter === f.key ? "#F5EFE3" : "rgba(26,22,18,0.7)",
                border:     filter === f.key ? "1px solid #1A1612" : "1px solid rgba(26,22,18,0.2)",
                fontWeight: 500,
              }}>
              {f.label}
            </button>
          ))}
          <span className="opacity-30 mx-1 hidden sm:inline">|</span>
          <button onClick={exportCsv} disabled={!orders || orders.length === 0}
            className="px-3 py-2 text-[0.6rem] tracking-[0.2em] uppercase transition hover:opacity-80 disabled:opacity-30"
            style={{ border: "1px solid rgba(26,22,18,0.2)", color: "#1A1612", fontWeight: 500 }}
            title="Download all orders as CSV (for bookkeeping / hand-off to an accountant)">
            ↓ CSV
          </button>
        </div>
      </div>

      {/* Waitlists panel — one row per product with at least one signup.
          Only renders when there's something to show; stays out of the
          way otherwise so Lusik's main view is still orders. */}
      {Array.isArray(waitlists) && waitlists.length > 0 && (
        <div className="mb-8 p-5" style={{ border: "1px solid rgba(176,136,66,0.3)", background: "rgba(176,136,66,0.05)" }}>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[0.6rem] tracking-[0.3em] uppercase" style={{ color: "#B08842", fontWeight: 600 }}>Waitlists</p>
            <p className="text-[0.65rem] opacity-60 italic">Click Notify when a product goes live.</p>
          </div>
          <div className="space-y-2">
            {waitlists.map((w) => (
              <div key={w.product_key} className="flex items-center justify-between gap-3 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm" style={{ fontWeight: 500 }}>
                    {w.product_name || w.product_key}
                  </p>
                  <p className="text-xs opacity-65">
                    {w.pending} waiting{w.notified > 0 ? ` · ${w.notified} already notified` : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleNotifyWaitlist(w)}
                  disabled={w.pending === 0 || notifyingKey === w.product_key}
                  className="px-3 py-2 text-[0.6rem] tracking-[0.2em] uppercase transition disabled:opacity-30"
                  style={{
                    border: "1px solid #1A1612",
                    background: w.pending > 0 ? "#1A1612" : "transparent",
                    color: w.pending > 0 ? "#F5EFE3" : "#1A1612",
                    fontWeight: 500,
                    cursor: w.pending === 0 ? "not-allowed" : "pointer",
                  }}
                  title={w.pending === 0 ? "Nobody pending on this list" : `Email ${w.pending} recipient${w.pending === 1 ? "" : "s"}`}
                >
                  {notifyingKey === w.product_key ? "Sending…" : (w.pending === 0 ? "Cleared" : `Notify ${w.pending}`)}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {orders === null ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="p-5" style={{ border: "1px solid rgba(26,22,18,0.08)" }}>
              <Skeleton className="w-32 h-4 mb-2" />
              <Skeleton className="w-3/4 h-3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm opacity-60 italic">
          {orders.length === 0
            ? "No orders yet. When the first paid checkout lands, it'll appear here."
            : `No orders match the "${filter.replace(/_/g, " ")}" filter.`}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <AdminOrderRow key={o.id} order={o} onSaved={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
