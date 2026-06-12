"use client";

// Brand Kit (INSPIRATION_ROADMAP P2) — the one form that makes the whole
// builder feel like YOUR business: exports take the site name from here,
// the local AI takes the voice, templates/chrome can reference the rest.
import { brandSchema, BRAND_PATH } from "../schema/index.ts";

const inputClass =
  "w-full rounded-lg border border-ink/15 bg-white/80 px-2 py-1.5 text-xs focus:border-accent focus:outline-none";

type Obj = Record<string, unknown>;

const FIELDS: Array<{ key: string; label: string; hint?: string; rows?: number }> = [
  { key: "name", label: "Business name" },
  { key: "tagline", label: "Tagline" },
  { key: "logoPath", label: "Logo path", hint: "/img/uploads/… (🖼 Media panel)" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "voice", label: "Voice & tone", hint: "How you talk — the local AI writes in this style", rows: 3 },
];

export function BrandPanel({ value, onChange }: { value: Obj; onChange: (next: Obj) => void }) {
  const parsed = brandSchema.safeParse(value);
  const set = (key: string, v: string) => {
    const next = { ...value };
    if (v) next[key] = v;
    else delete next[key];
    onChange(next);
  };
  return (
    <div className="space-y-2 rounded-xl border border-ink/10 p-3">
      <h3 className="text-sm font-medium">Brand kit</h3>
      <p className="text-xs text-muted">Saved at {BRAND_PATH} — exports, templates and the AI all read from here.</p>
      {FIELDS.map((f) => (
        <label key={f.key} className="block text-xs">
          <span className="mb-0.5 block text-[11px] uppercase tracking-wide text-muted">{f.label}</span>
          {f.rows ? (
            <textarea rows={f.rows} value={String(value[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} placeholder={f.hint} className={inputClass} aria-label={f.label} />
          ) : (
            <input type="text" value={String(value[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} placeholder={f.hint} className={inputClass} aria-label={f.label} />
          )}
        </label>
      ))}
      {!parsed.success ? <p className="rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">⚠ {parsed.error.issues[0]?.message} ({parsed.error.issues[0]?.path.join(".")})</p> : null}
    </div>
  );
}
