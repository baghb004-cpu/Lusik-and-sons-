"use client";

// ============================================================
// Hit-box overlay (Phase 7) — see what a thumb sees
// ============================================================
// Measures every interactive element inside the preview and
// draws its tap target: green = comfortable, red = under the
// 44px floor or overlapping a neighbor. Measurement is DOM;
// the verdicts come from engine/hitbox.ts (the testable part).
// Editor-only — published pages never load this.
// ============================================================

import { useEffect, useState } from "react";
import { auditTapTargets, MIN_TAP_PX, type TapIssue, type TargetRect } from "../engine/index.ts";

const INTERACTIVE = "a, button, summary, input:not([type=radio].sr-only), select, textarea, label[for]";

export interface HitboxReport {
  rects: TargetRect[];
  issues: TapIssue[];
}

export function measureHitboxes(container: HTMLElement): HitboxReport {
  const containerBox = container.getBoundingClientRect();
  const seen: TargetRect[] = [];
  const els = container.querySelectorAll<HTMLElement>(INTERACTIVE);
  els.forEach((el, i) => {
    // Skip invisible elements (display:none on this device, sr-only radios).
    const box = el.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) return;
    const label =
      el.getAttribute("aria-label") ||
      el.textContent?.trim().slice(0, 28) ||
      el.tagName.toLowerCase();
    seen.push({
      id: `t${i}`,
      label,
      x: box.left - containerBox.left,
      y: box.top - containerBox.top,
      width: box.width,
      height: box.height,
    });
  });
  return { rects: seen, issues: auditTapTargets(seen) };
}

export function HitboxOverlay({
  container,
  refreshKey,
  onReport,
}: {
  container: HTMLElement | null;
  /** Re-measure when this changes (device switches, doc edits). */
  refreshKey: string;
  onReport: (report: HitboxReport) => void;
}) {
  const [report, setReport] = useState<HitboxReport | null>(null);

  useEffect(() => {
    if (!container) return;
    // Wait a frame so the preview has laid out at the new width.
    const raf = requestAnimationFrame(() => {
      const r = measureHitboxes(container);
      setReport(r);
      onReport(r);
    });
    return () => cancelAnimationFrame(raf);
  }, [container, refreshKey, onReport]);

  if (!report) return null;
  const flagged = new Set(report.issues.flatMap((i) => i.ids));

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {report.rects.map((r) => {
        const bad = flagged.has(r.id);
        return (
          <div
            key={r.id}
            className={
              bad
                ? "absolute rounded border-2 border-red-500/80 bg-red-500/10"
                : "absolute rounded border border-emerald-500/60 bg-emerald-500/5"
            }
            style={{ left: r.x, top: r.y, width: r.width, height: r.height }}
          >
            {bad ? (
              <span className="absolute -top-4 left-0 whitespace-nowrap rounded bg-red-600 px-1 text-[9px] leading-3 text-white">
                {Math.round(r.width)}×{Math.round(r.height)} (min {MIN_TAP_PX})
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
