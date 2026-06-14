"use client";

// ============================================================
// Business App Builder (§30, Phase 3) — workspace
// ============================================================
// Describe or pick a small business tool, edit its tables/fields, and
// export a blueprint (config + JSON-Schema per table + screens + docs).
// Offline; refuses payment-card fields.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import {
  appBlueprintSchema, FIELD_TYPES, APP_TEMPLATE_LIST, makeAppTemplate, vibeApp, validateBlueprint,
  withDerivedScreens, generateApp, type AppBlueprint, type Field, type Table,
} from "../index.ts";
import { BusinessAppRunner } from "./BusinessAppRunner.tsx";

const cardCls = "rounded-2xl border border-ink/10 bg-white/60 p-4";
const field = "w-full rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
const STORE = "lusik_bizapp_current";
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "business-app";
function dlBlob(blob: Blob, name: string) { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); }

export function BusinessAppBuilder() {
  const [app, setApp] = useState<AppBlueprint | null>(null);
  const [vibe, setVibe] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => { try { const r = localStorage.getItem(STORE); if (r) setApp(appBlueprintSchema.parse(JSON.parse(r))); } catch { /* */ } }, []);
  useEffect(() => { if (app) try { localStorage.setItem(STORE, JSON.stringify(app)); } catch { /* */ } }, [app]);

  const issues = useMemo(() => (app ? validateBlueprint(app) : []), [app]);
  const setTables = (tables: Table[]) => setApp((a) => (a ? withDerivedScreens({ ...a, tables }) : a));

  const exportZip = async () => {
    if (!app) return;
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const [path, content] of Object.entries(generateApp(app).files)) zip.file(path, content);
    dlBlob(await zip.generateAsync({ type: "blob" }), `${slug(app.name)}.zip`);
  };

  if (!app) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 font-body text-ink">
        <h1 className="font-display text-3xl">🧰 Business App Builder</h1>
        <p className="mt-1 text-sm text-muted">Describe a small business tool and get a working blueprint — tables, fields, and screens — that exports as clean schema files. Offline. (For a fully-running example, see Store Manager.)</p>
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Describe it</h2>
          <textarea value={vibe} onChange={(e) => setVibe(e.target.value)} rows={2} placeholder='e.g. "an appointment tracker", "repair shop tickets", "service quotes"' className={field} aria-label="Describe your app" />
          <button type="button" onClick={() => { const r = vibeApp(vibe); setApp(r.blueprint); setNotes(r.notes); }} className="mt-2 rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream hover:opacity-90">Build it</button>
          {notes.length ? <ul className="mt-2 list-disc pl-5 text-xs text-muted">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul> : null}
        </section>
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Or pick a template</h2>
          <div className="grid gap-2 sm:grid-cols-2">{APP_TEMPLATE_LIST.map((t) => <button key={t.key} type="button" onClick={() => { setApp(makeAppTemplate(t.key)); setNotes([]); }} className={`${cardCls} text-left hover:bg-cream`}><span className="font-medium">{t.name}</span><span className="block text-xs text-muted">{t.description}</span></button>)}</div>
        </section>
        <p className="mt-6 text-[11px] text-muted">Never stores payment card data — for payments use an official processor (Square/Clover/Stripe).</p>
      </main>
    );
  }

  if (running) return <BusinessAppRunner blueprint={app} onExit={() => setRunning(false)} />;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-body text-ink">
      <div className="flex items-center justify-between gap-2">
        <input value={app.name} onChange={(e) => setApp({ ...app, name: e.target.value })} className="bg-transparent font-display text-2xl focus:outline-none" aria-label="App name" />
        <span className="flex gap-2">
          <button type="button" onClick={() => setRunning(true)} disabled={validateBlueprint(app).some((i) => i.level === "error")} className="rounded-full bg-ink px-3 py-1 text-sm font-medium text-cream disabled:opacity-40">▶ Run app</button>
          <button type="button" onClick={() => { setApp(null); setNotes([]); }} className="rounded-full border border-ink/20 px-3 py-1 text-sm">‹ New app</button>
        </span>
      </div>

      {issues.length ? (
        <div className={`mt-3 ${cardCls} ${issues.some((i) => i.level === "error") ? "border-amber-300 bg-amber-50" : ""}`}>
          <ul className="list-disc pl-5 text-xs">{issues.map((i, n) => <li key={n} className={i.level === "error" ? "text-red-700" : "text-muted"}>{i.message}</li>)}</ul>
        </div>
      ) : null}

      <section className="mt-4 space-y-3">
        {app.tables.map((t) => (
          <div key={t.id} className={cardCls}>
            <div className="mb-2 flex items-center justify-between">
              <input value={t.name} onChange={(e) => setTables(app.tables.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))} className="bg-transparent font-display text-base focus:outline-none" aria-label="Table name" />
              {app.tables.length > 1 ? <button type="button" onClick={() => setTables(app.tables.filter((x) => x.id !== t.id))} className="text-xs text-red-700">Delete table</button> : null}
            </div>
            <ul className="space-y-1">
              {t.fields.map((f, i) => (
                <li key={i} className="grid items-center gap-1 sm:grid-cols-[1fr_120px_70px_24px]">
                  <input value={f.name} onChange={(e) => setTables(app.tables.map((x) => x.id === t.id ? { ...x, fields: x.fields.map((y, j) => j === i ? { ...y, name: e.target.value, label: e.target.value } : y) } : x))} placeholder="field name" className={field} aria-label="Field name" />
                  <select value={f.type} onChange={(e) => setTables(app.tables.map((x) => x.id === t.id ? { ...x, fields: x.fields.map((y, j) => j === i ? { ...y, type: e.target.value as Field["type"] } : y) } : x))} className={field} aria-label="Field type">{FIELD_TYPES.map((ft) => <option key={ft} value={ft}>{ft}</option>)}</select>
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.required} onChange={(e) => setTables(app.tables.map((x) => x.id === t.id ? { ...x, fields: x.fields.map((y, j) => j === i ? { ...y, required: e.target.checked } : y) } : x))} className="h-3.5 w-3.5 accent-ink" />req</label>
                  <button type="button" onClick={() => setTables(app.tables.map((x) => x.id === t.id ? { ...x, fields: x.fields.filter((_, j) => j !== i) } : x))} className="text-xs text-red-700">✕</button>
                  {f.type === "select" ? <input value={f.options.join(", ")} onChange={(e) => setTables(app.tables.map((x) => x.id === t.id ? { ...x, fields: x.fields.map((y, j) => j === i ? { ...y, options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) } : y) } : x))} placeholder="options: a, b, c" className={`${field} sm:col-span-4`} aria-label="Select options" /> : null}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setTables(app.tables.map((x) => x.id === t.id ? { ...x, fields: [...x.fields, { name: "field", label: "field", type: "text", required: false, options: [], relationTableId: "" }] } : x))} className="mt-2 rounded-full border border-ink/20 px-3 py-1 text-xs">+ Field</button>
          </div>
        ))}
        <button type="button" onClick={() => setTables([...app.tables, { id: `table-${Date.now()}`, name: "New table", fields: [{ name: "title", label: "title", type: "text", required: true, options: [], relationTableId: "" }] }])} className="rounded-full border border-ink/30 px-4 py-1.5 text-sm">+ Table</button>
      </section>

      <section className="mt-4">
        <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Screens (auto-generated)</h2>
        <div className="flex flex-wrap gap-1.5 text-xs">{app.screens.map((s) => <span key={s.id} className="rounded-full border border-ink/15 px-2.5 py-1">{s.title} <span className="text-muted">({s.type})</span></span>)}</div>
      </section>

      <section className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void exportZip()} className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream hover:opacity-90">⬇ Export blueprint (ZIP)</button>
        <button type="button" onClick={() => dlBlob(new Blob([JSON.stringify(app, null, 2)], { type: "application/json" }), `${slug(app.name)}-config.json`)} className="rounded-full border border-ink/30 px-4 py-2 text-sm">Download config</button>
      </section>
      <p className="mt-2 rounded-lg bg-cream/70 px-3 py-2 text-[11px] text-muted">Exports a blueprint (config + a JSON-Schema per table + screen list + privacy notes). Data stays local; never store payment card data — use an official processor.</p>
    </main>
  );
}
