"use client";

// ============================================================
// App project panel (Phase 15) — the guided app workflow
// ============================================================
// Questionnaire → derived requirements → store checklists (with
// the no-guarantee disclaimer as item #1) → easy path before
// hard path → one-click PWA export. The ✨ AI panel's
// "Draft a project plan" task pairs with this for the
// plain-English planning step.
// ============================================================

import { useMemo } from "react";
import {
  APP_QUESTIONS,
  deriveRequirements,
  buildAppleChecklist,
  buildPlayChecklist,
  EASY_PATH,
  HARD_PATH,
  appProjectSchema,
  appAnswersSchema,
  type ChecklistItem,
} from "../app/index.ts";

type Obj = Record<string, unknown>;

const inputClass =
  "w-full rounded-lg border border-ink/15 bg-white/80 px-2 py-1.5 text-xs focus:border-accent focus:outline-none";

export function AppPanel({
  value,
  onChange,
  onExportPwa,
}: {
  value: Obj;
  onChange: (next: Obj) => void;
  onExportPwa: () => void;
}) {
  const parsed = useMemo(() => appProjectSchema.safeParse(value), [value]);
  if (!parsed.success) {
    return (
      <p className="rounded-lg bg-accent/10 p-3 text-sm">
        This app project doesn’t match the schema — switch to JSON to repair it.
        <span className="mt-1 block font-mono text-xs text-muted">{parsed.error.issues[0]?.message}</span>
      </p>
    );
  }
  const project = parsed.data;
  const answers = appAnswersSchema.parse(project.answers);
  const requirements = deriveRequirements(answers);
  const apple = buildAppleChecklist(answers);
  const play = buildPlayChecklist(answers);
  const checked = new Set(project.checkedItems);
  const storeRelease = answers.needsStoreRelease === true;

  const setAnswer = (id: string, v: boolean | string) => onChange({ ...value, answers: { ...answers, [id]: v } });
  const toggleItem = (id: string) => {
    const next = checked.has(id) ? project.checkedItems.filter((x) => x !== id) : [...project.checkedItems, id];
    onChange({ ...value, checkedItems: next });
  };

  return (
    <div className="space-y-3 text-xs">
      {/* questionnaire */}
      <div className="space-y-2 rounded-xl border border-ink/10 p-3">
        <h4 className="font-medium uppercase tracking-wide text-muted">About this app</h4>
        {APP_QUESTIONS.map((q) => (
          <div key={q.id}>
            {q.kind === "boolean" ? (
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={answers[q.id] === true} onChange={(e) => setAnswer(q.id, e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-ink" />
                <span>
                  {q.text}
                  {q.help ? <span className="block text-[11px] text-muted">{q.help}</span> : null}
                </span>
              </label>
            ) : q.kind === "select" ? (
              <label className="block">
                <span className="mb-1 block font-medium">{q.text}</span>
                <select value={String(answers[q.id] ?? "")} onChange={(e) => setAnswer(q.id, e.target.value)} className={inputClass}>
                  <option value="" disabled>Choose…</option>
                  {q.options!.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                {q.help ? <span className="mt-0.5 block text-[11px] text-muted">{q.help}</span> : null}
              </label>
            ) : (
              <label className="block">
                <span className="mb-1 block font-medium">{q.text}</span>
                <input type="text" value={String(answers[q.id] ?? "")} onChange={(e) => setAnswer(q.id, e.target.value)} className={inputClass} />
              </label>
            )}
          </div>
        ))}
      </div>

      {/* derived requirements */}
      {requirements.length > 0 ? (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-3">
          <h4 className="mb-1 font-medium uppercase tracking-wide text-muted">What these answers require</h4>
          <ul className="space-y-1">
            {requirements.map((r) => (
              <li key={r.id}>
                <span className="font-medium">{r.blocking ? "● " : "○ "}{r.label}</span>
                <span className="block text-[11px] text-muted">{r.why}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-muted">● = needed before release · ○ = strongly advised</p>
        </div>
      ) : null}

      {/* the two paths */}
      <details className="rounded-xl border border-ink/10 p-3" open={!storeRelease}>
        <summary className="cursor-pointer font-medium">The easy path (start here)</summary>
        <ol className="mt-1 list-decimal space-y-1 pl-4">{EASY_PATH.map((s, i) => <li key={i}>{s}</li>)}</ol>
        <button type="button" onClick={onExportPwa} className="mt-2 rounded-full bg-ink px-4 py-1.5 text-cream">
          Export installable PWA ↓
        </button>
      </details>
      <details className="rounded-xl border border-ink/10 p-3">
        <summary className="cursor-pointer font-medium">The hard path (native apps — eyes open)</summary>
        <ul className="mt-1 list-disc space-y-1 pl-4">{HARD_PATH.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </details>

      {/* store checklists */}
      {storeRelease ? (
        <>
          <Checklist title={`Apple App Store (${countDone(apple, checked)}/${apple.length})`} items={apple} checked={checked} onToggle={toggleItem} />
          <Checklist title={`Google Play (${countDone(play, checked)}/${play.length})`} items={play} checked={checked} onToggle={toggleItem} />
        </>
      ) : (
        <p className="text-muted">Store checklists appear when “needs an App Store / Google Play release” is checked.</p>
      )}
    </div>
  );
}

function countDone(items: ChecklistItem[], checked: Set<string>): number {
  return items.filter((i) => checked.has(i.id)).length;
}

function Checklist({
  title,
  items,
  checked,
  onToggle,
}: {
  title: string;
  items: ChecklistItem[];
  checked: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <details className="rounded-xl border border-ink/10 p-3">
      <summary className="cursor-pointer font-medium">{title}</summary>
      <ul className="mt-2 space-y-1.5">
        {items.map((i) => (
          <li key={i.id}>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={checked.has(i.id)} onChange={() => onToggle(i.id)} className="mt-0.5 h-3.5 w-3.5 accent-ink" />
              <span>
                <span className="font-medium">{i.label}</span>
                <span className="block text-[11px] text-muted">{i.detail}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </details>
  );
}
