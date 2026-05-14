// ============================================================
// CollapsibleSection — picker step that collapses to a one-line summary
// ============================================================
// Used inside the blanket configurator. When `open` is true,
// the children (picker UI) render under a step label. When
// false, it collapses to a tappable single-line summary
// showing what was picked + a "Change" affordance.
//
// We deliberately do NOT use `display: none` for the
// collapsed state — the summary needs to be visible AND
// tappable so the customer can always see + revisit their
// choice.
//
// MIRRORED FROM index.html (~line 10373).
// ============================================================

import React from "react";

export function CollapsibleSection({ title, open, summary, onExpand, children, mb = "mb-6" }) {
  return (
    <div className={mb}>
      {open ? (
        <>
          {/* Step label, shown above the picker body */}
          <p className="text-xs tracking-[0.2em] uppercase opacity-70 mb-4">{title}</p>
          {children}
        </>
      ) : (
        <button
          onClick={onExpand}
          className="w-full p-4 flex items-center justify-between text-left transition"
          style={{
            border: "1px solid rgba(26,22,18,0.15)",
            background: "rgba(26,22,18,0.02)",
          }}
          aria-expanded="false"
          aria-label={`${title} — tap to change`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[0.6rem] tracking-[0.25em] uppercase opacity-50 mb-1">{title}</p>
            <div className="text-sm" style={{ fontWeight: 500 }}>{summary}</div>
          </div>
          <span className="text-[0.65rem] tracking-wider uppercase opacity-60 ml-3 flex-shrink-0" style={{ color: "#B08842" }}>
            Change
          </span>
        </button>
      )}
    </div>
  );
}
