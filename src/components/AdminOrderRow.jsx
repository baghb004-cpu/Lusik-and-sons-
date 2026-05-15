// ============================================================
// AdminOrderRow — Lusik's admin editor for one order
// ============================================================
// Inline form: fulfillment_status dropdown, carrier + tracking
// number, estimated_ship_date, admin_notes textarea, finished-
// piece photo upload. Calls db.adminUpdateOrder /
// adminUploadOrderPhoto.
//
// MIRRORED FROM index.html (~line 8225).
// ============================================================

import React, { useState, useRef } from "react";
import { db } from "../lib/db.js";
import { useToast } from "./ToastProvider.jsx";

export function AdminOrderRow({ order, onSaved }) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInputRef = useRef(null);

  // Local edit-form state — initialized from the order. Reset on
  // every successful save so the form mirrors what the server now
  // holds.
  const [status, setStatus]           = useState(order.fulfillment_status ?? "awaiting_lusik");
  const [carrier, setCarrier]         = useState(order.carrier ?? "");
  const [tracking, setTracking]       = useState(order.tracking_number ?? "");
  const [shipDate, setShipDate]       = useState(order.estimated_ship_date ? order.estimated_ship_date.slice(0, 10) : "");
  const [notes, setNotes]             = useState(order.admin_notes ?? "");
  const [photoKey, setPhotoKey]       = useState(order.finished_photo_key ?? null);

  const isDirty = (
    status !== (order.fulfillment_status ?? "awaiting_lusik") ||
    (carrier ?? "") !== (order.carrier ?? "") ||
    (tracking ?? "") !== (order.tracking_number ?? "") ||
    shipDate !== (order.estimated_ship_date ? order.estimated_ship_date.slice(0, 10) : "") ||
    (notes ?? "") !== (order.admin_notes ?? "")
  );

  const handleSave = async () => {
    setBusy(true);
    const updates = {
      fulfillment_status:  status,
      carrier:             carrier || null,
      tracking_number:     tracking || null,
      estimated_ship_date: shipDate || null,
      admin_notes:         notes || null,
    };
    const { error } = await db.adminUpdateOrder(order.id, updates);
    setBusy(false);
    if (error) {
      toast({ kind: "error", message: error.message || "Couldn't save — please try again." });
      return;
    }
    toast({ kind: "success", message: `Saved · ${order.order_number}` });
    onSaved?.();
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    const { key, error } = await db.adminUploadOrderPhoto(order.id, file);
    setPhotoBusy(false);
    if (error || !key) {
      toast({ kind: "error", message: error?.message || "Couldn't upload that photo." });
      return;
    }
    setPhotoKey(key);
    toast({ kind: "success", message: "Finished photo uploaded — your customer can see it in their account now." });
    onSaved?.();
  };

  const statusLabel = ADMIN_STATUS_OPTIONS.find((o) => o.value === order.fulfillment_status)?.label ?? order.fulfillment_status;
  const orderDate = order.created_at ? new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  const ship = order.shipping_address;
  const photoUrl = photoKey ? `/.netlify/functions/order-photo-get?key=${encodeURIComponent(photoKey)}` : null;

  return (
    <div className="p-5 lg:p-6" style={{ border: "1px solid rgba(26,22,18,0.12)" }}>
      {/* SUMMARY ROW — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start justify-between gap-4 text-left"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap mb-1">
            <p className="font-display text-lg" style={{ fontWeight: 500 }}>{order.order_number}</p>
            <p className="text-xs opacity-60">{orderDate}</p>
            {order.gift?.is_gift && (
              <span className="text-[0.55rem] tracking-[0.18em] uppercase px-2 py-0.5" style={{ background: "rgba(176,136,66,0.15)", color: "#B08842", fontWeight: 500 }}>
                Gift
              </span>
            )}
          </div>
          <p className="text-xs opacity-70 truncate">
            {order.customer_email}
            {ship && <span> · {ship.city}, {ship.state ?? ship.region}</span>}
            <span> · {order.item_count} item{order.item_count === 1 ? "" : "s"}</span>
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[0.65rem] tracking-[0.2em] uppercase opacity-70 mb-1" style={{ color: "#B08842", fontWeight: 500 }}>{statusLabel}</p>
          <p className="text-sm" style={{ fontWeight: 500 }}>${(order.total_cents / 100).toFixed(2)}</p>
        </div>
      </button>

      {expanded && (
        <div className="mt-5 pt-5 space-y-5" style={{ borderTop: "1px solid rgba(26,22,18,0.08)" }}>
          {/* SHIPPING ADDRESS */}
          {ship && (
            <div>
              <p className="text-[0.6rem] tracking-[0.25em] uppercase opacity-60 mb-1.5">Ship to</p>
              <p className="text-sm leading-relaxed">
                {ship.line1 ?? ship.address_line1}
                {(ship.line2 ?? ship.address_line2) && <><br />{ship.line2 ?? ship.address_line2}</>}
                <br />
                {ship.city}, {ship.state ?? ship.region} {ship.postal_code ?? ship.zip}
                {ship.country && <> · {ship.country}</>}
              </p>
            </div>
          )}

          {/* GIFT OPTIONS — surfaced prominently because they actually
              affect how Lusik packs the box. */}
          {order.gift?.is_gift && (
            <div className="p-3" style={{ background: "rgba(176,136,66,0.08)", border: "1px solid rgba(176,136,66,0.25)" }}>
              <p className="text-[0.6rem] tracking-[0.25em] uppercase mb-1.5" style={{ color: "#B08842" }}>This is a gift</p>
              {order.gift.message && (
                <p className="text-sm leading-relaxed italic mb-2" style={{ background: "var(--bg-surface)", padding: "0.5rem 0.75rem", border: "1px solid var(--border-default)" }}>
                  "{order.gift.message}"
                </p>
              )}
              {order.gift.wrap && (
                <p className="text-xs opacity-80 mb-1" style={{ fontWeight: 500 }}>
                  ★ Customer added gift wrap — tissue + twine before shipping.
                </p>
              )}
              {order.gift.hide_prices && (
                <p className="text-xs opacity-80" style={{ fontWeight: 500 }}>
                  ⚠️ Customer asked: <span className="opacity-100">do NOT include prices on the packing slip.</span>
                </p>
              )}
            </div>
          )}

          {/* SOCIAL-SHARE CONSENT */}
          {order.social_consent?.allowed && (
            <div className="text-xs opacity-80 leading-relaxed">
              <p className="opacity-70 mb-1">
                Customer opted in to social-media sharing on:{" "}
                <span style={{ fontWeight: 500 }}>
                  {Array.isArray(order.social_consent.platforms) ? order.social_consent.platforms.join(", ") : ""}
                </span>
              </p>
              {order.social_consent.handles && Object.keys(order.social_consent.handles).length > 0 && (
                <p className="opacity-70">
                  Handles —{" "}
                  {Object.entries(order.social_consent.handles).map(([k, v]) => (
                    <span key={k}>{k}: <span style={{ fontWeight: 500 }}>{v}</span> · </span>
                  ))}
                </p>
              )}
            </div>
          )}

          {/* EDIT FORM */}
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[0.6rem] tracking-[0.25em] uppercase opacity-70 block mb-1.5">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[rgba(176,136,66,0.4)]"
                style={{ border: "1px solid rgba(26,22,18,0.2)" }}>
                {ADMIN_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[0.6rem] tracking-[0.25em] uppercase opacity-70 block mb-1.5">Carrier</span>
              <select value={carrier ?? ""} onChange={(e) => setCarrier(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[rgba(176,136,66,0.4)]"
                style={{ border: "1px solid rgba(26,22,18,0.2)" }}>
                {ADMIN_CARRIER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[0.6rem] tracking-[0.25em] uppercase opacity-70 block mb-1.5">Tracking number</span>
              <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. 9400 1234 5678 ..."
                className="w-full px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[rgba(176,136,66,0.4)]"
                style={{ border: "1px solid rgba(26,22,18,0.2)" }} />
            </label>
            <label className="block">
              <span className="text-[0.6rem] tracking-[0.25em] uppercase opacity-70 block mb-1.5">Estimated ship date</span>
              <input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[rgba(176,136,66,0.4)]"
                style={{ border: "1px solid rgba(26,22,18,0.2)" }} />
            </label>
          </div>
          <label className="block">
            <span className="text-[0.6rem] tracking-[0.25em] uppercase opacity-70 block mb-1.5">Internal notes <span className="normal-case tracking-normal opacity-70">(only Lusik sees these)</span></span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[rgba(176,136,66,0.4)] resize-none"
              style={{ border: "1px solid rgba(26,22,18,0.2)" }} />
          </label>

          {/* FINISHED-PIECE PHOTO */}
          <div>
            <p className="text-[0.6rem] tracking-[0.25em] uppercase opacity-70 mb-2">Finished-piece photo</p>
            <div className="flex items-start gap-4 flex-wrap">
              {photoUrl ? (
                <a href={photoUrl} target="_blank" rel="noopener noreferrer" className="block flex-shrink-0">
                  <img src={photoUrl} alt="Current finished-piece photo" className="w-24 h-24 object-cover" style={{ border: "1px solid rgba(26,22,18,0.15)" }} loading="lazy" decoding="async" />
                </a>
              ) : (
                <div className="w-24 h-24 flex items-center justify-center text-[0.6rem] tracking-[0.15em] uppercase opacity-50" style={{ border: "1px dashed rgba(26,22,18,0.25)" }}>
                  No photo yet
                </div>
              )}
              <div className="flex-1 min-w-[200px]">
                <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhoto} className="hidden" />
                <button onClick={() => photoInputRef.current?.click()} disabled={photoBusy}
                  className="px-4 py-2 text-[0.65rem] tracking-[0.2em] uppercase mb-2"
                  style={{ background: "var(--ink)", color: "var(--text-on-ink)", fontWeight: 500, opacity: photoBusy ? 0.5 : 1 }}>
                  {photoBusy ? "Uploading…" : (photoUrl ? "Replace photo" : "Upload photo")}
                </button>
                <p className="text-[0.65rem] opacity-60 leading-relaxed italic">
                  The customer sees this in their order history. PNG / JPEG / WebP. Replacing keeps the old one in storage but only shows the newest.
                </p>
              </div>
            </div>
          </div>

          {/* SAVE BAR */}
          <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid rgba(26,22,18,0.06)" }}>
            <button onClick={() => setExpanded(false)} className="text-[0.65rem] tracking-[0.2em] uppercase opacity-60 hover:opacity-100">
              Close
            </button>
            <button onClick={handleSave} disabled={!isDirty || busy}
              className="px-5 py-2.5 text-[0.65rem] tracking-[0.2em] uppercase transition"
              style={{
                background: (!isDirty || busy) ? "rgba(26,22,18,0.3)" : "#1A1612",
                color: "#F5EFE3",
                fontWeight: 500,
                cursor: (!isDirty || busy) ? "not-allowed" : "pointer",
              }}>
              {busy ? "Saving…" : (isDirty ? "Save changes" : "Saved")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
