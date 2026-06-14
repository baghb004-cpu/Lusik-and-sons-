"use client";

// ============================================================
// Responsive preview panel (Phase: adaptive layout)
// ============================================================
// The one-click responsive assistant. Pick a screen from the
// generic, privacy-safe library → the preview resizes to it (with
// safe-area + hinge overlays) and a live grade + issue list
// appears. Three actions: Apply This Layout Preset (writes
// breakpoint overrides), Generate Responsive Fixes (same, scoped
// to fixable issues), and Test All Presets (static scan across
// every preset → a grade each).
//
// Static scan runs here (pure, no DOM). The live rect scan is fed
// by the parent, which measures the actual preview render.
// ============================================================

import { useMemo, useState } from "react";
import type { Page } from "../schema/index.ts";
import {
  presetGroups,
  presetById,
  layoutRulesFor,
  describeRules,
  staticScan,
  scoreIssues,
  type Grade,
  type LayoutIssue,
  type ViewportPreset,
} from "../viewport/index.ts";

const GRADE_STYLE: Record<Grade, string> = {
  Excellent: "bg-emerald-100 text-emerald-900",
  Good: "bg-sky-100 text-sky-900",
  "Needs Fixes": "bg-amber-100 text-amber-900",
  "Broken Layout": "bg-red-100 text-red-800",
};

export interface ResponsivePreviewPanelProps {
  page: Page | null;
  activePresetId: string | null;
  /** Live rect-scan issues from the parent's DOM measurement (optional). */
  liveIssues?: LayoutIssue[];
  onSelectPreset: (preset: ViewportPreset) => void;
  onApplyPreset: (preset: ViewportPreset) => void;
  onGenerateFixes: (preset: ViewportPreset) => void;
}

export function ResponsivePreviewPanel({
  page,
  activePresetId,
  liveIssues = [],
  onSelectPreset,
  onApplyPreset,
  onGenerateFixes,
}: ResponsivePreviewPanelProps) {
  const groups = useMemo(() => presetGroups(), []);
  const active = activePresetId ? presetById(activePresetId) : null;
  const [allResults, setAllResults] = useState<Array<{ preset: ViewportPreset; grade: Grade; issues: number }> | null>(null);

  const scan = useMemo<{ issues: LayoutIssue[]; grade: Grade } | null>(() => {
    if (!page || !active) return null;
    const issues = [...staticScan(page, active), ...liveIssues];
    return { issues, grade: scoreIssues(issues) };
  }, [page, active, liveIssues]);

  const testAll = () => {
    if (!page) return;
    const results = presetGroups()
      .flatMap((g) => g.presets)
      .map((preset) => {
        const issues = staticScan(page, preset);
        return { preset, grade: scoreIssues(issues), issues: issues.length };
      });
    setAllResults(results);
  };

  return (
    <div className="space-y-3 text-xs">
      <h3 className="font-medium uppercase tracking-wide text-muted">Screens & adaptive layout</h3>

      {/* the screen library */}
      <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border border-ink/10 p-2">
        {groups.map((g) => (
          <div key={g.group}>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-muted">{g.group}</p>
            <div className="flex flex-wrap gap-1">
              {g.presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPreset(p)}
                  title={`${p.width}×${p.height} · ${p.ratioLabel}`}
                  className={
                    activePresetId === p.id
                      ? "rounded-full bg-ink px-2.5 py-1 text-[11px] text-cream"
                      : "rounded-full border border-ink/15 px-2.5 py-1 text-[11px] hover:bg-cream"
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {active ? (
        <>
          <div className="rounded-xl border border-ink/10 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium">{active.label}</span>
              <span className="font-mono text-[11px] text-muted">{active.width}×{active.height} · {active.ratioLabel}</span>
            </div>
            <p className="text-[11px] text-muted">{describeRules(layoutRulesFor(active))}</p>
            {active.hinge ? <p className="text-[11px] text-accent">Hinge-safe zone honored ({active.hinge.axis})</p> : null}
            {active.safeArea ? <p className="text-[11px] text-accent">Notch / home-indicator safe areas shown</p> : null}
          </div>

          {scan ? (
            <div className="rounded-xl border border-ink/10 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">Layout check</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${GRADE_STYLE[scan.grade]}`}>{scan.grade}</span>
              </div>
              {scan.issues.length === 0 ? (
                <p className="text-muted">No issues on this screen ✓</p>
              ) : (
                <ul className="space-y-1">
                  {scan.issues.map((i, n) => (
                    <li key={n} className={i.severity === "critical" ? "text-red-700" : i.severity === "warning" ? "text-amber-700" : "text-muted"}>
                      {i.severity === "critical" ? "● " : i.severity === "warning" ? "▲ " : "○ "}
                      {i.message}
                      {i.fixable ? <span className="ml-1 text-[10px] text-accent">(auto-fixable)</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => onApplyPreset(active)} className="rounded-full bg-ink px-3 py-1.5 text-cream">
              Apply this layout preset
            </button>
            <button type="button" onClick={() => onGenerateFixes(active)} className="rounded-full border border-ink/20 px-3 py-1.5 hover:bg-cream">
              Generate responsive fixes
            </button>
            <button type="button" onClick={testAll} className="rounded-full border border-ink/20 px-3 py-1.5 hover:bg-cream">
              Test all presets
            </button>
          </div>
          <p className="text-[11px] text-muted">
            Applied changes land in the {layoutRulesFor(active).breakpoint} breakpoint — the bucket this screen ships in. Fine-grained screens here drive preview + checking accuracy.
          </p>
        </>
      ) : (
        <p className="text-muted">Pick a screen to preview it and check the layout.</p>
      )}

      {allResults ? (
        <div className="rounded-xl border border-ink/10 p-3">
          <h4 className="mb-2 font-medium uppercase tracking-wide text-muted">All screens ({allResults.filter((r) => r.grade === "Excellent").length}/{allResults.length} excellent)</h4>
          <ul className="max-h-44 space-y-0.5 overflow-y-auto">
            {allResults.map((r) => (
              <li key={r.preset.id} className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => onSelectPreset(r.preset)} className="truncate text-left hover:underline">{r.preset.label}</button>
                <span className={`shrink-0 rounded-full px-2 text-[10px] ${GRADE_STYLE[r.grade]}`}>{r.grade}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
