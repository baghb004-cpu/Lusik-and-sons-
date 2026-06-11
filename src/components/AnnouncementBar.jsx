"use client";

// ============================================================
// AnnouncementBar — the Studio-controlled strip above everything
// ============================================================
// Content lives in content/pages/announcement.json (Content Studio →
// Site Content → Announcement) and compiles in at build time like all
// CMS content — when disabled (the default) this renders nothing and
// costs nothing. One bar serves both worlds: it sits above the desktop
// top-nav and above the mobile page header, styled like the existing
// dark top strips (the active-order bar). Holiday notices, order-by
// dates, promo lines — Lusik edits, the deploy publishes.

import React from "react";
import { CMS_PAGES } from "../data/pagesData.generated.js";

export function AnnouncementBar() {
  const a = CMS_PAGES.announcement;
  if (!a?.enabled || !a.message) return null;

  const external = a.link?.startsWith("https://");
  return (
    <div
      role="region"
      aria-label="Announcement"
      className="w-full text-center px-4 py-2"
      style={{
        background: "var(--ink)",
        color: "var(--text-on-ink)",
        fontSize: "0.78rem",
        letterSpacing: "0.04em",
        lineHeight: 1.45,
      }}
    >
      <span>{a.message}</span>
      {a.link && a.linkLabel && (
        <a
          href={a.link}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          className="underline underline-offset-2 ml-2 hover:opacity-80 transition-opacity"
          style={{ color: "var(--accent)", fontWeight: 600 }}
        >
          {a.linkLabel}
        </a>
      )}
    </div>
  );
}
