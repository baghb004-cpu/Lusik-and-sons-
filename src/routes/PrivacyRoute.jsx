"use client";

// ============================================================
// PrivacyRoute — the standalone /privacy page
// ============================================================
// The same Privacy Policy the footer modal shows (one source of
// truth: src/data/policies.js), rendered at a real, public URL.
// External listings need a linkable privacy policy — the iOS
// App Store requires one — and a modal can't be linked to, so
// the privacy text lives here as a page too. The live CPRA
// do-not-share switch renders exactly as it does in the modal.
//
// `?choices=1` (linked from app contexts that want the opt-out
// front and center) scrolls straight to the switch, mirroring
// the footer's "Your privacy choices" behavior.
// ============================================================

import React, { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { POLICIES, POLICIES_LAST_UPDATED } from "../data/policies.js";
import { AdvertisingChoices } from "../components/AdvertisingChoices.jsx";

export function PrivacyRoute() {
  const policy = POLICIES.privacy;
  const searchParams = useSearchParams();
  const scrollToChoices = searchParams?.get("choices") === "1";

  useEffect(() => {
    if (!scrollToChoices) return;
    const t = setTimeout(() => {
      document.querySelector("[data-ads-choices]")?.scrollIntoView({ block: "center" });
    }, 50);
    return () => clearTimeout(t);
  }, [scrollToChoices]);

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
            {s.widget === "adsOptOut" ? <AdvertisingChoices /> : null}
          </section>
        ))}
      </div>

      {/* Sister policies open as the same footer modals used site-wide
          (SiteChrome listens for the openPolicy event globally). */}
      <div className="mt-12 pt-6 text-xs opacity-70" style={{ borderTop: "1px solid rgba(26,22,18,0.08)" }}>
        <p className="mb-1">Other policies:</p>
        <div className="flex gap-4 flex-wrap">
          {["terms", "finalSale"].map((k) => (
            <button
              key={k}
              onClick={() => window.dispatchEvent(new CustomEvent("openPolicy", { detail: k }))}
              className="underline hover:opacity-100"
            >
              {POLICIES[k].title}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-8 text-xs opacity-70">
        Questions? <a href="mailto:hello@lusikandsons.com" className="underline">hello@lusikandsons.com</a> · <a href="tel:+17608742333" className="underline">(760) 874-2333</a>
      </p>
    </div>
  );
}

export default PrivacyRoute;
