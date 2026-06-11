// ============================================================
// PlaceholderView — coming-soon products + the waitlist (Chunk 8)
// ============================================================
// The JS sibling of ios/LusikSons/Views/PlaceholderProductView.swift
// (itself the port of the website's unpriced-placeholder path):
// name/tagline/description from the catalog mirror, the disabled
// "Currently unavailable" bar with "Price coming soon.", and the
// one-field signup POSTing to the same /waitlist Function the
// website uses — app and site signups land in one Notify list per
// product. No photos yet, so the gold-wash band carries the title.

import React, { useState } from "react";
import { joinWaitlist } from "../lib/api.js";
import { haptics } from "../lib/haptics.js";
import { CONTACT } from "../data/contact.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // the website's shape check

export function PlaceholderView({ placeholder, onBack }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const [errorText, setErrorText] = useState(null);

  const mailto = `mailto:${CONTACT.email}?subject=${encodeURIComponent(`Inquiry: ${placeholder.name}`)}`;

  const join = async () => {
    if (busy || joined) return;
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setErrorText("Please enter a valid email address.");
      return;
    }
    setErrorText(null);
    setBusy(true);
    try {
      await joinWaitlist(value, placeholder.key, placeholder.name);
      setJoined(true);
      haptics.success();
    } catch (err) {
      setErrorText(err?.message || "We couldn't add you just now — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ph readable">
      <button type="button" className="back-link" onClick={onBack} aria-label="Back">
        ‹ Back
      </button>

      <div className="ph-cover">
        <span className="journal-eyebrow">Almost ready</span>
        <h1 className="ph-title brand-display">{placeholder.name}</h1>
      </div>

      <p className="ph-tagline">{placeholder.tagline}</p>
      <p className="ph-description">{placeholder.description}</p>

      <div className="ph-unavailable" aria-disabled="true">Currently unavailable</div>
      <p className="ph-price-soon">Price coming soon.</p>

      <div className="ph-waitlist">
        {joined ? (
          <p className="ph-joined">✓ Added — we'll write you the day {placeholder.name} is ready.</p>
        ) : (
          <>
            <p className="ck-label">A single note, the day it's ready</p>
            <div className="ph-form">
              <input
                className="ck-input"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") join(); }}
                aria-label="Email address"
              />
              <button type="button" className="pill pill-ink" onClick={join} disabled={busy} aria-label="Join the waitlist">
                {busy ? "…" : "Write me"}
              </button>
            </div>
            {errorText && <p className="ck-error" role="alert">{errorText}</p>}
          </>
        )}
      </div>

      <a className="ph-mailto" href={mailto}>
        Or write Lusik directly — {CONTACT.email} — if you'd rather have the conversation in her own words.
      </a>
    </div>
  );
}

// The category-grid card for a placeholder ("{name} — coming soon").
export function PlaceholderCard({ placeholder, onOpen }) {
  return (
    <button
      type="button"
      className="ph-card"
      onClick={onOpen}
      aria-label={`${placeholder.name} — coming soon`}
    >
      <span className="ph-card-band">
        <span className="shop-badge">Coming soon</span>
        <span className="ph-card-title brand-display">{placeholder.name}</span>
      </span>
      <span className="ph-card-body">
        <span className="ph-card-tagline">{placeholder.tagline}</span>
        <span className="ph-card-cta">Get one note when it's ready →</span>
      </span>
    </button>
  );
}
