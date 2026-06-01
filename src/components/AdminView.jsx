"use client";

// ============================================================
// AdminView — Lusik's order dashboard + waitlists panel
// ============================================================
// Searchable, filterable list of orders. Click a row to open
// AdminOrderDetail. Top bar exposes View site / Sign out so
// Lusik can leave the admin area cleanly without back-button
// archaeology.
//
// Editing (status step buttons, tracking, admin message,
// finished-photo upload, internal notes) lives in
// AdminOrderDetail. Keeping the list lightweight lets a long
// list scroll smoothly on Lusik's phone.
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "../lib/db.js";
import { Skeleton } from "./Skeleton.jsx";
import { AdminOrderRow } from "./AdminOrderRow.jsx";
import { useToast } from "./ToastProvider.jsx";
import { ADMIN_FILTERS } from "./adminStatusLabels.js";

export function AdminView({ user, onBack, onOpenOrder, onSignOut }) {
  const toast = useToast();
  const [orders, setOrders] = useState(null); // null = loading
  const [filter, setFilter] = useState("all");
  const [query, setQuery]   = useState("");
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

  useEffect(() => { refresh(); }, [refresh]);
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

  // Pre-compute the lowercased search target for each order so the
  // search predicate doesn't rebuild the string on every keystroke.
  // Includes: order number, customer email, recipient name, ship-to
  // city/state, every item's product name + variant + selected
  // alphabet / layout / color refs / custom lines from custom_metadata.
  const haystackByOrder = useMemo(() => {
    const out = new Map();
    for (const o of orders ?? []) {
      const parts = [];
      parts.push(o.order_number || "");
      parts.push(o.customer_email || "");
      if (o.shipping_address) {
        parts.push(o.shipping_address.name || "");
        parts.push(o.shipping_address.city || "");
        parts.push(o.shipping_address.state ?? o.shipping_address.region ?? "");
      }
      if (o.tracking_number) parts.push(o.tracking_number);
      const items = o.item_summary ?? o.order_items ?? [];
      for (const it of items) {
        parts.push(it.product_name || "");
        parts.push(it.variant_label || "");
        const m = it.custom_metadata || {};
        parts.push(m.alphabet_key || "");
        parts.push(m.layout_key || "");
        parts.push(m.block_color_ref || "");
        parts.push(m.letter_color_ref || "");
        parts.push(m.custom_line_1 || "");
        parts.push(m.custom_line_2 || "");
        parts.push(m.color_preset_key || "");
      }
      out.set(o.id, parts.join(" ").toLowerCase());
    }
    return out;
  }, [orders]);

  // Per-chip counts. Computed every render — cheap since the array
  // is capped at 200 server-side and the filter predicates are
  // O(1) per row.
  const counts = useMemo(() => {
    const out = {};
    for (const f of ADMIN_FILTERS) {
      out[f.key] = (orders ?? []).filter(f.match).length;
    }
    return out;
  }, [orders]);

  const activeFilter = ADMIN_FILTERS.find((f) => f.key === filter) ?? ADMIN_FILTERS[0];
  const trimmedQuery = query.trim().toLowerCase();
  const filtered = (orders ?? [])
    .filter(activeFilter.match)
    .filter((o) => {
      if (!trimmedQuery) return true;
      const hay = haystackByOrder.get(o.id) ?? "";
      return hay.includes(trimmedQuery);
    });

  // CSV export — built client-side from the already-loaded
  // orders so we don't add a new endpoint. Downloaded as
  // lusik-orders-YYYY-MM-DD.csv. Useful for bookkeeping or
  // handing off to an accountant. Each cell is RFC-4180 escaped.
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
      {/* CROSS-NAV — clear way back to the customer site + sign-out.
          Sits above the page title so Lusik never feels stuck in the
          admin area. The old design hid this in a single "← Back"
          link; the bar treatment matches how operational dashboards
          typically expose their context switches. */}
      <div className="flex items-center justify-between gap-3 mb-8 flex-wrap text-[0.65rem] tracking-[0.2em] uppercase">
        <button
          onClick={onBack}
          className="opacity-70 hover:opacity-100 flex items-center gap-1.5"
          aria-label="View customer site"
        >
          ← View site
        </button>
        <div className="flex items-center gap-4 opacity-80">
          <span className="hidden sm:inline opacity-60">{user?.email}</span>
          {onSignOut && (
            <button onClick={onSignOut} className="opacity-70 hover:opacity-100" aria-label="Sign out">
              Sign out
            </button>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <p className="text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "var(--accent)" }}>Admin</p>
          <h1 className="font-display text-4xl lg:text-5xl" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>Orders.</h1>
        </div>
        <div className="flex gap-1.5 items-center flex-wrap">
          <button onClick={exportCsv} disabled={!orders || orders.length === 0}
            className="lg-button lg-pill px-3 py-1.5 text-[0.6rem] tracking-[0.2em] uppercase"
            style={{ color: "var(--text-primary)", fontWeight: 500 }}
            title="Download all orders as CSV (for bookkeeping / hand-off to an accountant)">
            ↓ CSV
          </button>
          <button onClick={refresh}
            className="lg-button lg-pill px-3 py-1.5 text-[0.6rem] tracking-[0.2em] uppercase"
            style={{ color: "var(--text-primary)", fontWeight: 500 }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* SEARCH */}
      <label className="block mb-4">
        <span className="text-[0.6rem] tracking-[0.25em] uppercase opacity-60 block mb-1.5">Search</span>
        <div className="lg-input">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Order #, customer name, email, alphabet, color, child name…"
            className="w-full bg-transparent outline-none px-3 py-2.5 text-sm"
          />
        </div>
      </label>

      {/* FILTER CHIPS — full pipeline with per-chip counts. */}
      <div className="flex gap-1.5 items-center flex-wrap mb-6">
        {ADMIN_FILTERS.map((f) => {
          const active = filter === f.key;
          const count  = counts[f.key] ?? 0;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={(active ? "lg-button-ink" : "lg-pill lg-button") + " px-3 py-1.5 text-[0.6rem] tracking-[0.2em] uppercase"}
              style={{
                fontWeight: 500,
                opacity: count === 0 && !active ? 0.55 : 1,
              }}
            >
              {f.label}
              <span className="ml-1.5 opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Waitlists panel — one row per product with at least one signup.
          Only renders when there's something to show; stays out of the
          way otherwise so Lusik's main view is still orders. */}
      {Array.isArray(waitlists) && waitlists.length > 0 && (
        <div className="lg-panel lg-panel-gold mb-8 p-5">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[0.6rem] tracking-[0.3em] uppercase" style={{ color: "var(--accent)", fontWeight: 600 }}>Waitlists</p>
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
            : trimmedQuery
              ? `No orders match "${query}" in the "${activeFilter.label}" filter.`
              : `No orders in the "${activeFilter.label}" filter.`}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <AdminOrderRow key={o.id} order={o} onOpen={onOpenOrder} />
          ))}
        </div>
      )}
    </div>
  );
}
