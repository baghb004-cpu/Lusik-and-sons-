// ============================================================
// MobilePageHeader — Apple Store-style large title for mobile
// ============================================================
// Renders on phones only (hidden on lg+ via Tailwind). Each tab
// in the bottom nav gets a large Fraunces title at the top of
// its content area, with an optional user avatar in the top-right
// corner (like the Apple Store "For You" → profile circle).
//
// This replaces the sticky top nav bar on mobile. The top nav
// is hidden on phones (see the `hidden lg:block` class on the
// <nav> in App.jsx); this component provides the brand identity
// and page context that the top nav used to carry.
//
// Props:
//   title    — the large display title ("Lusik & Sons", "Shop", etc.)
//   subtitle — optional small eyebrow above the title
//   user     — if passed + has email/name, renders a small avatar circle
//   onAvatarTap — fires when the avatar is tapped (opens account)
// ============================================================

import React from "react";
import { User } from "./icons.jsx";
import { ThemeToggleCompact } from "./ThemeToggleCompact.jsx";
import { LangToggleCompact } from "./LangToggleCompact.jsx";

export function MobilePageHeader({ title, subtitle, user, onAvatarTap }) {
  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.charAt(0).toUpperCase()
    : user?.email
      ? user.email.charAt(0).toUpperCase()
      : null;

  return (
    <div className="lg:hidden px-6 pt-14 pb-4 flex items-start justify-between">
      <div>
        {subtitle && (
          <p
            className="text-xs tracking-[0.2em] uppercase mb-1"
            style={{ color: "#B08842" }}
          >
            {subtitle}
          </p>
        )}
        <h1
          className="font-display leading-tight"
          style={{
            fontSize: "2.1rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
          }}
        >
          {title}
        </h1>
      </div>

      {/* Right cluster — theme toggle, language toggle, avatar.
          Mirrors the Asbarez header (dark-mode switch + language
          + search), brought into the brand palette. */}
      <div className="flex items-center gap-2.5 flex-shrink-0" style={{ marginTop: 4 }}>
        <ThemeToggleCompact />
        <LangToggleCompact />
        {onAvatarTap && (
          <button
            type="button"
            onClick={onAvatarTap}
            className="flex items-center justify-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: initials
                ? "var(--ink)"
                : "rgba(26, 22, 18, 0.08)",
              color: initials
                ? "var(--text-on-ink)"
                : "var(--text-muted)",
              fontFamily: "Fraunces, Georgia, serif",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
            aria-label="Your account"
          >
            {initials || <User size={18} strokeWidth={1.5} />}
          </button>
        )}
      </div>
    </div>
  );
}
