"use client";

// ============================================================
// AdminOrderDetail — single-order admin editor (full screen)
// ============================================================
// Replaces the inline edit form that used to live inside
// AdminOrderRow. Loads the order on mount via db.adminGetOrder
// so we have full line-item metadata for custom-embroidery
// orders.
//
// Three editing surfaces, top to bottom:
//   1. STEP BUTTONS — one-click pipeline advance (Domino's-style).
//      Each button issues a PUT that sets fulfillment_status to
//      the next stage. The backend stamps confirmed_at on the
//      first non-in_progress transition and shipped_at on the
//      first "shipped" save (which also fires the shipped email).
//   2. MESSAGE TO CUSTOMER — a textarea whose contents are written
//      to orders.admin_message. The customer sees this on their
//      order card. Useful for "Running 2 days late, finishing
//      tomorrow" type updates without firing an email.
//   3. SHIPPING + INTERNAL — carrier, tracking, est. ship date,
//      internal-only admin_notes, finished-piece photo upload.
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import { db } from "../lib/db.js";
import { useToast } from "./ToastProvider.jsx";
import { Skeleton } from "./Skeleton.jsx";
import {
  ADMIN_STATUS_OPTIONS,
  ADMIN_CARRIER_OPTIONS,
  STATUS_LABEL,
  STAGES,
  statusToStageIndex,
  nextStatus,
  statusAccent,
} from "./adminStatusLabels.js";

export function AdminOrderDetail({ orderId, onBack, onViewSite, onSignOut }) {
  const toast = useToast();
  const [order, setOrder] = useState(null);    // null = loading, undefined = error
  const [savingStep, setSavingStep] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInputRef = useRef(null);

  // Local edit-form state — hydrated from the loaded order. Each
  // save resets these from the server response so we never drift
  // from the canonical row.
  const [status, setStatus]       = useState("in_progress");
  const [carrier, setCarrier]     = useState("");
  const [tracking, setTracking]   = useState("");
  const [shipDate, setShipDate]   = useState("");
  const [notes, setNotes]         = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [savingForm, setSavingForm] = useState(false);

  const reload = async () => {
    const { order: o, error } = await db.adminGetOrder(orderId);
    if (error || !o) {
      toast({ kind: "error", message: error?.message || "Couldn't load that order." });
      setOrder(undefined);
      return;
    }
    setOrder(o);
    setStatus(o.fulfillment_status ?? "in_progress");
    setCarrier(o.carrier ?? "");
    setTracking(o.tracking_number ?? "");
    setShipDate(o.estimated_ship_date ? String(o.estimated_ship_date).slice(0, 10) : "");
    setNotes(o.admin_notes ?? "");
    setAdminMessage(o.admin_message ?? "");
  };

  useEffect(() => {
    if (!orderId) return;
    setOrder(null);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // One-click pipeline advance. Used by the step buttons. The
  // backend handles confirmed_at + shipped_at stamping + the
  // shipped-notification email.
  const advanceTo = async (newStatus, friendlyName) => {
    if (savingStep) return;
    setSavingStep(true);
    const { order: updated, error } = await db.adminUpdateOrder(orderId, {
      fulfillment_status: newStatus,
    });
    setSavingStep(false);
    if (error) {
      toast({ kind: "error", message: error.message || "Couldn't update — please try again." });
      return;
    }
    toast({ kind: "success", message: `Order marked "${friendlyName}". The customer's tracker will pick this up on their next refresh.` });
    if (updated) {
      setOrder(updated);
      setStatus(updated.fulfillment_status ?? newStatus);
    } else {
      reload();
    }
  };

  // Full-form save: tracking, ship date, internal notes, and the
  // public admin_message. Status is changed via the step buttons,
  // not this form, so a fat-finger doesn't reset the pipeline.
  const handleFormSave = async () => {
    if (savingForm) return;
    setSavingForm(true);
    const { order: updated, error } = await db.adminUpdateOrder(orderId, {
      carrier:             carrier || null,
      tracking_number:     tracking || null,
      estimated_ship_date: shipDate || null,
      admin_notes:         notes || null,
      admin_message:       adminMessage || null,
    });
    setSavingForm(false);
    if (error) {
      toast({ kind: "error", message: error.message || "Couldn't save — please try again." });
      return;
    }
    toast({ kind: "success", message: "Saved." });
    if (updated) {
      setOrder(updated);
      setAdminMessage(updated.admin_message ?? "");
    } else {
      reload();
    }
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    const { key, error } = await db.adminUploadOrderPhoto(orderId, file);
    setPhotoBusy(false);
    if (error || !key) {
      toast({ kind: "error", message: error?.message || "Couldn't upload that photo." });
      return;
    }
    toast({ kind: "success", message: "Finished photo uploaded — your customer can see it now." });
    reload();
  };

  if (order === null) {
    return (
      <div className="fade-in max-w-3xl mx-auto px-6 lg:px-12 py-10 lg:py-16">
        <Skeleton className="w-32 h-3 mb-6" />
        <Skeleton className="w-2/3 h-8 mb-3" />
        <Skeleton className="w-1/2 h-3 mb-8" />
        <div className="space-y-3">
          <Skeleton className="w-full h-10" />
          <Skeleton className="w-full h-32" />
        </div>
      </div>
    );
  }

  if (order === undefined) {
    return (
      <div className="fade-in max-w-3xl mx-auto px-6 lg:px-12 py-10 lg:py-16">
        <button onClick={onBack} className="text-[0.65rem] tracking-[0.2em] uppercase opacity-70 hover:opacity-100">← Back to orders</button>
        <p className="mt-6 text-sm opacity-70 italic">Couldn't load that order.</p>
      </div>
    );
  }

  const stageIndex = statusToStageIndex(status);
  const stepNext   = nextStatus(status);
  const orderDate  = order.created_at ? new Date(order.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "";
  const ship       = order.shipping_address;
  const accent     = statusAccent({ ...order, fulfillment_status: status });
  const photoUrl   = order.finished_photo_key
    ? `/.netlify/functions/order-photo-get?key=${encodeURIComponent(order.finished_photo_key)}`
    : null;

  return (
    <div className="fade-in max-w-3xl mx-auto px-6 lg:px-12 py-10 lg:py-16">
      {/* CROSS-NAV BAR */}
      <div className="flex items-center justify-between gap-3 mb-8 flex-wrap text-[0.65rem] tracking-[0.2em] uppercase">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="opacity-70 hover:opacity-100" aria-label="Back to orders">← Orders</button>
          {onViewSite && (
            <button onClick={onViewSite} className="opacity-70 hover:opacity-100" aria-label="View customer site">View site</button>
          )}
        </div>
        {onSignOut && (
          <button onClick={onSignOut} className="opacity-70 hover:opacity-100">Sign out</button>
        )}
      </div>

      {/* HEADER */}
      <p className="text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "#B08842" }}>Order</p>
      <h1 className="font-display text-3xl lg:text-4xl mb-1" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>{order.order_number}</h1>
      <p className="text-sm opacity-70">{orderDate}</p>
      <div className="mt-3 flex items-center gap-3 flex-wrap text-[0.65rem] tracking-[0.2em] uppercase">
        <span style={{ color: accent, fontWeight: 600 }}>{STATUS_LABEL[status] ?? status}</span>
        <span className="opacity-50">·</span>
        <span style={{ fontWeight: 500 }}>${(order.total_cents / 100).toFixed(2)}</span>
        {order.gift?.is_gift && <span className="px-2 py-0.5" style={{ background: "rgba(176,136,66,0.15)", color: "#B08842", fontWeight: 500 }}>Gift</span>}
        {order.status === "refunded" && <span className="px-2 py-0.5" style={{ background: "rgba(139,44,44,0.10)", color: "#8B2C2C", fontWeight: 500 }}>Refunded</span>}
        {order.status === "partially_refunded" && <span className="px-2 py-0.5" style={{ background: "rgba(139,44,44,0.10)", color: "#8B2C2C", fontWeight: 500 }}>Partial refund</span>}
      </div>

      {/* PIPELINE STEPS — the Domino's-tracker control surface */}
      <section className="lg-panel lg-panel-gold mt-8 mb-10 p-5">
        <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-3" style={{ color: "#B08842", fontWeight: 600 }}>Status</p>
        <ol className="flex items-center gap-1 sm:gap-2 mb-4 overflow-x-auto pb-1">
          {STAGES.map((s, i) => {
            const done   = i < stageIndex;
            const here   = i === stageIndex;
            const dotBg  = done || here ? "#B08842" : "rgba(26,22,18,0.18)";
            const labelC = done || here ? "#1A1612" : "rgba(26,22,18,0.5)";
            return (
              <li key={s.key} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <span className="inline-flex items-center justify-center rounded-full" style={{ width: 18, height: 18, background: dotBg, color: "#F5EFE3", fontSize: 10, fontWeight: 600 }}>{i + 1}</span>
                <span className="text-[0.6rem] tracking-[0.15em] uppercase whitespace-nowrap" style={{ color: labelC, fontWeight: here ? 600 : 400 }}>{s.label}</span>
                {i < STAGES.length - 1 && <span className="opacity-30">›</span>}
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap gap-2">
          {/* "Confirm" + every advance button. Disabled if already at
              or past that stage, or while a save is in flight. The
              labels here are the human-readable verbs Lusik clicks. */}
          {stepNext && (
            <button
              onClick={() => advanceTo(stepNext, STATUS_LABEL[stepNext])}
              disabled={savingStep}
              className="lg-button-ink lg-shine px-4 py-2.5 text-[0.65rem] tracking-[0.2em] uppercase"
              style={{ fontWeight: 500 }}
              data-testid="admin-step-next"
            >
              {savingStep ? "Updating…" : (
                stageIndex < 0 ? `Confirm order →` :
                stepNext === "awaiting_lusik" ? "Confirm order →" :
                stepNext === "in_production"  ? "Start stitching →" :
                stepNext === "quality_check"  ? "Move to final review →" :
                stepNext === "ready_to_ship"  ? "Mark ready to ship →" :
                stepNext === "shipped"        ? "Mark shipped →" :
                stepNext === "delivered"      ? "Mark delivered →" :
                `Move to ${STATUS_LABEL[stepNext]} →`
              )}
            </button>
          )}
          {!stepNext && stageIndex >= 0 && (
            <p className="text-xs opacity-60 italic self-center">This order is at the end of the pipeline.</p>
          )}
          <label className="lg-pill inline-flex items-center gap-2 px-3 py-1.5 text-[0.6rem] tracking-[0.2em] uppercase">
            <span className="opacity-70">Or jump to:</span>
            <select
              value={status}
              onChange={(e) => advanceTo(e.target.value, STATUS_LABEL[e.target.value] ?? e.target.value)}
              disabled={savingStep}
              className="bg-transparent outline-none"
              style={{ fontWeight: 500 }}
            >
              {ADMIN_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        {order.confirmed_at && (
          <p className="text-[0.65rem] opacity-55 mt-3">
            Confirmed {new Date(order.confirmed_at).toLocaleString()}
          </p>
        )}
        {order.shipped_at && (
          <p className="text-[0.65rem] opacity-55">
            Shipped {new Date(order.shipped_at).toLocaleString()}
            {order.tracking_number ? ` · ${order.carrier ?? ""} ${order.tracking_number}` : ""}
          </p>
        )}
      </section>

      {/* PUBLIC MESSAGE TO CUSTOMER */}
      <section className="mb-10">
        <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-2" style={{ color: "#3D5A3D", fontWeight: 600 }}>Message to customer</p>
        <p className="text-xs opacity-65 mb-2 leading-relaxed italic">
          Visible on their order card. Use this for delays, questions, or quick reassurance. No email is sent — the customer sees it when they refresh their account page.
        </p>
        <textarea
          value={adminMessage}
          onChange={(e) => setAdminMessage(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="e.g. Running a little behind this week — finishing your blanket on Friday."
          className="w-full px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[rgba(61,90,61,0.35)] resize-y"
          style={{ border: "1px solid rgba(61,90,61,0.35)" }}
          data-testid="admin-message-input"
        />
        <p className="text-[0.6rem] opacity-50 mt-1 text-right">{adminMessage.length}/1000</p>
        {order.admin_message_updated_at && (
          <p className="text-[0.65rem] opacity-55 mt-1">
            Last updated {new Date(order.admin_message_updated_at).toLocaleString()}
          </p>
        )}
      </section>

      {/* SHIPPING ADDRESS — read-only */}
      {ship && (
        <section className="mb-8">
          <p className="text-[0.6rem] tracking-[0.25em] uppercase opacity-60 mb-1.5">Ship to</p>
          <p className="text-sm leading-relaxed">
            {ship.name && <><span style={{ fontWeight: 500 }}>{ship.name}</span><br /></>}
            {ship.line1 ?? ship.address_line1}
            {(ship.line2 ?? ship.address_line2) && <><br />{ship.line2 ?? ship.address_line2}</>}
            <br />
            {ship.city}, {ship.state ?? ship.region} {ship.postal_code ?? ship.zip}
            {ship.country && <> · {ship.country}</>}
          </p>
        </section>
      )}

      {/* GIFT OPTIONS — show prominently because they affect packing */}
      {order.gift?.is_gift && (
        <section className="lg-panel lg-panel-gold mb-8 p-4">
          <p className="text-[0.6rem] tracking-[0.25em] uppercase mb-2" style={{ color: "#B08842" }}>This is a gift</p>
          {order.gift.message && (
            <p className="text-sm leading-relaxed italic mb-2" style={{ background: "var(--bg-surface)", padding: "0.5rem 0.75rem", border: "1px solid var(--border-default)" }}>
              "{order.gift.message}"
            </p>
          )}
          {order.gift.hide_prices && (
            <p className="text-xs opacity-80" style={{ fontWeight: 500 }}>
              ⚠ Customer asked: do NOT include prices on the packing slip.
            </p>
          )}
        </section>
      )}

      {/* LINE ITEMS — surfaced so Lusik can see the custom_metadata
          (alphabet / layout / color refs / child name) without
          digging into the DB. */}
      {(order.order_items?.length ?? 0) > 0 && (
        <section className="mb-10">
          <p className="text-[0.6rem] tracking-[0.25em] uppercase opacity-60 mb-2">Items</p>
          <div className="space-y-3">
            {order.order_items.map((it) => (
              <div key={it.id} className="p-3" style={{ border: "1px solid rgba(26,22,18,0.10)" }}>
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
                  <p className="text-sm" style={{ fontWeight: 500 }}>{it.product_name}</p>
                  <p className="text-xs opacity-65">Qty {it.quantity} · ${((it.unit_price_cents * it.quantity) / 100).toFixed(2)}</p>
                </div>
                {it.variant_label && <p className="text-xs opacity-65">{it.variant_label}</p>}
                {it.custom_metadata && Object.keys(it.custom_metadata).length > 0 && (
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[0.7rem]">
                    {Object.entries(it.custom_metadata)
                      .filter(([k, v]) => v !== null && v !== "" && k !== "letter_colors_multi")
                      .map(([k, v]) => (
                        <React.Fragment key={k}>
                          <dt className="opacity-55 truncate">{k.replace(/_/g, " ")}</dt>
                          <dd className="truncate" style={{ fontWeight: 500 }}>{String(v)}</dd>
                        </React.Fragment>
                      ))}
                  </dl>
                )}
                {it.custom_image_url && /^https?:\/\//i.test(it.custom_image_url) && (
                  <a href={it.custom_image_url} target="_blank" rel="noopener noreferrer" className="text-xs underline mt-2 inline-block" style={{ color: "#B08842" }}>
                    Customer reference image →
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SHIPPING + INTERNAL FORM */}
      <section className="lg-panel mb-10 p-5">
        <p className="text-[0.6rem] tracking-[0.3em] uppercase opacity-60 mb-4">Shipping & internal</p>
        <div className="grid sm:grid-cols-2 gap-4">
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
            <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. 9400 1234 …"
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
        <label className="block mt-4">
          <span className="text-[0.6rem] tracking-[0.25em] uppercase opacity-70 block mb-1.5">Internal notes <span className="normal-case tracking-normal opacity-70">(only you see these)</span></span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="w-full px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[rgba(176,136,66,0.4)] resize-y"
            style={{ border: "1px solid rgba(26,22,18,0.2)" }} />
        </label>

        <div className="mt-5 pt-4 flex items-center justify-end" style={{ borderTop: "1px solid rgba(26,22,18,0.06)" }}>
          <button onClick={handleFormSave} disabled={savingForm}
            className="lg-button-ink lg-shine px-5 py-2.5 text-[0.65rem] tracking-[0.2em] uppercase"
            style={{ fontWeight: 500 }}>
            {savingForm ? "Saving…" : "Save changes"}
          </button>
        </div>
      </section>

      {/* FINISHED-PIECE PHOTO */}
      <section className="mb-10">
        <p className="text-[0.6rem] tracking-[0.3em] uppercase opacity-60 mb-2">Finished-piece photo</p>
        <p className="text-xs opacity-65 mb-3 leading-relaxed italic">
          Uploading a photo emails the customer the first time, telling them their blanket is ready. Subsequent uploads replace the photo without re-emailing.
        </p>
        <div className="flex items-start gap-4 flex-wrap">
          {photoUrl ? (
            <a href={photoUrl} target="_blank" rel="noopener noreferrer" className="block flex-shrink-0">
              <img src={photoUrl} alt="Current finished-piece photo" className="w-28 h-28 object-cover" style={{ border: "1px solid rgba(26,22,18,0.15)" }} loading="lazy" decoding="async" />
            </a>
          ) : (
            <div className="w-28 h-28 flex items-center justify-center text-[0.6rem] tracking-[0.15em] uppercase opacity-50" style={{ border: "1px dashed rgba(26,22,18,0.25)" }}>
              No photo yet
            </div>
          )}
          <div className="flex-1 min-w-[200px]">
            <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhoto} className="hidden" />
            <button onClick={() => photoInputRef.current?.click()} disabled={photoBusy}
              className="lg-button-ink lg-shine px-4 py-2 text-[0.65rem] tracking-[0.2em] uppercase"
              style={{ fontWeight: 500 }}>
              {photoBusy ? "Uploading…" : (photoUrl ? "Replace photo" : "Upload photo")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
