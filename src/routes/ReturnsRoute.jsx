"use client";

// ============================================================
// ReturnsRoute — the standalone /returns page
// ============================================================
// The Returns & Exchanges policy at a real, public URL. External
// listings need a linkable returns policy — Google Merchant Center
// requires one for verification — and a modal can't be linked to,
// so the returns text (src/data/policies.js `returns`, the same
// rules the Final Sale modal explains in fuller prose) lives here
// as a page too, mirroring how /privacy serves the App Store.
// ============================================================

import React from "react";
import { POLICIES, POLICIES_LAST_UPDATED } from "../data/policies.js";

export function ReturnsRoute() {
  const policy = POLICIES.returns;

  return (
    <div className="fade-in max-w-2xl mx-auto px-6 lg:px-12 py-12 lg:py-20">
      <header className="mb-10 lg:mb-12">
        <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: "var(--accent-text)" }}>
          {policy.eyebrow}
        </p>
        <h1 className="font-display text-4xl lg:text-5xl mb-2" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
          {policy.title}
        </h1>
        <p className="text-xs opacity-50">Last updated: {POLICIES_LAST_UPDATED}</p>
      </header>

      <div className="space-y-8">
        {policy.sections.map((s, i) => (
          <section key={i}>
            <h2 className="font-display text-lg lg:text-xl mb-2" style={{ fontWeight: 500 }}>{s.heading}</h2>
            <p className="text-sm lg:text-base leading-relaxed opacity-85">{s.body}</p>
          </section>
        ))}
      </div>

      {/* Sister policies open as the same footer modals used site-wide
          (SiteChrome listens for the openPolicy event globally); the
          privacy policy has its own page. */}
      <div className="mt-12 pt-6 text-xs opacity-70" style={{ borderTop: "1px solid rgba(26,22,18,0.08)" }}>
        <p className="mb-1">Other policies:</p>
        <div className="flex gap-4 flex-wrap">
          {["finalSale", "terms"].map((k) => (
            <button
              key={k}
              onClick={() => window.dispatchEvent(new CustomEvent("openPolicy", { detail: k }))}
              className="underline hover:opacity-100"
            >
              {POLICIES[k].title}
            </button>
          ))}
          <a href="/privacy" className="underline hover:opacity-100">{POLICIES.privacy.title}</a>
        </div>
      </div>

      <p className="mt-8 text-xs opacity-70">
        Questions? <a href="mailto:hello@lusikandsons.com" className="underline">hello@lusikandsons.com</a> · <a href="tel:+17608742333" className="underline">(760) 874-2333</a>
      </p>
    </div>
  );
}

export default ReturnsRoute;
