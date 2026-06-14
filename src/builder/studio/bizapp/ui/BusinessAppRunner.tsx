"use client";

// ============================================================
// Business App Runner (§30) — runs ANY blueprint, offline
// ============================================================
// The generic runtime: renders a dashboard + per-table list/form from
// the blueprint, stores records locally (optionally AES-encrypted with a
// passphrase), exports CSV / backup, and supports an official-only
// payment link. No card data, ever.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import type { AppBlueprint, Field, Table } from "../schemas.ts";
import { emptyData, addRecord, updateRecord, deleteRecord, searchRecords, recordLabel, tableCsv, serializeData, parseDataBackup, type AppData, type Rec } from "../runtime.ts";
import { encryptData, decryptData, isEncrypted } from "../secure.ts";
import { paymentConnectorSchema, checkPaymentConnector, PAYMENT_PROVIDERS, PAYMENTS_DISCLOSURE, type PaymentConnector } from "../payments.ts";

const cardCls = "rounded-2xl border border-ink/10 bg-white/60 p-4";
const field = "w-full rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
const toCents = (v: string) => Math.max(0, Math.round((Number(v.replace(/[^\d.]/g, "")) || 0) * 100));
function dl(text: string, name: string, type = "text/csv") { const u = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); }

export function BusinessAppRunner({ blueprint, onExit }: { blueprint: AppBlueprint; onExit: () => void }) {
  const dataKey = `lusik_bizapp_data_${blueprint.id}`;
  const payKey = `lusik_bizapp_pay_${blueprint.id}`;
  const [data, setData] = useState<AppData>(() => emptyData(blueprint));
  const [tableId, setTableId] = useState(blueprint.tables[0]?.id ?? "");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Rec | "new" | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [pass, setPass] = useState<string>(""); // session passphrase (if encrypted)
  const [locked, setLocked] = useState(false);
  const [unlockTry, setUnlockTry] = useState("");
  const [pay, setPay] = useState<PaymentConnector>({ provider: "none", checkoutUrl: "", note: "" });
  const [msg, setMsg] = useState("");

  // load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(dataKey);
      if (raw && isEncrypted(raw)) setLocked(true);
      else if (raw) setData({ ...emptyData(blueprint), ...JSON.parse(raw) });
      const p = localStorage.getItem(payKey); if (p) setPay(paymentConnectorSchema.parse(JSON.parse(p)));
    } catch { /* */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprint.id]);

  const persist = async (next: AppData) => {
    setData(next);
    try { localStorage.setItem(dataKey, pass ? await encryptData(next, pass) : JSON.stringify(next)); } catch { /* */ }
  };
  useEffect(() => { try { localStorage.setItem(payKey, JSON.stringify(pay)); } catch { /* */ } }, [pay, payKey]);

  const table = blueprint.tables.find((t) => t.id === tableId) ?? blueprint.tables[0] ?? null;
  const results = useMemo(() => (table ? searchRecords(data, table, q) : []), [data, table, q]);
  const payCheck = checkPaymentConnector(pay);

  if (locked) {
    return (
      <div className="mx-auto max-w-sm py-12 text-center font-body text-ink">
        <p className="font-display text-xl">🔒 {blueprint.name}</p>
        <p className="mt-1 text-sm text-muted">This app's data is encrypted. Enter the passphrase.</p>
        <input type="password" value={unlockTry} onChange={(e) => setUnlockTry(e.target.value)} className={`mt-2 ${field}`} aria-label="Passphrase" />
        <button type="button" onClick={async () => { try { const raw = localStorage.getItem(dataKey)!; const d = await decryptData<AppData>(raw, unlockTry); setData({ ...emptyData(blueprint), ...d }); setPass(unlockTry); setLocked(false); setMsg(""); } catch (e) { setMsg((e as Error).message); } }} className="mt-2 rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream">Unlock</button>
        <button type="button" onClick={onExit} className="mt-2 block w-full text-xs text-muted underline">Back to the blueprint</button>
        {msg ? <p className="mt-2 text-xs text-red-700">{msg}</p> : null}
      </div>
    );
  }

  const startAdd = () => { setEditing("new"); setForm({}); };
  const startEdit = (r: Rec) => { setEditing(r); setForm({ ...r }); };
  const saveForm = async () => {
    if (!table) return;
    // money fields already stored as cents in `form`
    if (editing === "new") await persist(addRecord(data, table.id, form));
    else if (editing) await persist(updateRecord(data, table.id, (editing as Rec).id, form));
    setEditing(null);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-body text-ink">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl">▶ {blueprint.name}</h1>
        <button type="button" onClick={onExit} className="rounded-full border border-ink/20 px-3 py-1 text-sm">‹ Edit blueprint</button>
      </div>
      <p className="mt-1 rounded-lg bg-cream/70 px-3 py-2 text-[11px]">Running your generated app. Data is saved on this device{pass ? " (encrypted)" : ""}. Never store payment card numbers — payments use an official hosted checkout.</p>

      <nav className="mt-3 flex flex-wrap gap-1.5">
        {blueprint.tables.map((t) => <button key={t.id} type="button" onClick={() => { setTableId(t.id); setEditing(null); }} className={`rounded-full border px-3 py-1 text-xs ${t.id === table?.id ? "border-ink bg-ink text-cream" : "border-ink/20 hover:bg-cream"}`}>{t.name} ({(data[t.id] ?? []).length})</button>)}
      </nav>

      {table ? (
        <section className="mt-4">
          {editing ? (
            <div className={cardCls}>
              <h2 className="mb-2 font-display text-base">{editing === "new" ? `Add ${table.name}` : `Edit`}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {table.fields.map((f) => <FieldInput key={f.name} f={f} value={form[f.name]} onChange={(v) => setForm((s) => ({ ...s, [f.name]: v }))} blueprint={blueprint} data={data} />)}
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => void saveForm()} className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream">Save</button>
                <button type="button" onClick={() => setEditing(null)} className="rounded-full border border-ink/20 px-4 py-1.5 text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${table.name.toLowerCase()}…`} className={field} aria-label="Search" />
                <button type="button" onClick={startAdd} className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream">+ Add</button>
              </div>
              <ul className="mt-3 space-y-1">
                {results.map((r) => <li key={r.id}><button type="button" onClick={() => startEdit(r)} className="flex w-full items-center justify-between rounded-lg border border-ink/10 px-2 py-1.5 text-left text-sm hover:bg-cream"><span>{recordLabel(r, table)}</span><span className="text-xs text-muted">{secondField(r, table)}</span></button></li>)}
                {results.length === 0 ? <li className="text-sm text-muted">No records{q ? " match" : " yet"}.</li> : null}
              </ul>
              <div className="mt-2"><button type="button" onClick={() => dl(tableCsv(table, data[table.id] ?? []), `${table.id}.csv`)} className="rounded-full border border-ink/20 px-3 py-1 text-xs">Export {table.name} CSV</button></div>
            </>
          )}
        </section>
      ) : null}

      {/* settings: encryption + payments + backup */}
      <details className="mt-6 rounded-xl border border-ink/10">
        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">Settings — security, payments, backup</summary>
        <div className="space-y-3 px-3 pb-3 text-sm">
          <div>
            <p className="font-medium">Encrypt this app's data (optional)</p>
            {pass ? (
              <button type="button" onClick={async () => { setPass(""); try { localStorage.setItem(dataKey, JSON.stringify(data)); } catch { /* */ } setMsg("Protection removed."); }} className="mt-1 rounded-full border border-red-300 px-3 py-1 text-xs text-red-700">Remove passphrase</button>
            ) : (
              <div className="mt-1 flex gap-2">
                <input type="password" value={form.__pp as string ?? ""} onChange={(e) => setForm((s) => ({ ...s, __pp: e.target.value }))} placeholder="Passphrase (8+ chars)" className={field} aria-label="New passphrase" />
                <button type="button" onClick={async () => { const pp = String(form.__pp ?? ""); if (pp.length < 8) { setMsg("Passphrase must be 8+ characters."); return; } setPass(pp); try { localStorage.setItem(dataKey, await encryptData(data, pp)); } catch { /* */ } setForm((s) => { const c = { ...s }; delete c.__pp; return c; }); setMsg("Data is now encrypted on this device. No passphrase = no recovery."); }} className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs text-cream">Encrypt</button>
              </div>
            )}
          </div>
          <div>
            <p className="font-medium">Payments (official checkout only)</p>
            <p className="text-[11px] text-muted">{PAYMENTS_DISCLOSURE}</p>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              <select value={pay.provider} onChange={(e) => setPay({ ...pay, provider: e.target.value as PaymentConnector["provider"] })} className={field} aria-label="Payment provider">{PAYMENT_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
              {pay.provider !== "none" ? <input value={pay.checkoutUrl} onChange={(e) => setPay({ ...pay, checkoutUrl: e.target.value })} placeholder="https://… official checkout link" className={field} aria-label="Checkout link" /> : null}
            </div>
            {pay.provider !== "none" ? (payCheck.ok ? <a href={pay.checkoutUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-accent underline">Open checkout ↗</a> : <p className="mt-1 text-xs text-amber-800">{payCheck.reason}</p>) : null}
          </div>
          <div>
            <p className="font-medium">Backup</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <button type="button" onClick={() => dl(serializeData(blueprint.id, data), `${blueprint.id}-data.json`, "application/json")} className="rounded-full border border-ink/20 px-3 py-1 text-xs">Back up data (file)</button>
              <label className="rounded-full border border-ink/20 px-3 py-1 text-xs cursor-pointer">Restore…<input type="file" accept="application/json,.json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const b = parseDataBackup(await f.text()); await persist({ ...emptyData(blueprint), ...b.data }); setMsg("Restored."); } catch (err) { setMsg((err as Error).message); } e.target.value = ""; }} /></label>
              <span className="text-[11px] text-muted">Move data to another device: back up here, restore there (the offline way to sync).</span>
            </div>
          </div>
        </div>
      </details>
      {msg ? <p className="mt-2 text-xs" data-testid="runner-msg">{msg}</p> : null}
    </main>
  );
}

function secondField(r: Rec, t: Table): string {
  const f = t.fields.filter((x) => x.type !== "longtext")[1];
  if (!f) return "";
  const v = r[f.name];
  if (f.type === "money" && typeof v === "number") return `$${(v / 100).toFixed(2)}`;
  if (f.type === "bool") return v ? "✓" : "";
  return v == null ? "" : String(v);
}

function FieldInput({ f, value, onChange, blueprint, data }: { f: Field; value: unknown; onChange: (v: unknown) => void; blueprint: AppBlueprint; data: AppData }) {
  const lab = <span className="mb-1 block text-xs text-muted">{f.label || f.name}{f.required ? " *" : ""}</span>;
  if (f.type === "longtext") return <label className="block sm:col-span-2">{lab}<textarea value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} rows={2} className={field} aria-label={f.name} /></label>;
  if (f.type === "bool") return <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-ink" />{f.label || f.name}</label>;
  if (f.type === "number") return <label className="block">{lab}<input type="number" value={Number(value ?? 0)} onChange={(e) => onChange(Number(e.target.value))} className={field} aria-label={f.name} /></label>;
  if (f.type === "money") return <label className="block">{lab}<input inputMode="decimal" defaultValue={typeof value === "number" ? (value / 100).toFixed(2) : ""} onBlur={(e) => onChange(toCents(e.target.value))} placeholder="$" className={field} aria-label={f.name} /></label>;
  if (f.type === "date") return <label className="block">{lab}<input type="date" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={field} aria-label={f.name} /></label>;
  if (f.type === "time") return <label className="block">{lab}<input type="time" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={field} aria-label={f.name} /></label>;
  if (f.type === "select") return <label className="block">{lab}<select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={field} aria-label={f.name}><option value="">—</option>{f.options.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>;
  if (f.type === "relation") {
    const rel = blueprint.tables.find((t) => t.id === f.relationTableId);
    const recs = rel ? data[rel.id] ?? [] : [];
    return <label className="block">{lab}<select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={field} aria-label={f.name}><option value="">—</option>{recs.map((r) => <option key={r.id} value={r.id}>{rel ? recordLabel(r, rel) : r.id}</option>)}</select></label>;
  }
  return <label className="block">{lab}<input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={field} aria-label={f.name} /></label>;
}
