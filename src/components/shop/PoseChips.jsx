"use client";

// ============================================================
// POSE CHIPS — four ways to look at the piece
// ============================================================
// SITE_OVERHAUL_HANDOFF.md PR 8: "pose chips" under the stage.
//
// The four poses already exist in src/loom/core/camera.ts, and they were
// chosen for what each one shows: the table view the product photographs
// were taken from, a low close-up where the weave and the fringe read,
// straight down so the whole layout reads like a chart, and a lifted
// corner showing the satin backing. This is a control surface for those,
// not a new set.
//
// They render ONLY when the stage is live. On a device that cannot run
// the engine the stage is a poster or the 2D preview, and a camera chip
// there would be a button that does nothing — which is worse than no
// button, because it looks like the page is broken rather than lighter.
// ============================================================

import React from "react";
import { useT } from "../../i18n/LangContext.jsx";

/**
 * The order they are offered in: the default first, then the reveals.
 *
 * Three, not four. There was a fourth called "the backing", and it could
 * never have worked: the orbit clamps the camera above the table and the
 * satin backing is on the underside, so the pose showed a blank slab
 * edge. It was never rendered until these chips existed to press it.
 */
export const POSE_KEYS = Object.freeze(["flat", "detail", "chart"]);

export function PoseChips({ value, onChange, className = "" }) {
  const t = useT();
  return (
    <div
      className={`flex flex-wrap gap-2 ${className}`}
      role="group"
      aria-label={t("pose.groupLabel")}
    >
      {POSE_KEYS.map((key) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange?.(key)}
            aria-pressed={selected}
            className="px-3 py-1.5 text-[0.65rem] tracking-[0.15em] uppercase transition"
            style={{
              background: selected ? "var(--ink)" : "transparent",
              color: selected ? "var(--text-on-ink)" : "var(--text-primary)",
              border: `1px solid ${selected ? "var(--ink)" : "var(--border-strong)"}`,
            }}
          >
            {t(`pose.${key}`)}
          </button>
        );
      })}
    </div>
  );
}
