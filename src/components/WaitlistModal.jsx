"use client";

// ============================================================
// WaitlistModal — "notify me when this is available"
// ============================================================
// Replaces the old mailto flow for catalog items still marked
// status: "placeholder". When the customer clicks one in the
// mega-menu, this modal opens with a quick description + email
// signup. Submissions POST to /.netlify/functions/waitlist which
// persists the (email, product_key) pair in product_waitlist for
// the admin Notify sweep to email later.
//
// The "Or email Lusik directly" fallback link is preserved for
// customers who want a personal conversation instead.
//
// MIRRORED FROM index.html (~line 3850).
// ============================================================

import React, { useState } from "react";
import { CONFIG } from "../data/config.js";
import { track } from "../lib/analytics.js";
import { useToast } from "./ToastProvider.jsx";
import { X } from "./icons.jsx";

export function WaitlistModal({ product, onClose }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [bot, setBot]     = useState("");
  const [busy, setBusy]   = useState(false);

  if (!product) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast({ kind: "error", message: "Please enter a valid email address." });
      return;
    }
    setBusy(true);
    try {
      // Posts to a Netlify Function that persists the email →
      // product_key pairing in our own DB (was Netlify Forms before;
      // moved so the admin Notify sweep can actually email everyone
      // when a placeholder product goes live).
      const res = await fetch(`${CONFIG.FN_BASE}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "bot-field": bot,
          email:        value,
          product_key:  product.key,
          product_name: product.name,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      track("waitlist-signup", { productKey: product.key });
      toast({
        kind: "success",
        message: `Added — we'll write you the day ${product.name} is ready.`,
      });
      onClose?.();
    } catch {
      toast({ kind: "error", message: "We couldn't add you just now — please try again, or write to hello@lusikandsons.com." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Waitlist for ${product.name}`}>
      <div className="absolute inset-0 lg-scrim" />
      <div className="lg-panel-tall relative w-full max-w-md fade-in p-6 lg:p-8" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 opacity-50 hover:opacity-100 transition">
          <X size={18} />
        </button>
        <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-2" style={{ color: "var(--accent)" }}>Almost ready</p>
        <h3 className="font-display text-2xl lg:text-3xl mb-3" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
          {product.name}
        </h3>
        {product.description && (
          <p className="text-sm opacity-80 leading-relaxed mb-5">{product.description}</p>
        )}
        <form onSubmit={handleSubmit} className="mb-4">
          <label className="block mb-1.5">
            <span className="text-[0.6rem] tracking-[0.25em] uppercase opacity-70">A single note, the day it's ready</span>
          </label>
          <div className="flex items-stretch gap-2">
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className="flex-1 px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[rgba(176,136,66,0.4)]"
              style={{ border: "1px solid rgba(26,22,18,0.15)" }}
              aria-label="Email address"
            />
            <button
              type="submit"
              disabled={busy}
              className="px-5 text-[0.65rem] tracking-[0.2em] uppercase whitespace-nowrap transition"
              style={{
                background: busy ? "rgba(26,22,18,0.4)" : "#1A1612",
                color: "#F5EFE3",
                fontWeight: 500,
                cursor: busy ? "wait" : "pointer",
              }}
            >
              {busy ? "…" : "Write me"}
            </button>
          </div>
          {/* Honeypot — off-screen, real users never see it. */}
          <label aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
            Don't fill this out: <input name="bot-field" value={bot} onChange={(e) => setBot(e.target.value)} tabIndex={-1} autoComplete="off" />
          </label>
        </form>
        <p className="text-xs opacity-60 leading-relaxed">
          Or <a href={`mailto:hello@lusikandsons.com?subject=${encodeURIComponent(`Inquiry: ${product.name}`)}`} className="underline hover:opacity-100">write Lusik directly</a> if you'd rather have the conversation in her own words.
        </p>
      </div>
    </div>
  );
}
