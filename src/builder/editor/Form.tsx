"use client";

// ============================================================
// Schema-driven form — Phase 4's replacement for raw JSON
// ============================================================
// Renders a FieldSpec list as controlled inputs over a plain
// object. Three rules keep it safe and lossless:
//   1. Unknown keys on the document are PRESERVED untouched —
//      a form can never silently strip data it doesn't know.
//   2. Empty optional fields are REMOVED from the object (the
//      generators treat `undefined` and `""` differently).
//   3. The form never validates money rules itself — warnings
//      are shown, but the server's build-gate decides.
// ============================================================

import type { FieldSpec } from "../adapters/lusik/collections.ts";

type Obj = Record<string, unknown>;

export interface DocFormProps {
  fields: FieldSpec[];
  value: Obj;
  onChange: (next: Obj) => void;
}

function setField(value: Obj, name: string, next: unknown, removeWhenEmpty: boolean): Obj {
  const out = { ...value };
  const isEmpty = next === "" || next === undefined || (Array.isArray(next) && next.length === 0);
  if (removeWhenEmpty && isEmpty) delete out[name];
  else out[name] = next;
  return out;
}

const inputClass =
  "w-full rounded-lg border border-ink/15 bg-white/80 px-3 py-2 text-sm focus:border-accent focus:outline-none";

export function DocForm({ fields, value, onChange }: DocFormProps) {
  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <Field key={f.name} spec={f} value={value[f.name]} onChange={(v) => onChange(setField(value, f.name, v, !f.required))} />
      ))}
    </div>
  );
}

function Field({ spec, value, onChange }: { spec: FieldSpec; value: unknown; onChange: (v: unknown) => void }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline gap-2 text-sm font-medium">
        {spec.label}
        {spec.required ? <span className="text-accent">*</span> : null}
      </span>
      <FieldInput spec={spec} value={value} onChange={onChange} />
      {spec.help ? <p className="mt-1 text-xs text-muted">{spec.help}</p> : null}
      {spec.warning ? (
        <p className="mt-1 rounded bg-accent/10 px-2 py-1 text-xs text-ink">⚠ {spec.warning}</p>
      ) : null}
    </label>
  );
}

function FieldInput({ spec, value, onChange }: { spec: FieldSpec; value: unknown; onChange: (v: unknown) => void }) {
  switch (spec.type) {
    case "string":
    case "image":
      return (
        <input type="text" className={inputClass} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
      );
    case "text":
      return (
        <textarea rows={5} className={inputClass} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
      );
    case "number":
      return (
        <input
          type="number"
          step="any"
          className={inputClass}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      );
    case "boolean":
      return (
        <span className="flex items-center gap-2 py-1">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-ink" />
          <span className="text-sm text-muted">{value === true ? "On" : "Off"}</span>
        </span>
      );
    case "select":
      return (
        <select className={inputClass} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)}>
          <option value="" disabled>Choose…</option>
          {(spec.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    case "string[]": {
      const items = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                className={inputClass}
                value={item}
                onChange={(e) => onChange(items.map((x, n) => (n === i ? e.target.value : x)))}
              />
              <RowButtons
                onUp={i > 0 ? () => onChange(swap(items, i, i - 1)) : undefined}
                onDown={i < items.length - 1 ? () => onChange(swap(items, i, i + 1)) : undefined}
                onRemove={() => onChange(items.filter((_, n) => n !== i))}
              />
            </div>
          ))}
          <AddButton label="Add line" onClick={() => onChange([...items, ""])} />
        </div>
      );
    }
    case "object[]": {
      const items = Array.isArray(value) ? (value as Obj[]) : [];
      const sub = spec.fields ?? [];
      return (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="rounded-lg border border-ink/10 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-muted">#{i + 1}</span>
                <RowButtons
                  onUp={i > 0 ? () => onChange(swap(items, i, i - 1)) : undefined}
                  onDown={i < items.length - 1 ? () => onChange(swap(items, i, i + 1)) : undefined}
                  onRemove={() => onChange(items.filter((_, n) => n !== i))}
                />
              </div>
              <DocForm fields={sub} value={item} onChange={(next) => onChange(items.map((x, n) => (n === i ? next : x)))} />
            </div>
          ))}
          <AddButton label={`Add ${spec.label.toLowerCase()}`} onClick={() => onChange([...items, {}])} />
        </div>
      );
    }
    case "json":
      return <JsonField value={value} onChange={onChange} />;
    default:
      return null;
  }
}

function JsonField({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  // Controlled-by-parse: shows the serialized value, applies only valid JSON.
  const text = value === undefined ? "" : JSON.stringify(value, null, 2);
  return (
    <textarea
      rows={6}
      spellCheck={false}
      className={`${inputClass} font-mono text-xs`}
      defaultValue={text}
      onBlur={(e) => {
        const t = e.target.value.trim();
        if (t === "") return onChange(undefined);
        try {
          onChange(JSON.parse(t));
          e.target.setCustomValidity("");
        } catch {
          e.target.setCustomValidity("Not valid JSON");
          e.target.reportValidity();
        }
      }}
    />
  );
}

function RowButtons({ onUp, onDown, onRemove }: { onUp?: () => void; onDown?: () => void; onRemove: () => void }) {
  const btn = "rounded border border-ink/15 px-2 py-1 text-xs disabled:opacity-30";
  return (
    <span className="flex shrink-0 items-start gap-1">
      <button type="button" className={btn} disabled={!onUp} onClick={onUp} aria-label="Move up">↑</button>
      <button type="button" className={btn} disabled={!onDown} onClick={onDown} aria-label="Move down">↓</button>
      <button type="button" className={btn} onClick={onRemove} aria-label="Remove">✕</button>
    </span>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full border border-ink/20 px-3 py-1 text-xs hover:bg-cream">
      + {label}
    </button>
  );
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  const next = [...arr];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
