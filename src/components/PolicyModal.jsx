"use client";

// ============================================================
// PolicyModal — Privacy / Terms / Refunds
// ============================================================
// The in-page dialog rendering of the policies, picked by
// `policyKey` prop. The WORDS live in src/data/policies.js (one
// source of truth, shared with the standalone /privacy page);
// the CPRA do-not-share switch lives in AdvertisingChoices.jsx
// (also shared). If the ad tags in app/providers.tsx ever
// change, update the policy text in the same PR — the policy
// describing reality is the whole point of it.
// ============================================================

import React, { useEffect } from "react";
import { X } from "./icons.jsx";
import { POLICIES, POLICIES_LAST_UPDATED } from "../data/policies.js";
import { AdvertisingChoices } from "./AdvertisingChoices.jsx";

export function PolicyModal({ policyKey, onClose }) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    // Prevent body scroll while modal is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const policies = POLICIES;
  const lastUpdated = POLICIES_LAST_UPDATED;

  // "privacyChoices" is an alias key (used by the footer's CPRA-required
  // "Your privacy choices" link): same privacy policy, but opened scrolled
  // to the do-not-share switch so the opt-out is one click away.
  const scrollToAdChoices = policyKey === "privacyChoices";
  const effectiveKey = scrollToAdChoices ? "privacy" : policyKey;
  const policy = policies[effectiveKey];

  useEffect(() => {
    if (!scrollToAdChoices) return;
    const t = setTimeout(() => {
      document.querySelector("[data-ads-choices]")?.scrollIntoView({ block: "center" });
    }, 50);
    return () => clearTimeout(t);
  }, [scrollToAdChoices]);

  if (!policy) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8 lg-scrim"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`policy-${policyKey}-title`}
    >
      <div
        className="lg-panel-tall w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 lg:p-8 border-b" style={{ borderColor: "rgba(26,22,18,0.1)" }}>
          <div>
            <p className="text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "var(--accent)" }}>{policy.eyebrow}</p>
            <h2 id={`policy-${policyKey}-title`} className="font-display text-2xl lg:text-3xl" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
              {policy.title}
            </h2>
            <p className="text-xs opacity-50 mt-1">Last updated: {lastUpdated}</p>
          </div>
          <button onClick={onClose} className="p-1 -mt-1 -mr-1 opacity-70 hover:opacity-100" aria-label="Close" data-tooltip="Close" data-tooltip-pos="left">
            <X size={22} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="p-6 lg:p-8 overflow-y-auto flex-1">
          <div className="space-y-6">
            {policy.sections.map((s, i) => (
              <div key={i}>
                <h3 className="font-display text-base lg:text-lg mb-2" style={{ fontWeight: 500 }}>{s.heading}</h3>
                <p className="text-sm leading-relaxed opacity-85">{s.body}</p>
                {s.widget === "adsOptOut" ? <AdvertisingChoices /> : null}
              </div>
            ))}
          </div>

          {/* Sister-policy links at the bottom */}
          <div className="mt-10 pt-6 text-xs opacity-70" style={{ borderTop: "1px solid rgba(26,22,18,0.08)" }}>
            <p className="mb-1">Other policies:</p>
            <div className="flex gap-4 flex-wrap">
              {Object.keys(policies).filter((k) => k !== effectiveKey).map((k) => (
                <button
                  key={k}
                  onClick={(e) => { e.stopPropagation(); /* swap content by reopening */ window.dispatchEvent(new CustomEvent("openPolicy", { detail: k })); }}
                  className="underline hover:opacity-100"
                >
                  {policies[k].title}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 lg:px-8 py-4 text-center text-xs opacity-70" style={{ borderTop: "1px solid rgba(26,22,18,0.08)", background: "rgba(176,136,66,0.06)" }}>
          Questions? <a href="mailto:hello@lusikandsons.com" className="underline">hello@lusikandsons.com</a> · <a href="tel:+17608742333" className="underline">(760) 874-2333</a>
        </div>
      </div>
    </div>
  );
}
