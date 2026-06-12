"use client";

// ============================================================
// Services panel (Phase 17) — preset cards over the registry
// ============================================================
// Beginner mode shows the easy 2–3 per category; Advanced shows
// everyone. Every recommended card explains itself ("Why this
// recommendation?"), warnings are visible (paid · lock-in ·
// secret key), and the escape hatch is permanent: nothing here
// locks you in. The selection is just a document — saving runs
// the cross-preset gate, and exports pick up the checklist.
// ============================================================

import { useMemo, useState } from "react";
import {
  ALL_PRESETS,
  STACKS,
  presetsByCategory,
  beginnerChoices,
  validateSelection,
  buildSetupChecklist,
  stackById,
  stackDefaults,
  type Preset,
  type PresetCategory,
} from "../presets/index.ts";
import { servicesSelectionSchema } from "../presets/selection.ts";

type Obj = Record<string, unknown>;

const CATEGORIES: Array<{ id: PresetCategory; label: string; exclusive: boolean }> = [
  { id: "hosting", label: "Hosting", exclusive: true },
  { id: "database", label: "Database", exclusive: true },
  { id: "commerce", label: "Checkout", exclusive: false },
  { id: "email", label: "Email", exclusive: false },
  { id: "cms", label: "CMS", exclusive: true },
  { id: "security", label: "DNS & security (optional reading)", exclusive: false },
];

export function PresetsPanel({ value, onChange }: { value: Obj; onChange: (next: Obj) => void }) {
  const parsed = useMemo(() => servicesSelectionSchema.safeParse(value), [value]);
  const [advanced, setAdvanced] = useState(false);

  if (!parsed.success) {
    return (
      <p className="rounded-lg bg-accent/10 p-3 text-sm">
        services.json doesn’t match the schema — switch to JSON to repair it.
      </p>
    );
  }
  const { stack, selection } = parsed.data;
  const chosen = new Set(selection);
  const issues = validateSelection(selection);
  const checklist = buildSetupChecklist(selection);

  const setSelection = (next: string[], nextStack: string | null = stack) =>
    onChange({ ...value, selection: [...new Set(next)], stack: nextStack });

  const toggle = (preset: Preset, exclusive: boolean) => {
    if (preset.informational) return; // cards, not choices
    if (chosen.has(preset.id)) {
      setSelection(selection.filter((id) => id !== preset.id));
      return;
    }
    const cleared = exclusive
      ? selection.filter((id) => ALL_PRESETS.find((p) => p.id === id)?.category !== preset.category)
      : selection;
    setSelection([...cleared, preset.id]);
  };

  return (
    <div className="space-y-3 text-xs">
      {/* stack picker */}
      <div className="rounded-xl border border-ink/10 p-3">
        <h4 className="mb-1 font-medium uppercase tracking-wide text-muted">Start from a stack</h4>
        <div className="space-y-1.5">
          {STACKS.map((s) => (
            <label key={s.id} className="flex items-start gap-2">
              <input
                type="radio"
                name="stack"
                checked={stack === s.id}
                onChange={() => setSelection(stackDefaults(stackById(s.id)!), s.id)}
                className="mt-0.5 h-3.5 w-3.5 accent-ink"
              />
              <span>
                <span className="font-medium">{s.label}</span>
                <span className="block text-[11px] text-muted">{s.blurb}</span>
              </span>
            </label>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 border-t border-ink/10 pt-2">
          <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} className="h-3.5 w-3.5 accent-ink" />
          Advanced mode — show every provider
        </label>
      </div>

      {/* category cards */}
      {CATEGORIES.map((cat) => {
        const presets = advanced ? presetsByCategory(cat.id) : beginnerChoices(cat.id, 3);
        const all = presetsByCategory(cat.id);
        const shown = presets.length > 0 ? presets : all; // categories with no "easy" still render
        return (
          <div key={cat.id} className="rounded-xl border border-ink/10 p-3">
            <h4 className="mb-1.5 font-medium uppercase tracking-wide text-muted">{cat.label}</h4>
            <div className="space-y-1.5">
              {shown.map((p) => (
                <PresetCard key={p.id} preset={p} chosen={chosen.has(p.id)} exclusive={cat.exclusive} onToggle={() => toggle(p, cat.exclusive)} />
              ))}
            </div>
            {!advanced && all.length > shown.length ? (
              <button type="button" onClick={() => setAdvanced(true)} className="mt-1.5 text-[11px] text-accent underline">
                Use another provider ({all.length - shown.length} more)
              </button>
            ) : null}
          </div>
        );
      })}

      {/* selection issues + the final checklist */}
      {issues.length > 0 ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3">
          {issues.map((i, n) => (
            <p key={n} className="text-red-700">{i.message}</p>
          ))}
        </div>
      ) : null}
      {selection.length > 0 ? (
        <details className="rounded-xl border border-ink/10 p-3" open>
          <summary className="cursor-pointer font-medium">Setup checklist before deploying</summary>
          {checklist.accountsNeeded.length ? (
            <p className="mt-1.5"><span className="font-medium">Accounts:</span> {checklist.accountsNeeded.join(", ")}</p>
          ) : null}
          {checklist.envVars.required.length ? (
            <p className="mt-1"><span className="font-medium">Env vars:</span> <code>{checklist.envVars.required.join(", ")}</code></p>
          ) : null}
          {checklist.secretWarnings.length ? (
            <p className="mt-1 text-accent">⚠ Secret keys ({checklist.secretWarnings.join(", ")}) — server env only, never in code or git.</p>
          ) : null}
          {checklist.warnings.map((w, n) => (
            <p key={n} className="mt-1 text-muted">• {w.preset}: {w.warning}</p>
          ))}
          <p className="mt-2 text-[11px] text-muted">The full step-by-step list is written into every export as SETUP-CHECKLIST.md.</p>
        </details>
      ) : null}
      <p className="text-[11px] text-muted">
        Recommendations are informational only — any provider works, nothing locks you in, and this builder never creates accounts or touches your keys.
      </p>
    </div>
  );
}

function PresetCard({ preset, chosen, exclusive, onToggle }: { preset: Preset; chosen: boolean; exclusive: boolean; onToggle: () => void }) {
  if (preset.informational) {
    return (
      <details className="rounded-lg border border-ink/10 bg-cream/60 p-2">
        <summary className="cursor-pointer">
          <span className="font-medium">{preset.label}</span> <span className="text-muted">— info card</span>
        </summary>
        <p className="mt-1 text-muted">{preset.blurb}</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-muted">{preset.setupSteps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      </details>
    );
  }
  return (
    <div className={chosen ? "rounded-lg border border-accent bg-accent/5 p-2" : "rounded-lg border border-ink/10 bg-white/60 p-2"}>
      <label className="flex items-start gap-2">
        <input type={exclusive ? "radio" : "checkbox"} checked={chosen} onChange={onToggle} onClick={exclusive && chosen ? onToggle : undefined} className="mt-0.5 h-3.5 w-3.5 accent-ink" />
        <span className="min-w-0">
          <span className="font-medium">{preset.label}</span>
          <span className="ml-1 text-[10px] uppercase tracking-wide text-muted">{preset.difficulty}</span>
          {preset.requiresSecretKey ? <Badge title="Uses a secret key">🔑</Badge> : null}
          {preset.warnings.some((w) => /paid|fee|billing|\$/i.test(w)) || !preset.freeTier ? <Badge title="Costs can apply">💲</Badge> : null}
          {preset.warnings.some((w) => /lock-in|coupled|migrating away/i.test(w)) ? <Badge title="Vendor lock-in risk">🔒</Badge> : null}
          <span className="block text-[11px] text-muted">{preset.blurb}</span>
          {preset.freeTier ? <span className="block text-[11px] text-muted">{preset.freeTier}</span> : null}
          {preset.recommendedFor.length > 0 ? (
            <details className="mt-0.5">
              <summary className="cursor-pointer text-[11px] text-accent">Why this recommendation?</summary>
              <span className="block text-[11px] text-muted">{preset.recommendedFor.join(" ")}</span>
            </details>
          ) : null}
          {preset.warnings.length > 0 ? (
            <details className="mt-0.5">
              <summary className="cursor-pointer text-[11px] text-muted">Warnings ({preset.warnings.length})</summary>
              {preset.warnings.map((w, i) => (
                <span key={i} className="block text-[11px] text-muted">• {w}</span>
              ))}
            </details>
          ) : null}
        </span>
      </label>
    </div>
  );
}

function Badge({ children, title }: { children: React.ReactNode; title: string }) {
  return <span title={title} className="ml-1 text-[11px]">{children}</span>;
}
