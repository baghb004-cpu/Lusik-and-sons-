"use client";

// ============================================================
// CollapsibleCard — Apple-style "bubble" card with a chevron
// ============================================================
// A rounded card whose body collapses behind a tappable header
// (eyebrow + title + a chevron that flips). Used to compact the
// optional checkout sections so the order total + Pay button stay
// near the top instead of below a long scroll. Collapsed by default.
// ============================================================

import React, { useState } from "react";

function Chevron({ open }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      style={{ transition: "transform 0.25s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CollapsibleCard({ title, eyebrow, defaultOpen = false, children, className = "" }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={`rounded-2xl overflow-hidden ${className}`}
      style={{ border: "1px solid var(--border-default)", background: "var(--bg-surface, #FFFFFF)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
        style={{ color: "var(--text-primary)" }}
      >
        <span className="min-w-0">
          {eyebrow && (
            <span className="block text-[0.6rem] tracking-[0.25em] uppercase mb-0.5" style={{ color: "var(--accent)" }}>{eyebrow}</span>
          )}
          <span className="text-sm" style={{ fontWeight: 600 }}>{title}</span>
        </span>
        <Chevron open={open} />
      </button>
      {open && (
        <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--border-soft)" }}>
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
}
