// ============================================================
// HelpDecidingSection — "Need help deciding?" contact block
// ============================================================
// Mirrors the Apple Store app's "Still need help deciding?"
// section: a row of perfect-circle, one-tap contact buttons.
// Mobile-only (lg:hidden) — the desktop layout has its own
// footer + contact affordances.
//
// Two shapes, switched by props:
//   * FULL (shop index)  — photo placeholder + reassurance line
//                          + circles + FAQ accordion.
//   * COMPACT (product)  — heading + circles only, matching the
//                          block Apple shows at the bottom of
//                          every product page.
//
// Contact details come from the CONFIG dial board so phone /
// email / Calendly live in one place. The sms:/mailto: shapes
// match ContactQuickMenu for consistent behavior site-wide.
// `external: true` marks the circles that open in a new tab.
// ============================================================

import React, { useState } from "react";
import { CONFIG } from "../../data/config.js";
import { MessageCircle, Phone, Mail, Camera, ChevronDown } from "../icons.jsx";

// Shared sms:/tel: deep links (same shapes used across the site).
const SMS_HREF = `sms:${CONFIG.TEXT_US.phone_e164}?&body=${encodeURIComponent(CONFIG.TEXT_US.sms_prefill)}`;
const TEL_HREF = `tel:${CONFIG.TEXT_US.phone_e164}`;

// ------------------------------------------------------------
// StillHaveQuestionsCard — the *limited* contact card (Text +
// Call only) that Apple shows at the bottom of a product detail
// page and inside the bag. The fuller four-circle "Need help
// deciding?" block (with Email + Video) is reserved for the shop
// index and category pages. Mobile-only.
// ------------------------------------------------------------
export function StillHaveQuestionsCard({
  heading = "Still have questions?",
  subline = "Lusik or one of her sons will help.",
  className = "",
}) {
  return (
    <div className={`lg:hidden px-6 ${className}`}>
      <div
        className="flex items-center justify-between gap-4 p-5"
        style={{
          borderRadius: 18,
          background: "var(--bg-surface, #FFFFFF)",
          border: "1px solid var(--border-soft, rgba(26,22,18,0.08))",
        }}
      >
        <div className="min-w-0">
          <p className="font-display" style={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary, #1A1612)" }}>
            {heading}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary, rgba(26,22,18,0.65))" }}>
            {subline}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <a
            href={SMS_HREF}
            aria-label="Text us"
            className="flex items-center justify-center"
            style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(176,136,66,0.10)" }}
          >
            <MessageCircle size={20} strokeWidth={1.7} style={{ color: "#B08842" }} />
          </a>
          <a
            href={TEL_HREF}
            aria-label="Call us"
            className="flex items-center justify-center"
            style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(176,136,66,0.10)" }}
          >
            <Phone size={20} strokeWidth={1.7} style={{ color: "#B08842" }} />
          </a>
        </div>
      </div>
    </div>
  );
}

const HELP_CONTACTS = [
  {
    icon: MessageCircle,
    label: "Text us",
    href: `sms:${CONFIG.TEXT_US.phone_e164}?&body=${encodeURIComponent(CONFIG.TEXT_US.sms_prefill)}`,
  },
  {
    icon: Phone,
    label: "Call us",
    href: `tel:${CONFIG.TEXT_US.phone_e164}`,
  },
  {
    icon: Mail,
    label: "Email us",
    href: `mailto:${CONFIG.TEXT_US.email}?subject=${encodeURIComponent("A question for Lusik")}`,
  },
  {
    icon: Camera,
    label: "Video call",
    href: CONFIG.TEXT_US.calendly_url,
    external: true,
  },
];

// FAQ accordion — adapted from Apple's "Frequently Asked
// Questions" to Lusik's world (a maker, not a Genius Bar).
const HELP_FAQ = [
  {
    q: "What happens on a video call?",
    a: "You book a time and Lusik (or one of her sons) hops on a quick video call. She'll walk you through the blankets, show you thread colors and fabric up close, and help you decide on an alphabet, a name, and a layout. You don't have to be on camera if you'd rather not.",
  },
  {
    q: "Can you help me pick colors and a name?",
    a: "That's exactly what these chats are for. Bring the nursery palette, a sibling's blanket, or just a feeling — Lusik will help you land on a combination that looks right and stitches well. Nothing is ordered until you're happy with it.",
  },
  {
    q: "What if I'd rather just text or email?",
    a: "Totally fine — most people do. Tap Text us or Email us above and write in whatever's on your mind. Lusik writes back herself when she can, otherwise one of her sons does, usually within a day.",
  },
  {
    q: "How long does a finished piece take?",
    a: "Each blanket is hand cross-stitched to order, so most take about 5–10 business days once the design is set. You'll get a photo before it ships and a tracking link when it's on its way.",
  },
];

export function HelpDecidingSection({
  heading = "Need help deciding?",
  showPhoto = true,
  showLede = true,
  showFaq = true,
  bordered = false,
}) {
  const [openFaq, setOpenFaq] = useState(null);

  const sectionStyle = bordered
    ? { borderTop: "1px solid var(--border-soft, rgba(26,22,18,0.10))", paddingTop: 36 }
    : undefined;

  return (
    <section className="lg:hidden px-6 mb-12" style={sectionStyle}>
      <h2
        className="font-display mb-5"
        style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary, #1A1612)" }}
      >
        {heading}
      </h2>

      {/* ⚠️ TODO_LUSIK: replace this placeholder with a warm photo of
          Lusik (and one of her sons) at her table — the equivalent of
          Apple's two-Specialists image. Until then, a soft cream
          panel carrying the wordmark keeps the layout intact. */}
      {showPhoto && (
        <div
          className="flex items-center justify-center"
          style={{
            height: 150,
            borderRadius: 20,
            background: "rgba(176,136,66,0.08)",
            border: "1px solid var(--border-soft, rgba(26,22,18,0.08))",
            marginBottom: 20,
          }}
        >
          <span className="font-display" style={{ fontSize: "1.5rem", color: "#B08842", letterSpacing: "0.01em" }}>
            Lusik &amp; Sons
          </span>
        </div>
      )}

      {showLede && (
        <p
          className="font-display text-center"
          style={{ fontSize: "1.2rem", fontWeight: 600, lineHeight: 1.35, letterSpacing: "-0.01em", color: "var(--text-primary, #1A1612)", maxWidth: 340, margin: "0 auto" }}
        >
          Have a question about a piece? Lusik or one of her sons will be with you shortly.
        </p>
      )}

      <div className="flex items-start justify-between" style={{ maxWidth: 340, margin: "26px auto 0" }}>
        {HELP_CONTACTS.map((c) => {
          const Ico = c.icon;
          const externalProps = c.external ? { target: "_blank", rel: "noopener noreferrer" } : {};
          return (
            <a
              key={c.label}
              href={c.href}
              aria-label={c.label}
              className="flex flex-col items-center"
              style={{ width: 72, textDecoration: "none" }}
              {...externalProps}
            >
              <span
                className="flex items-center justify-center"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "var(--bg-surface, #FFFFFF)",
                  border: "1px solid var(--border-soft, rgba(26,22,18,0.08))",
                  boxShadow: "0 2px 10px rgba(26,22,18,0.08)",
                }}
              >
                <Ico size={26} strokeWidth={1.6} style={{ color: "#B08842" }} />
              </span>
              <span
                className="text-sm text-center"
                style={{ color: "var(--text-primary, #1A1612)", marginTop: 10, fontWeight: 500 }}
              >
                {c.label}
              </span>
            </a>
          );
        })}
      </div>

      {/* FAQ accordion — tap a question to expand its answer. */}
      {showFaq && (
        <div style={{ marginTop: 36 }}>
          <h3
            className="font-display mb-1"
            style={{ fontSize: "1.15rem", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-primary, #1A1612)" }}
          >
            Frequently asked
          </h3>
          {HELP_FAQ.map((item, i) => {
            const isOpen = openFaq === i;
            return (
              <div
                key={item.q}
                style={{ borderBottom: "1px solid var(--border-soft, rgba(26,22,18,0.08))" }}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between text-left"
                  style={{ padding: "16px 0", gap: 16, background: "none", border: "none", color: "var(--text-primary, #1A1612)" }}
                >
                  <span style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.3 }}>{item.q}</span>
                  <ChevronDown
                    size={20}
                    strokeWidth={1.8}
                    style={{
                      color: "#B08842",
                      flexShrink: 0,
                      transition: "transform 0.2s ease",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                </button>
                {isOpen && (
                  <p
                    className="text-sm"
                    style={{ paddingBottom: 18, lineHeight: 1.6, color: "var(--text-secondary, rgba(26,22,18,0.7))" }}
                  >
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
