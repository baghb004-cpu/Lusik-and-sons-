"use client";

// ============================================================
// SoldOutPanel — graceful "sold out for now" state
// ============================================================
// Shown in place of the buy controls when a product has hit its
// handmade-stock limit. Warm, on-brand, never harsh — and offers a
// restock-notify button that opens the shared WaitlistModal (via the
// "openWaitlist" CustomEvent SiteChrome listens for). The email lands
// in product_waitlist, the same table Lusik's admin Notify sweep reads.
// ============================================================

import React from "react";
import { Mail, ArrowRight } from "../icons.jsx";
import { useT } from "../../i18n/LangContext.jsx";

export function SoldOutPanel({ name, productKey, className = "" }) {
  const t = useT();
  const notify = () =>
    window.dispatchEvent(new CustomEvent("openWaitlist", { detail: { key: productKey, name } }));

  return (
    <div
      className={className}
      style={{
        border: "1px solid var(--accent-strong)",
        background: "var(--accent-soft)",
        padding: "1.25rem",
      }}
    >
      <p
        className="text-[0.6rem] tracking-[0.3em] uppercase mb-2"
        style={{ color: "var(--accent)", fontWeight: 600 }}
      >
        {t("soldOut.eyebrow")}
      </p>
      <p className="text-base leading-relaxed mb-4" style={{ color: "var(--text-primary)" }}>
        {t("soldOut.body")}
      </p>
      <button
        type="button"
        onClick={notify}
        className="lg-button-ink lg-shine w-full px-6 py-3 text-sm tracking-wide flex items-center justify-center gap-2"
        style={{ fontWeight: 500, letterSpacing: "0.02em" }}
      >
        <Mail size={16} strokeWidth={1.5} />
        {t("soldOut.notify")} <ArrowRight size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}
