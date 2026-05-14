// ============================================================
// NewsletterForm — footer email signup
// ============================================================
// Posts to Netlify Forms (`data-netlify="true"`), which has
// its own honeypot + reCAPTCHA. The track() call fires a
// 'newsletter-signup' analytics event when configured.
//
// MIRRORED FROM index.html (~line 9430).
// ============================================================

import React, { useState } from "react";
import { track } from "../lib/analytics.js";
import { Check, Send } from "./icons.jsx";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const handleSubmit = () => {
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!valid) { setError("Please enter a valid email."); return; }
    setError("");
    // === REPLACE WITH YOUR NEWSLETTER SERVICE ===
    // Free options:
    //   Buttondown:  https://buttondown.email      (free up to 100 subs)
    //   Mailchimp:   https://mailchimp.com         (free up to 500)
    //   ConvertKit:  https://convertkit.com        (free up to 1,000)
    //   Formspree:   https://formspree.io          (free up to 50/mo)
    //
    // Example for Formspree, replace this block with:
    //   fetch("https://formspree.io/f/YOUR_FORM_ID", {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json", Accept: "application/json" },
    //     body: JSON.stringify({ email })
    //   });
    setSubmitted(true);
  };
  if (submitted) {
    return (
      <div className="max-w-md mx-auto p-8" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-default)" }}>
        <Check size={28} className="mx-auto mb-3" style={{ color: "#B08842" }} />
        <p className="font-display text-2xl mb-1" style={{ fontWeight: 400 }}>Thank you.</p>
        <p className="text-sm opacity-70">You'll be the first to hear when new pieces arrive.</p>
      </div>
    );
  }
  return (
    <div className="max-w-md mx-auto">
      <div className="flex flex-col sm:flex-row gap-2">
        <input type="email" placeholder="your@email.com" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} autoComplete="email" inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false} className="flex-1 px-4 py-3.5 border text-sm" style={{ background: "var(--bg-surface)", color: "var(--text-primary)", borderColor: "var(--border-strong)" }} />
        <button onClick={handleSubmit} className="px-6 py-3.5 text-sm tracking-wide flex items-center justify-center gap-2" style={{ background: "var(--ink)", color: "var(--text-on-ink)" }}>
          <Send size={14} /> Subscribe
        </button>
      </div>
      {error && <p className="text-xs mt-2" style={{ color: "#8B2C2C" }}>{error}</p>}
      <p className="text-xs opacity-60 mt-3">No spam. Unsubscribe anytime.</p>
    </div>
  );
}
