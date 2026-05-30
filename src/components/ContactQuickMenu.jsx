"use client";

// ============================================================
// ContactQuickMenu — "How would you like to reach Lusik?" popover
// ============================================================
// Opens from the "Custom requests / Welcome by message" trust
// badge at the top of the home page. Two paths: email or SMS.
//
// Design decisions:
//   * In-popover preview line under each option (the "warning"
//     the user asked for). Calling it a warning is too strong —
//     we just tell the user exactly what tapping does before
//     they tap. No second confirmation modal — that's friction
//     for a single intentional click.
//   * `mailto:` and `sms:` URIs are the standard way to hand
//     off to the user's native apps. They work on every modern
//     browser; on desktop, sms: requires a paired phone, which
//     is why the SMS option has an extra hint line.
//   * Backdrop click + Escape + close button all dismiss.
//   * Focus is captured into the first option on open and
//     returned to the opener on close — standard a11y pattern.
//   * Body scroll is locked while open so iOS Safari doesn't
//     rubber-band underneath the modal.
//   * Cream background + gold accents + ink text — matches the
//     brand's Liquid Glass aesthetic without a hard border.
// ============================================================

import React, { useEffect, useRef } from "react";
import { Mail, Phone, X } from "./icons.jsx";
import { CONFIG } from "../data/config.js";
import { track } from "../lib/analytics.js";

const CONTACT_EMAIL = "hello@lusikandsons.com";

export function ContactQuickMenu({ isOpen, onClose }) {
  const firstButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Capture focus into the first option on open, return on close.
  useEffect(() => {
    if (!isOpen) return undefined;
    previousFocusRef.current = document.activeElement;
    // Defer one tick so the element is in the DOM before we focus it.
    const t = setTimeout(() => firstButtonRef.current?.focus(), 0);
    return () => {
      clearTimeout(t);
      try { previousFocusRef.current?.focus?.(); } catch { /* ignore */ }
    };
  }, [isOpen]);

  // Escape to close.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Lock body scroll while open. iOS Safari needs the position-fixed
  // dance to fully prevent rubber-banding, but for a brief contact
  // popover the overflow-hidden approach is enough and doesn't
  // jump the scroll position on close.
  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, [isOpen]);

  if (!isOpen) return null;

  const phoneDisplay = CONFIG.TEXT_US?.phone_display ?? "(760) 874-2333";
  const phoneE164 = CONFIG.TEXT_US?.phone_e164 ?? "+17608742333";
  const smsPrefill = CONFIG.TEXT_US?.sms_prefill ?? "Hi Lusik & Sons — ";

  const handleEmail = () => {
    track("contact-quick-menu", { channel: "email" });
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Custom request")}`;
    onClose?.();
  };

  const handleSms = () => {
    track("contact-quick-menu", { channel: "sms" });
    // The "?&body=" form (with the extra ampersand) is the cross-
    // platform-friendly shape — iOS accepts it, Android Messages
    // accepts it. A plain "?body=" works too on most clients.
    window.location.href = `sms:${phoneE164}?&body=${encodeURIComponent(smsPrefill)}`;
    onClose?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-quick-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(26, 22, 18, 0.55)" }}
      onClick={(e) => {
        // Only close on backdrop click, not on clicks bubbled up
        // from inside the panel.
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="relative w-full max-w-md p-7 lg:p-8"
        style={{
          background: "var(--bg-page, #F5EFE3)",
          border: "1px solid rgba(26, 22, 18, 0.12)",
          boxShadow: "0 24px 48px -16px rgba(26, 22, 18, 0.35)",
          borderRadius: "2px",
        }}
      >
        {/* Close X — top-right, deliberately small + understated. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center hover:opacity-100 focus-visible:opacity-100"
          style={{ color: "#1A1612", opacity: 0.55, borderRadius: "999px" }}
        >
          <X size={18} strokeWidth={1.5} />
        </button>

        <div className="text-center mb-6">
          <p className="text-[0.6rem] tracking-[0.3em] uppercase mb-2" style={{ color: "#B08842" }}>
            Write to Lusik
          </p>
          <h2
            id="contact-quick-title"
            className="font-display text-2xl lg:text-3xl"
            style={{ fontWeight: 400, letterSpacing: "-0.01em" }}
          >
            How would you like to reach <em style={{ fontWeight: 400 }}>Lusik</em>?
          </h2>
        </div>

        {/* Option 1: Email */}
        <button
          ref={firstButtonRef}
          type="button"
          onClick={handleEmail}
          className="w-full flex items-start gap-4 p-4 lg:p-5 text-left mb-3 transition-colors group"
          style={{
            background: "rgba(176, 136, 66, 0.06)",
            border: "1px solid rgba(176, 136, 66, 0.25)",
            color: "#1A1612",
            borderRadius: "2px",
          }}
        >
          <Mail size={20} strokeWidth={1.5} style={{ color: "#B08842", marginTop: "2px", flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p className="text-base lg:text-lg" style={{ fontWeight: 500 }}>Email Lusik</p>
            <p className="text-xs opacity-70 mt-1">
              Opens your mail app — {CONTACT_EMAIL}
            </p>
          </div>
        </button>

        {/* Option 2: Text */}
        <button
          type="button"
          onClick={handleSms}
          className="w-full flex items-start gap-4 p-4 lg:p-5 text-left transition-colors group"
          style={{
            background: "rgba(176, 136, 66, 0.06)",
            border: "1px solid rgba(176, 136, 66, 0.25)",
            color: "#1A1612",
            borderRadius: "2px",
          }}
        >
          <Phone size={20} strokeWidth={1.5} style={{ color: "#B08842", marginTop: "2px", flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p className="text-base lg:text-lg" style={{ fontWeight: 500 }}>Text Lusik</p>
            <p className="text-xs opacity-70 mt-1">
              Opens your messaging app — {phoneDisplay}
            </p>
            <p className="text-[0.65rem] opacity-55 mt-1.5">
              On desktop, requires a connected phone.
            </p>
          </div>
        </button>

        <p className="text-xs text-center mt-6 opacity-65 leading-relaxed">
          Lusik writes back herself when she can. Otherwise one of her sons does. Usually within a day, always in real words.
        </p>
      </div>
    </div>
  );
}
