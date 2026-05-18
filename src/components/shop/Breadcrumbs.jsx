// ============================================================
// Breadcrumbs — shared trail used across /shop/* pages
// ============================================================
// Renders a horizontal trail like "Home › Shop › Blankets ›
// Armenian Alphabet Blanket". Every segment except the last is
// a real button that navigates back up the hierarchy. The last
// is plain text (you're already there).
//
// Pass `trail` as an array of segments, each:
//   { label: "Blankets", onClick: () => navigateToCategory(...) }
// The LAST entry can omit onClick — it renders as static text.
//
// Mobile: long product names wrap onto two lines but stay
// readable. The component never injects an ellipsis — that's a
// fragile pattern that hides what page you're on.
// ============================================================

import React from "react";

export function Breadcrumbs({ trail }) {
  if (!Array.isArray(trail) || trail.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-6 lg:mb-8">
      <ol className="flex items-center gap-2 flex-wrap text-[0.65rem] tracking-[0.25em] uppercase leading-relaxed">
        {trail.map((seg, i) => {
          const isLast = i === trail.length - 1;
          return (
            <li key={i} className="flex items-center gap-2">
              {isLast || !seg.onClick ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  style={{ color: isLast ? "var(--text-primary)" : "var(--text-muted)", fontWeight: isLast ? 600 : 400 }}
                >
                  {seg.label}
                </span>
              ) : (
                <button
                  onClick={seg.onClick}
                  className="opacity-60 hover:opacity-100 transition"
                  style={{ color: "var(--text-primary)" }}
                >
                  {seg.label}
                </button>
              )}
              {!isLast && <span className="opacity-30" aria-hidden="true">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
