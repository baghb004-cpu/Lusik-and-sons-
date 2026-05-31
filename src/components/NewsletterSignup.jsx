"use client";

// ============================================================
// NewsletterSignup — email-list signup form
// ============================================================
// Posts urlencoded data to Netlify Forms. Under the Next.js runtime
// (@netlify/plugin-nextjs v5) forms can't be detected from rendered
// pages, so the form is declared in the static `public/__forms.html`
// detection target and this component POSTs to `/__forms.html` with a
// matching `form-name`. Submissions show up in Site → Forms in the
// Netlify dashboard; Netlify also runs server-side honeypot + reCAPTCHA
// scoring before storing.
//
// `variant`:
//   "footer"   — default. Renders an inline "Newsletter" heading +
//                short pitch above the form (used in the site
//                footer where the surrounding context is dense).
//   "hero"     — header/pitch suppressed; just the input + button.
//                Used inside the HomeView "Stay Connected" section
//                which already provides its own heading + paragraph.
//
// Replaces the prior duplicate NewsletterForm component, which
// rendered a similar form but never actually POSTed anywhere.
// ============================================================

import React, { useState } from "react";
import { track } from "../lib/analytics.js";
import { useToast } from "./ToastProvider.jsx";

export function NewsletterSignup({ variant = "footer" }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [bot, setBot]     = useState("");   // honeypot — must stay empty
  const [busy, setBusy]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast({ kind: "error", message: "Please enter a valid email address." });
      return;
    }
    setBusy(true);
    try {
      const body = new URLSearchParams({
        "form-name": "newsletter",
        "bot-field": bot,
        email: value,
      }).toString();
      const res = await fetch("/__forms.html", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      track("newsletter-signup");
      toast({
        kind: "success",
        message: "Thank you — we'll write the moment Lusik adds something new.",
      });
      setEmail("");
    } catch {
      toast({
        kind: "error",
        message: "We couldn't add you just now — please try again, or write to hello@lusikandsons.com.",
      });
    } finally {
      setBusy(false);
    }
  };

  const isHero = variant === "hero";

  return (
    <div className={isHero ? "" : "mb-8"}>
      {!isHero && (
        <>
          <p className="text-xs tracking-[0.3em] uppercase mb-3 opacity-70">The occasional note</p>
          <p className="text-sm opacity-80 leading-relaxed mb-3 max-w-md">
            When Lusik adds a new alphabet or opens her hands for custom orders, we'll write. About one note a month — never anything we wouldn't send to family.
          </p>
        </>
      )}
      <form
        name="newsletter"
        method="POST"
        onSubmit={handleSubmit}
        className={isHero ? "flex items-stretch gap-2 max-w-md mx-auto" : "flex items-stretch gap-2 max-w-md"}
      >
        <input type="hidden" name="form-name" value="newsletter" />
        {/* Honeypot — visually hidden but a bot will fill it. */}
        <label className="sr-only" aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
          Don't fill this out: <input name="bot-field" value={bot} onChange={(e) => setBot(e.target.value)} tabIndex={-1} autoComplete="off" />
        </label>
        <input
          type="email"
          name="email"
          required
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
          className="px-5 text-xs tracking-[0.2em] uppercase whitespace-nowrap transition"
          style={{
            background: busy ? "rgba(26,22,18,0.5)" : "#1A1612",
            color: "#F5EFE3",
            fontWeight: 500,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? "…" : "Write me"}
        </button>
      </form>
    </div>
  );
}
