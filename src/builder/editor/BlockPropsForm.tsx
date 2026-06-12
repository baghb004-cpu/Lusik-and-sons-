"use client";

// ============================================================
// BlockPropsForm (plan §21) — the generated inspector form
// ============================================================
// Renders the FieldSpec list introspect.ts compiles from a block
// type's zod schema. Every edit writes the BASE document through
// onChange; the schema gate still has the final word on save —
// but the form ALSO live-parses each change and surfaces the
// first issue inline, so a bad value is explained next to the
// field that caused it, not at save time.
//
// Translatable fields edit ONE locale at a time (the selector at
// the top, shown only when the project has several languages);
// non-default locales write through setLocaleValue so a plain
// string is promoted to an {_i18n} map exactly when needed and
// collapsed back when only the default remains.
// ============================================================

import { useMemo, useState } from "react";
import { BLOCK_TYPES, type Block } from "../schema/index.ts";
import type { RichTextDoc } from "../schema/index.ts";
import type { CatalogSnapshot } from "../engine/commerce.ts";
import {
  fieldsForBlockType,
  newRowValue,
  defaultForField,
  isSimpleDoc,
  docToPlainText,
  plainTextToDoc,
  type FieldSpec,
} from "./introspect.ts";
import { resolveI18n, setLocaleValue, isI18nString, type Translatable } from "../i18n/translatable.ts";
import { localeByCode, type LocaleCode } from "../i18n/locales.ts";

const inputClass =
  "w-full rounded-lg border border-ink/15 bg-white/80 px-2 py-1.5 text-xs focus:border-accent focus:outline-none";

export interface BlockPropsFormProps {
  block: Block;
  catalog: CatalogSnapshot;
  /** Enabled project locales (length 1 hides the locale selector). */
  locales: LocaleCode[];
  defaultLocale: LocaleCode;
  onChange: (props: Record<string, unknown>) => void;
}

export function BlockPropsForm({ block, catalog, locales, defaultLocale, onChange }: BlockPropsFormProps) {
  const fields = useMemo(() => fieldsForBlockType(block.type), [block.type]);
  const [locale, setLocale] = useState<LocaleCode>(defaultLocale);
  // Mid-edit invalid values (a blanked required title, half a hex code)
  // live HERE, never in the document: the doc only ever receives props
  // the block schema accepts, so the canvas and the page gate stay
  // healthy while the issue is explained inline next to the form.
  // (The Inspector keys this component by block id, so drafts reset on
  // selection change.)
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const props = (draft ?? block.props) as Record<string, unknown>;
  const issue = useMemo(() => {
    const result = BLOCK_TYPES[block.type]?.safeParse(props);
    if (!result || result.success) return null;
    const first = result.error.issues[0];
    return `${first.path.join(".") || "props"}: ${first.message}`;
  }, [block.type, props]);
  if (!fields) return null;

  const set = (name: string, value: unknown) => {
    const next = { ...props };
    if (value === undefined) delete next[name];
    else next[name] = value;
    const valid = BLOCK_TYPES[block.type]?.safeParse(next).success;
    if (valid) {
      setDraft(null);
      onChange(next);
    } else {
      setDraft(next); // hold it — the inline issue says what's wrong
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-ink/10 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted">{block.type}</h4>
        {locales.length > 1 ? (
          <label className="flex items-center gap-1 text-[11px] text-muted">
            ✏️
            <select value={locale} onChange={(e) => setLocale(e.target.value as LocaleCode)} className="rounded border border-ink/15 px-1 py-0.5 text-[11px]" aria-label="Editing language">
              {locales.map((c) => (
                <option key={c} value={c}>{localeByCode(c)?.endonym ?? c}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {fields.map((f) => (
        <Field
          key={f.name}
          field={f}
          value={props[f.name]}
          locale={locale}
          defaultLocale={defaultLocale}
          catalog={catalog}
          onSet={(v) => set(f.name, v)}
        />
      ))}

      {issue ? <p className="rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">⚠ {issue}</p> : null}
    </div>
  );
}

// ── one field ───────────────────────────────────────────────
function Field({
  field,
  value,
  locale,
  defaultLocale,
  catalog,
  onSet,
}: {
  field: FieldSpec;
  value: unknown;
  locale: LocaleCode;
  defaultLocale: LocaleCode;
  catalog: CatalogSnapshot;
  onSet: (v: unknown) => void;
}) {
  const label = (
    <span className="mb-0.5 block text-[11px] uppercase tracking-wide text-muted">
      {field.label}
      {field.required ? <span className="text-accent"> *</span> : null}
    </span>
  );

  switch (field.kind) {
    case "text":
    case "href":
    case "image": {
      const v = typeof value === "string" ? value : "";
      return (
        <label className="block text-xs">
          {label}
          <input
            type="text"
            value={v}
            onChange={(e) => onSet(e.target.value || (field.required ? "" : undefined))}
            placeholder={field.kind === "href" ? "/shop or https://…" : field.kind === "image" ? "/img/uploads/… (🖼 Media panel uploads)" : ""}
            className={`${inputClass} ${field.kind !== "text" ? "font-mono" : ""}`}
            aria-label={field.label}
          />
        </label>
      );
    }

    case "translatable": {
      const t = value as Translatable | undefined;
      const editingDefault = locale === defaultLocale;
      const current = editingDefault
        ? typeof t === "string" ? t : resolveI18n(t, defaultLocale, defaultLocale)
        : isI18nString(t) ? (t._i18n[locale] ?? "") : "";
      const fallback = resolveI18n(t, defaultLocale, defaultLocale);
      return (
        <label className="block text-xs">
          {label}
          <input
            type="text"
            value={current}
            onChange={(e) => {
              const next = setLocaleValue(t, locale, e.target.value, defaultLocale);
              onSet(next === "" && !field.required ? undefined : next);
            }}
            placeholder={!editingDefault && fallback ? `${fallback} (translate)` : ""}
            dir={localeByCode(locale)?.dir}
            className={inputClass}
            aria-label={`${field.label} (${locale})`}
          />
        </label>
      );
    }

    case "richdoc": {
      // Simple paragraph docs edit as plain text; anything richer (marks,
      // headings, per-locale docs) honestly defers to the canvas/JSON.
      if (value !== undefined && !isSimpleDoc(value)) {
        return (
          <div className="text-xs">
            {label}
            <p className="rounded bg-cream/70 px-2 py-1 text-[11px] text-muted">
              Rich content (headings, bold, or translations) — edit it on the canvas or in the JSON view.
            </p>
          </div>
        );
      }
      const text = value === undefined ? "" : docToPlainText(value as RichTextDoc);
      return (
        <label className="block text-xs">
          {label}
          <textarea
            value={text}
            rows={Math.min(6, Math.max(2, text.split("\n").length))}
            onChange={(e) => {
              const v = e.target.value;
              onSet(v.trim() === "" && !field.required ? undefined : plainTextToDoc(v));
            }}
            placeholder="Blank line = new paragraph"
            className={inputClass}
            aria-label={field.label}
          />
        </label>
      );
    }

    case "boolean": {
      // Optional booleans are tri-state: absent means the block's own
      // default — never guess it; say so.
      const v = value === true ? "on" : value === false ? "off" : "";
      return (
        <label className="block text-xs">
          {label}
          <select value={v} onChange={(e) => onSet(e.target.value === "" ? undefined : e.target.value === "on")} className={inputClass} aria-label={field.label}>
            <option value="">(default)</option>
            <option value="on">on</option>
            <option value="off">off</option>
          </select>
        </label>
      );
    }

    case "number": {
      const v = typeof value === "number" ? String(value) : "";
      return (
        <label className="block text-xs">
          {label}
          <input
            type="number"
            value={v}
            min={field.min}
            max={field.max}
            onChange={(e) => {
              const n = e.target.value === "" ? NaN : Number(e.target.value);
              onSet(Number.isFinite(n) ? n : field.required ? field.min ?? 0 : undefined);
            }}
            className={inputClass}
            aria-label={field.label}
          />
        </label>
      );
    }

    case "select": {
      const v = value === undefined ? "" : String(value);
      return (
        <label className="block text-xs">
          {label}
          <select
            value={v}
            onChange={(e) => {
              if (e.target.value === "") return onSet(undefined);
              const opt = field.options?.find((o) => String(o.value) === e.target.value);
              onSet(opt?.value);
            }}
            className={inputClass}
            aria-label={field.label}
          >
            {!field.required ? <option value="">(default)</option> : null}
            {field.options?.map((o) => (
              <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
            ))}
          </select>
        </label>
      );
    }

    case "multiselect": {
      const selected = Array.isArray(value) ? (value as string[]) : null;
      return (
        <div className="text-xs">
          {label}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {field.options?.map((o) => {
              const checked = selected ? selected.includes(String(o.value)) : true; // absent = all
              return (
                <label key={String(o.value)} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const all = (field.options ?? []).map((x) => String(x.value));
                      const base = selected ?? all;
                      const next = e.target.checked ? [...new Set([...base, String(o.value)])] : base.filter((x) => x !== String(o.value));
                      // every box ticked = back to "all" (omit the prop)
                      onSet(next.length === all.length ? undefined : next);
                    }}
                    className="h-3 w-3 accent-ink"
                  />
                  {o.label}
                </label>
              );
            })}
          </div>
        </div>
      );
    }

    case "color": {
      const v = typeof value === "string" ? value : "";
      return (
        <div className="text-xs">
          {label}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(v) ? v : "#B08842"}
              onChange={(e) => onSet(e.target.value)}
              className="h-7 w-10 cursor-pointer rounded border border-ink/15"
              aria-label={`${field.label} picker`}
            />
            <input
              type="text"
              value={v}
              onChange={(e) => onSet(e.target.value || (field.required ? "" : undefined))}
              placeholder="(default)"
              className={`${inputClass} font-mono`}
              aria-label={field.label}
            />
          </div>
        </div>
      );
    }

    case "productRef": {
      const v = typeof value === "string" ? value : "";
      const refs = Object.entries(catalog).flatMap(([cat, products]) =>
        products.map((p) => ({ ref: `${cat}/${p.slug}`, label: `${p.name} (${cat})` }))
      );
      return (
        <label className="block text-xs">
          {label}
          <select value={v} onChange={(e) => onSet(e.target.value || undefined)} className={inputClass} aria-label={field.label}>
            <option value="">{field.required ? "— pick a product —" : "(none)"}</option>
            {refs.map((r) => (
              <option key={r.ref} value={r.ref}>{r.label}</option>
            ))}
          </select>
        </label>
      );
    }

    case "rows": {
      const rows = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
      const canAdd = field.rowsMax === undefined || rows.length < field.rowsMax;
      const canRemove = rows.length > (field.rowsMin ?? 0);
      const setRows = (next: Array<Record<string, unknown>>) => onSet(next.length === 0 && !field.required ? undefined : next);
      return (
        <div className="text-xs">
          {label}
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={String(row.id ?? i)} className="space-y-1.5 rounded-lg border border-ink/10 p-2">
                {(field.itemFields ?? []).map((sub) => (
                  <Field
                    key={sub.name}
                    field={sub}
                    value={row[sub.name]}
                    locale={locale}
                    defaultLocale={defaultLocale}
                    catalog={catalog}
                    onSet={(v) => {
                      const next = rows.slice();
                      const r = { ...row };
                      if (v === undefined) delete r[sub.name];
                      else r[sub.name] = v;
                      next[i] = r;
                      setRows(next);
                    }}
                  />
                ))}
                <div className="flex gap-1">
                  <RowBtn disabled={i === 0} onClick={() => setRows(swap(rows, i, i - 1))} title="Move up">↑</RowBtn>
                  <RowBtn disabled={i === rows.length - 1} onClick={() => setRows(swap(rows, i, i + 1))} title="Move down">↓</RowBtn>
                  <RowBtn disabled={!canRemove} onClick={() => setRows(rows.filter((_, j) => j !== i))} title="Remove" danger>✕</RowBtn>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => setRows([...rows, newRowValue(field.itemFields ?? [], field.rowsHaveId !== false)])}
            className="mt-1 rounded-full border border-ink/20 px-2.5 py-0.5 text-[11px] hover:bg-cream disabled:opacity-40"
          >
            + Add {field.label.toLowerCase().replace(/s$/, "")}
          </button>
        </div>
      );
    }

    case "group": {
      const obj = value as Record<string, unknown> | undefined;
      if (!obj) {
        return (
          <div className="text-xs">
            {label}
            <button
              type="button"
              onClick={() => {
                const fresh: Record<string, unknown> = {};
                for (const sub of field.itemFields ?? []) {
                  const v = sub.required ? defaultForField({ ...sub, required: true }) : undefined;
                  if (v !== undefined) fresh[sub.name] = v;
                  else if (sub.required) fresh[sub.name] = "";
                }
                onSet(fresh);
              }}
              className="rounded-full border border-ink/20 px-2.5 py-0.5 text-[11px] hover:bg-cream"
            >
              + Add {field.label.toLowerCase()}
            </button>
          </div>
        );
      }
      return (
        <div className="text-xs">
          {label}
          <div className="space-y-1.5 rounded-lg border border-ink/10 p-2">
            {(field.itemFields ?? []).map((sub) => (
              <Field
                key={sub.name}
                field={sub}
                value={obj[sub.name]}
                locale={locale}
                defaultLocale={defaultLocale}
                catalog={catalog}
                onSet={(v) => {
                  const next = { ...obj };
                  if (v === undefined) delete next[sub.name];
                  else next[sub.name] = v;
                  onSet(next);
                }}
              />
            ))}
            {!field.required ? (
              <button type="button" onClick={() => onSet(undefined)} className="rounded-full border border-red-300 px-2.5 py-0.5 text-[11px] text-red-700 hover:bg-red-50">
                Remove {field.label.toLowerCase()}
              </button>
            ) : null}
          </div>
        </div>
      );
    }

    case "constant":
      return (
        <p className="text-[11px] text-muted">
          {field.label}: <code className="font-mono">{field.constantValue}</code>
        </p>
      );

    case "json":
    default:
      return <JsonField label={field.label} value={value} required={field.required} onSet={onSet} ariaLabel={field.label} />;
  }
}

function JsonField({ label, value, required, onSet, ariaLabel }: { label: string; value: unknown; required: boolean; onSet: (v: unknown) => void; ariaLabel: string }) {
  const [text, setText] = useState(() => (value === undefined ? "" : JSON.stringify(value, null, 1)));
  const [bad, setBad] = useState(false);
  return (
    <label className="block text-xs">
      <span className="mb-0.5 block text-[11px] uppercase tracking-wide text-muted">{label} (JSON)</span>
      <textarea
        value={text}
        rows={3}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim() === "" && !required) {
            setBad(false);
            onSet(undefined);
            return;
          }
          try {
            onSet(JSON.parse(e.target.value));
            setBad(false);
          } catch {
            setBad(true);
          }
        }}
        className={`${inputClass} font-mono ${bad ? "border-red-400" : ""}`}
        aria-label={ariaLabel}
      />
    </label>
  );
}

function RowBtn({ children, onClick, disabled, title, danger }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title: string; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={
        danger
          ? "rounded border border-red-300 px-1.5 text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-30"
          : "rounded border border-ink/20 px-1.5 text-[11px] hover:bg-cream disabled:opacity-30"
      }
    >
      {children}
    </button>
  );
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  const next = arr.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
