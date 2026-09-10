"use client";

// ============================================================
// AdminReviewsPanel — the gate before a review is public
// ============================================================
// review-submit is a public write. It is only safe to leave public
// because nothing it writes appears anywhere until Lusik has read it,
// and this panel is where she does that.
//
// She can approve or hide. She cannot edit the words and she cannot
// grant photo consent — the Function refuses both — because a review
// published in words the customer did not write, or a photograph shown
// that they did not agree to, would be worse for this shop than having
// no reviews at all.
//
// Pending first, because that is the queue. Everything else is history.
// ============================================================

import React, { useCallback, useEffect, useState } from "react";
import { db } from "../lib/db.js";
import { CONFIG } from "../data/config.js";
import { useToast } from "./ToastProvider.jsx";

const photoUrl = (key) => `${CONFIG.FN_BASE}/review-photo-get?key=${encodeURIComponent(key)}`;

const STATUS_STYLE = {
  pending: { bg: "rgba(176,136,66,0.15)", color: "var(--accent-text)" },
  approved: { bg: "rgba(61,90,61,0.12)", color: "#3D5A3D" },
  hidden: { bg: "rgba(26,22,18,0.08)", color: "var(--text-muted)" },
};

export function AdminReviewsPanel() {
  const toast = useToast();
  const [reviews, setReviews] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setReviews(await db.adminListReviews());
    } catch {
      setReviews([]);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const setStatus = async (review, status) => {
    setBusyId(review.id);
    try {
      await db.adminSetReviewStatus(review.id, status);
      setReviews((rows) => (rows ?? []).map((r) => (r.id === review.id ? { ...r, status } : r)));
      toast({ kind: "success", message: status === "approved" ? "Review is live." : "Review hidden." });
    } catch (err) {
      toast({ kind: "error", message: err?.message || "That didn't save." });
    } finally {
      setBusyId(null);
    }
  };

  // Nothing to moderate is the normal state. Keep the dashboard about
  // orders.
  if (!Array.isArray(reviews) || reviews.length === 0) return null;

  const pending = reviews.filter((r) => r.status === "pending").length;

  return (
    <div className="lg-panel lg-panel-gold mb-8 p-5" data-admin-reviews>
      <div className="flex items-baseline justify-between mb-3 gap-3">
        <p className="text-[0.6rem] tracking-[0.3em] uppercase" style={{ color: "var(--accent-text)", fontWeight: 600 }}>
          Reviews
        </p>
        <p className="text-[0.65rem] opacity-70 italic">
          {pending > 0 ? `${pending} waiting to be read` : "Nothing waiting"}
        </p>
      </div>

      <div className="space-y-4">
        {reviews.map((r) => (
          <div key={r.id} className="py-3" style={{ borderTop: "1px solid var(--border-soft)" }}>
            <div className="flex items-baseline gap-3 flex-wrap mb-1.5">
              <span style={{ color: "var(--accent-text)", letterSpacing: "0.1em" }}>{"★".repeat(r.rating)}</span>
              <span className="text-xs opacity-70">{r.orderNumber}</span>
              <span
                className="text-[0.55rem] tracking-[0.18em] uppercase px-2 py-0.5"
                style={{ ...STATUS_STYLE[r.status], fontWeight: 500 }}
              >
                {r.status}
              </span>
              {r.photoKey && (
                <span className="text-[0.55rem] tracking-[0.18em] uppercase px-2 py-0.5" style={{ background: "rgba(26,22,18,0.06)", color: "var(--text-muted)", fontWeight: 500 }}>
                  {r.photoConsent ? "photo, consented" : "photo, NOT consented"}
                </span>
              )}
            </div>

            {r.body && <p className="text-sm leading-relaxed mb-2">{r.body}</p>}
            <p className="text-xs opacity-65 mb-2">{r.name ? r.name : "no name given"}</p>

            {/* Shown here only when consent was given: the endpoint that
                serves it refuses without both consent and approval, so an
                un-consented photograph would render broken anyway — and
                should not be looked at either way. */}
            {r.photoKey && r.photoConsent && r.status === "approved" && (
              <img src={photoUrl(r.photoKey)} alt="" aria-hidden="true" className="max-h-40 w-auto mb-2" />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStatus(r, "approved")}
                disabled={busyId === r.id || r.status === "approved"}
                className="px-3 py-2 text-[0.6rem] tracking-[0.2em] uppercase transition disabled:opacity-30"
                style={{ border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--text-on-ink)", fontWeight: 500 }}
              >
                {r.status === "approved" ? "Live" : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => setStatus(r, "hidden")}
                disabled={busyId === r.id || r.status === "hidden"}
                className="px-3 py-2 text-[0.6rem] tracking-[0.2em] uppercase transition disabled:opacity-30"
                style={{ border: "1px solid var(--border-strong)", color: "var(--text-primary)", fontWeight: 500 }}
              >
                {r.status === "hidden" ? "Hidden" : "Hide"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
