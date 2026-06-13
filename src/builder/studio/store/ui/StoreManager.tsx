"use client";

// ============================================================
// Store Manager (§30, Phase 4) — offline small-business app
// ============================================================
// Customers, inventory, barcode-by-keyboard, orders + purchase
// history, low-stock, CSV reports, backup/restore — all on this
// device (localStorage). No card data is ever stored.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import {
  emptyStore, storeSchema, RETENTIONS, type Store, type Customer, type Product, type Order, type OrderItem,
} from "../index.ts";
import {
  searchCustomers, searchProducts, lookupByBarcode, lowStock, recordOrder, purchaseHistory, customerTotals,
  adjustStock, anonymizeCustomer, deleteCustomer, orderTotalCents, applyRetention,
} from "../engine.ts";
import { toCsv, serializeStore, parseStoreBackup } from "../io.ts";
import { STORE_REPORTS, reportHtml } from "../reports.ts";
import { xlsxParts } from "../xlsx.ts";

const card = "rounded-2xl border border-ink/10 bg-white/60 p-4";
const field = "w-full rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
const STORE_KEY = "lusik_store_v1";
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const nid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const toCents = (v: string) => Math.max(0, Math.round((Number(v.replace(/[^\d.]/g, "")) || 0) * 100));

function dl(text: string, filename: string, type = "text/csv") {
  dlBlob(new Blob([text], { type }), filename);
}
function dlBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

type View = "dashboard" | "customers" | "inventory" | "order" | "reports" | "settings";

export function StoreManager() {
  const [store, setStore] = useState<Store>(emptyStore());
  const [view, setView] = useState<View>("dashboard");
  const [unlocked, setUnlocked] = useState(false);
  const [pinTry, setPinTry] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) setStore(storeSchema.parse(JSON.parse(raw))); } catch { /* */ }
  }, []);
  useEffect(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* */ } }, [store]);

  const locked = store.settings.pinLock && !unlocked;
  const low = useMemo(() => lowStock(store), [store]);

  if (locked) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16 text-center font-body text-ink">
        <h1 className="font-display text-2xl">🔒 {store.settings.storeName}</h1>
        <p className="mt-2 text-sm text-muted">Enter the PIN to open this device's store data.</p>
        <input value={pinTry} onChange={(e) => setPinTry(e.target.value)} type="password" inputMode="numeric" className={`mt-3 ${field}`} aria-label="PIN" />
        <button type="button" onClick={() => { if (pinTry === store.settings.pinLock) { setUnlocked(true); setPinTry(""); } else setMsg("Wrong PIN."); }} className="mt-2 rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream">Unlock</button>
        {msg ? <p className="mt-2 text-xs text-red-700">{msg}</p> : null}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-body text-ink">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">🏪 {store.settings.storeName}</h1>
        <span className="text-xs text-muted">{store.customers.length} customers · {store.products.length} products</span>
      </div>
      <p className="mt-1 rounded-lg bg-cream/70 px-3 py-2 text-xs">Everything is saved on this device only. No payment card numbers are ever stored — record a payment label like “Cash” or “Card via Square.” Back up regularly.</p>

      <nav className="mt-3 flex flex-wrap gap-1.5">
        {(["dashboard", "customers", "inventory", "order", "reports", "settings"] as const).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} className={`rounded-full border px-3 py-1 text-xs capitalize ${view === v ? "border-ink bg-ink text-cream" : "border-ink/20 hover:bg-cream"}`}>{v === "order" ? "New order" : v}</button>
        ))}
      </nav>

      {view === "dashboard" ? <Dashboard store={store} low={low} go={setView} /> : null}
      {view === "customers" ? <Customers store={store} setStore={setStore} /> : null}
      {view === "inventory" ? <Inventory store={store} setStore={setStore} low={low} /> : null}
      {view === "order" ? <NewOrder store={store} setStore={setStore} setMsg={setMsg} /> : null}
      {view === "reports" ? <Reports store={store} /> : null}
      {view === "settings" ? <Settings store={store} setStore={setStore} setMsg={setMsg} /> : null}
      {msg ? <p className="mt-3 text-xs" data-testid="store-msg">{msg}</p> : null}
    </main>
  );
}

function Dashboard({ store, low, go }: { store: Store; low: Product[]; go: (v: View) => void }) {
  const revenue = store.orders.reduce((s, o) => s + orderTotalCents(o), 0);
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className={card}><p className="text-xs text-muted">Customers</p><p className="font-display text-2xl">{store.customers.length}</p></div>
      <div className={card}><p className="text-xs text-muted">Products</p><p className="font-display text-2xl">{store.products.length}</p></div>
      <div className={card}><p className="text-xs text-muted">Orders</p><p className="font-display text-2xl">{store.orders.length}</p></div>
      <div className={card}><p className="text-xs text-muted">Recorded sales</p><p className="font-display text-2xl">{usd(revenue)}</p></div>
      <button type="button" onClick={() => go("inventory")} className={`${card} text-left sm:col-span-2 ${low.length ? "border-amber-300 bg-amber-50" : ""}`}>
        <p className="text-sm font-medium">{low.length ? `⚠️ ${low.length} item(s) low on stock` : "✅ Stock looks healthy"}</p>
        {low.length ? <p className="text-xs text-muted">{low.map((p) => p.name).join(", ")}</p> : null}
      </button>
      <p className="text-[11px] text-muted sm:col-span-2">Last backup: {store.settings.lastBackup || "never — back up in Settings"}.</p>
    </div>
  );
}

function Customers({ store, setStore }: { store: Store; setStore: (s: Store) => void }) {
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const results = searchCustomers(store, q);
  const open = store.customers.find((c) => c.id === openId) ?? null;
  const upd = (id: string, patch: Partial<Customer>) => setStore({ ...store, customers: store.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const add = () => { const c: Customer = { id: nid("c"), firstName: "", lastName: "", phone: "", email: "", address: "", birthday: "", notes: "", preferences: "", favoriteProducts: [], tags: [], consentToContact: false, createdAt: today(), lastVisit: "" }; setStore({ ...store, customers: [c, ...store.customers] }); setOpenId(c.id); };

  if (open) {
    const t = customerTotals(store, open.id);
    const hist = purchaseHistory(store, open.id);
    return (
      <div className="mt-4">
        <button type="button" onClick={() => setOpenId(null)} className="text-xs text-accent underline underline-offset-2">‹ Back to customers</button>
        <div className={`mt-2 ${card}`}>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs"><span className="mb-1 block text-muted">First name</span><input value={open.firstName} onChange={(e) => upd(open.id, { firstName: e.target.value })} className={field} aria-label="First name" /></label>
            <label className="text-xs"><span className="mb-1 block text-muted">Last name</span><input value={open.lastName} onChange={(e) => upd(open.id, { lastName: e.target.value })} className={field} aria-label="Last name" /></label>
            <label className="text-xs"><span className="mb-1 block text-muted">Phone</span><input value={open.phone} onChange={(e) => upd(open.id, { phone: e.target.value })} className={field} aria-label="Phone" /></label>
            <label className="text-xs"><span className="mb-1 block text-muted">Email</span><input value={open.email} onChange={(e) => upd(open.id, { email: e.target.value })} className={field} aria-label="Email" /></label>
          </div>
          <label className="mt-2 block text-xs"><span className="mb-1 block text-muted">Notes & preferences</span><textarea value={open.notes} onChange={(e) => upd(open.id, { notes: e.target.value })} rows={2} className={field} aria-label="Notes" /></label>
          <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={open.consentToContact} onChange={(e) => upd(open.id, { consentToContact: e.target.checked })} className="h-3.5 w-3.5 accent-ink" /> Okay to contact</label>
          <p className="mt-2 text-sm">Lifetime: <strong>{t.orders}</strong> orders · <strong>{usd(t.spentCents)}</strong>{open.lastVisit ? ` · last visit ${open.lastVisit.slice(0, 10)}` : ""}</p>
          <div className="mt-2 flex gap-3">
            <button type="button" onClick={() => { if (confirm("Anonymize this customer? Their orders stay for accounting, but personal details are removed.")) { setStore(anonymizeCustomer(store, open.id)); } }} className="text-xs text-amber-800">Anonymize</button>
            <button type="button" onClick={() => { if (confirm("Delete this customer permanently? Their orders become guest orders.")) { setStore(deleteCustomer(store, open.id)); setOpenId(null); } }} className="text-xs text-red-700">Delete</button>
          </div>
        </div>
        <h3 className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">Purchase history ({hist.length})</h3>
        <ul className="mt-1 space-y-1 text-sm">{hist.map((o) => <li key={o.id} className="rounded-lg border border-ink/10 px-2 py-1 text-xs">{o.date.slice(0, 10)} · {o.items.map((it) => `${it.qty}× ${it.name}`).join(", ") || "—"} · <strong>{usd(orderTotalCents(o))}</strong></li>)}{hist.length === 0 ? <li className="text-xs text-muted">No purchases yet.</li> : null}</ul>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, email…" className={field} aria-label="Search customers" />
        <button type="button" onClick={add} className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream">+ Add</button>
      </div>
      <ul className="mt-3 space-y-1">
        {results.map((c) => <li key={c.id}><button type="button" onClick={() => setOpenId(c.id)} className="flex w-full items-center justify-between rounded-lg border border-ink/10 px-2 py-1.5 text-left text-sm hover:bg-cream"><span>{c.firstName} {c.lastName} <span className="text-xs text-muted">{c.phone}</span></span><span className="text-xs text-muted">{usd(customerTotals(store, c.id).spentCents)}</span></button></li>)}
        {results.length === 0 ? <li className="text-sm text-muted">No customers{q ? " match" : " yet"}.</li> : null}
      </ul>
    </div>
  );
}

function Inventory({ store, setStore, low }: { store: Store; setStore: (s: Store) => void; low: Product[] }) {
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const lowIds = new Set(low.map((p) => p.id));
  const results = searchProducts(store, q);
  const open = store.products.find((p) => p.id === openId) ?? null;
  const upd = (id: string, patch: Partial<Product>) => setStore({ ...store, products: store.products.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now() } : p)) });
  const add = () => { const p: Product = { id: nid("p"), name: "", sku: "", barcode: "", category: "", vendor: "", costCents: 0, priceCents: 0, stock: 0, reorderThreshold: 0, supplier: "", variant: "", notes: "", createdAt: today(), updatedAt: now() }; setStore({ ...store, products: [p, ...store.products] }); setOpenId(p.id); };

  if (open) {
    return (
      <div className="mt-4">
        <button type="button" onClick={() => setOpenId(null)} className="text-xs text-accent underline underline-offset-2">‹ Back to inventory</button>
        <div className={`mt-2 ${card}`}>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs"><span className="mb-1 block text-muted">Name</span><input value={open.name} onChange={(e) => upd(open.id, { name: e.target.value })} className={field} aria-label="Product name" /></label>
            <label className="text-xs"><span className="mb-1 block text-muted">Barcode</span><input value={open.barcode} onChange={(e) => upd(open.id, { barcode: e.target.value })} className={field} aria-label="Barcode" /></label>
            <label className="text-xs"><span className="mb-1 block text-muted">SKU</span><input value={open.sku} onChange={(e) => upd(open.id, { sku: e.target.value })} className={field} aria-label="SKU" /></label>
            <label className="text-xs"><span className="mb-1 block text-muted">Category</span><input value={open.category} onChange={(e) => upd(open.id, { category: e.target.value })} className={field} aria-label="Category" /></label>
            <label className="text-xs"><span className="mb-1 block text-muted">Price ($)</span><input inputMode="decimal" defaultValue={(open.priceCents / 100).toFixed(2)} onBlur={(e) => upd(open.id, { priceCents: toCents(e.target.value) })} className={field} aria-label="Price" /></label>
            <label className="text-xs"><span className="mb-1 block text-muted">Cost ($)</span><input inputMode="decimal" defaultValue={(open.costCents / 100).toFixed(2)} onBlur={(e) => upd(open.id, { costCents: toCents(e.target.value) })} className={field} aria-label="Cost" /></label>
            <label className="text-xs"><span className="mb-1 block text-muted">Stock</span><input type="number" value={open.stock} onChange={(e) => upd(open.id, { stock: Number(e.target.value) })} className={field} aria-label="Stock" /></label>
            <label className="text-xs"><span className="mb-1 block text-muted">Reorder at</span><input type="number" value={open.reorderThreshold} onChange={(e) => upd(open.id, { reorderThreshold: Math.max(0, Number(e.target.value)) })} className={field} aria-label="Reorder threshold" /></label>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-muted">Quick stock:</span>
            <button type="button" onClick={() => setStore(adjustStock(store, open.id, 1, "manual +1", now()))} className="rounded-full border border-ink/20 px-2.5 py-1">+1</button>
            <button type="button" onClick={() => setStore(adjustStock(store, open.id, -1, "manual -1", now()))} className="rounded-full border border-ink/20 px-2.5 py-1">−1</button>
            <button type="button" onClick={() => setStore(adjustStock(store, open.id, 10, "restock +10", now()))} className="rounded-full border border-ink/20 px-2.5 py-1">+10</button>
            <button type="button" onClick={() => { if (confirm("Delete this product?")) { setStore({ ...store, products: store.products.filter((p) => p.id !== open.id) }); setOpenId(null); } }} className="ml-auto text-red-700">Delete</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or scan barcode…" onKeyDown={(e) => { if (e.key === "Enter") { const hit = lookupByBarcode(store, q); if (hit.product) { setOpenId(hit.product.id); setQ(""); } } }} className={field} aria-label="Search products" />
        <button type="button" onClick={add} className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream">+ Add</button>
      </div>
      <ul className="mt-3 space-y-1">
        {results.map((p) => <li key={p.id}><button type="button" onClick={() => setOpenId(p.id)} className={`flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-left text-sm hover:bg-cream ${lowIds.has(p.id) ? "border-amber-300 bg-amber-50" : "border-ink/10"}`}><span>{p.name || "(unnamed)"} <span className="text-xs text-muted">{p.barcode || p.sku}</span></span><span className="text-xs text-muted">{usd(p.priceCents)} · stock {p.stock}{lowIds.has(p.id) ? " ⚠️" : ""}</span></button></li>)}
        {results.length === 0 ? <li className="text-sm text-muted">No products{q ? " match" : " yet"}.</li> : null}
      </ul>
    </div>
  );
}

function NewOrder({ store, setStore, setMsg }: { store: Store; setStore: (s: Store) => void; setMsg: (s: string) => void }) {
  const [customerId, setCustomerId] = useState("");
  const [scan, setScan] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [payment, setPayment] = useState("Cash");
  const scanRef = useRef<HTMLInputElement | null>(null);

  const addByBarcode = () => {
    const hit = lookupByBarcode(store, scan);
    if (hit.product) {
      setItems((prev) => {
        const ex = prev.find((it) => it.productId === hit.product!.id);
        return ex ? prev.map((it) => (it.productId === hit.product!.id ? { ...it, qty: it.qty + 1 } : it)) : [...prev, { productId: hit.product!.id, name: hit.product!.name, qty: 1, unitPriceCents: hit.product!.priceCents }];
      });
      setScan("");
    } else setMsg(`No product for “${scan}”. Add it in Inventory first.`);
    scanRef.current?.focus();
  };
  const total = orderTotalCents({ items, discountCents: 0, taxCents: 0 });
  const submit = () => {
    if (items.length === 0) { setMsg("Add at least one item."); return; }
    const order: Order = { id: nid("o"), customerId, date: now(), items, discountCents: 0, taxCents: 0, paymentMethodLabel: payment, notes: "", receiptNumber: nid("R").toUpperCase(), source: "in-store" };
    setStore(recordOrder(store, order, now()));
    setItems([]); setCustomerId(""); setMsg(`✅ Recorded order — ${usd(total)}. Stock updated.`);
  };

  return (
    <div className="mt-4">
      <label className="block text-xs"><span className="mb-1 block text-muted">Customer (optional)</span>
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={field} aria-label="Customer">
          <option value="">Guest</option>
          {store.customers.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} {c.phone ? `(${c.phone})` : ""}</option>)}
        </select>
      </label>
      <div className="mt-2 flex gap-2">
        <input ref={scanRef} value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addByBarcode(); }} placeholder="Scan or type a barcode, press Enter" className={field} aria-label="Scan barcode" />
        <button type="button" onClick={addByBarcode} className="shrink-0 rounded-full border border-ink/30 px-4 py-2 text-sm">Add</button>
      </div>
      <ul className="mt-3 space-y-1">
        {items.map((it) => <li key={it.productId} className="flex items-center justify-between rounded-lg border border-ink/10 px-2 py-1 text-sm"><span>{it.name}</span><span className="flex items-center gap-2"><button type="button" onClick={() => setItems((p) => p.map((x) => (x.productId === it.productId ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))} className="rounded border border-ink/20 px-1.5">−</button><span className="tabular-nums">{it.qty}</span><button type="button" onClick={() => setItems((p) => p.map((x) => (x.productId === it.productId ? { ...x, qty: x.qty + 1 } : x)))} className="rounded border border-ink/20 px-1.5">+</button><span className="w-16 text-right tabular-nums">{usd(it.unitPriceCents * it.qty)}</span><button type="button" onClick={() => setItems((p) => p.filter((x) => x.productId !== it.productId))} className="text-xs text-red-700">✕</button></span></li>)}
        {items.length === 0 ? <li className="text-sm text-muted">Scan items to build the order.</li> : null}
      </ul>
      <div className="mt-3 flex items-center justify-between">
        <label className="text-xs"><span className="mb-1 block text-muted">Payment label (no card numbers)</span><input value={payment} onChange={(e) => setPayment(e.target.value)} className={field} aria-label="Payment label" /></label>
        <p className="ml-3 self-end text-lg font-display">Total {usd(total)}</p>
      </div>
      <button type="button" onClick={submit} className="mt-3 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90">Record order</button>
    </div>
  );
}

function Reports({ store }: { store: Store }) {
  const csv = (rid: string) => { const r = STORE_REPORTS.find((x) => x.id === rid)!.build(store); dl(toCsv(r.headers, r.rows), `${rid}.csv`); };
  const xlsx = async (rid: string) => {
    const r = STORE_REPORTS.find((x) => x.id === rid)!.build(store);
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const [path, content] of Object.entries(xlsxParts([{ name: r.title, headers: r.headers, rows: r.rows }]))) zip.file(path, content);
    dlBlob(await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${rid}.xlsx`);
  };
  const print = (rid: string) => {
    const r = STORE_REPORTS.find((x) => x.id === rid)!.build(store);
    const w = window.open("", "_blank");
    if (w) { w.document.write(reportHtml(r, store.settings.storeName)); w.document.close(); }
  };
  const small = "rounded-full border border-ink/20 px-2.5 py-1 text-xs hover:bg-cream";
  return (
    <div className="mt-4">
      <p className="text-xs text-muted">Reports open in Excel/Numbers/Sheets (CSV/XLSX) or print to PDF. Exports may contain customer data — keep them safe. No payment card data is ever included.</p>
      <ul className="mt-3 space-y-1">
        {STORE_REPORTS.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-lg border border-ink/10 px-3 py-2 text-sm">
            <span>{r.name}</span>
            <span className="flex gap-1.5">
              <button type="button" onClick={() => csv(r.id)} className={small}>CSV</button>
              <button type="button" onClick={() => void xlsx(r.id)} className={small}>XLSX</button>
              <button type="button" onClick={() => print(r.id)} className={small}>Print / PDF</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Settings({ store, setStore, setMsg }: { store: Store; setStore: (s: Store) => void; setMsg: (s: string) => void }) {
  const importRef = useRef<HTMLInputElement | null>(null);
  const backup = () => { dl(serializeStore(store), `store-backup-${today()}.json`, "application/json"); setStore({ ...store, settings: { ...store.settings, lastBackup: now() } }); setMsg("✅ Backup downloaded."); };
  const restore = async (file: File) => { try { const s = parseStoreBackup(await file.text()); setStore(s); setMsg("✅ Restored from backup."); } catch (e) { setMsg(`⚠️ ${(e as Error).message}`); } };
  const set = (patch: Partial<Store["settings"]>) => setStore({ ...store, settings: { ...store.settings, ...patch } });
  return (
    <div className={`mt-4 ${card} space-y-3 text-sm`}>
      <label className="block text-xs"><span className="mb-1 block text-muted">Store name</span><input value={store.settings.storeName} onChange={(e) => set({ storeName: e.target.value })} className={field} aria-label="Store name" /></label>
      <label className="block text-xs"><span className="mb-1 block text-muted">Keep records for</span>
        <select value={store.settings.retention} onChange={(e) => set({ retention: e.target.value as Store["settings"]["retention"] })} className={field} aria-label="Retention">
          {RETENTIONS.map((r) => <option key={r} value={r}>{r === "forever" ? "Forever" : r.replace("y", " year(s)")}</option>)}
        </select>
      </label>
      <label className="block text-xs"><span className="mb-1 block text-muted">PIN lock (optional, blank = off)</span><input value={store.settings.pinLock} onChange={(e) => set({ pinLock: e.target.value.replace(/\D/g, "").slice(0, 8) })} inputMode="numeric" className={field} aria-label="PIN" /></label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={backup} className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream">Back up to file</button>
        <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = ""; }} />
        <button type="button" onClick={() => importRef.current?.click()} className="rounded-full border border-ink/30 px-4 py-1.5 text-sm">Restore from file</button>
        <button type="button" onClick={() => { if (confirm("Remove orders older than your retention window? This can't be undone — back up first.")) { setStore(applyRetention(store)); setMsg("Old records cleaned up per your retention setting."); } }} className="rounded-full border border-amber-300 px-4 py-1.5 text-sm text-amber-800">Clean up old records</button>
      </div>
      <p className="text-[11px] text-muted">This app stores customer and business information locally on this device unless you export, back up, or sync it. Never store payment card numbers — use an official processor (Square/Clover/Stripe) for payments. Last backup: {store.settings.lastBackup || "never"}.</p>
    </div>
  );
}
