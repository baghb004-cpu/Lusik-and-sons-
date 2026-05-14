// NewsletterSignup — MIRRORED FROM index.html (~line 3977).
import React from "react";
import { useState } from "react";
import { track } from "../lib/analytics.js";
import { Send } from "./icons.jsx";

export function NewsletterSignup() {
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
      const res = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      track("newsletter-signup");
      toast({
        kind: "success",
        message: "Thanks — we'll let you know when Lusik adds a new alphabet.",
      });
      setEmail("");
    } catch {
      toast({
        kind: "error",
        message: "Couldn't sign you up — please try again, or email hello@lusikandsons.com.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-8">
      <p className="text-xs tracking-[0.3em] uppercase mb-3 opacity-70">Newsletter</p>
      <p className="text-sm opacity-80 leading-relaxed mb-3 max-w-md">
        Be the first to hear when Lusik adds a new alphabet or opens custom slots. No spam, no upsells — just the occasional note.
      </p>
      <form
        name="newsletter"
        method="POST"
        data-netlify="true"
        netlify-honeypot="bot-field"
        onSubmit={handleSubmit}
        className="flex items-stretch gap-2 max-w-md"
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
          {busy ? "…" : "Sign me up"}
        </button>
      </form>
    </div>
  );
}
