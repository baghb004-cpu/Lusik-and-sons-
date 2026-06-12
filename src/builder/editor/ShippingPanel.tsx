"use client";

// ============================================================
// Shipping & data panel (Phase 13)
// ============================================================
// Edits builder/data/shipping.json: origin ZIP, local-delivery
// and blocked lists, zones (prefix groups + rates), free
// threshold, default rate, lead-time note. The headline feature
// is the LIVE TESTER: type any ZIP + order total and see exactly
// which rule fires and what the site will say — including the
// fail-soft unknown-ZIP path. Datasets import here too (bundled
// BSD data trimmed by state, or your own licensed CSV), each
// carrying its required source/license manifest.
//
// Display-only for the live Lusik shop: charged amounts stay
// server-computed (the warning below says so in the UI).
// ============================================================

import { useMemo, useState } from "react";
import {
  shippingConfigSchema,
  zipDatasetSchema,
  evaluateShipping,
  parseZipCsv,
  normalizeZip,
  type ShippingConfig,
  type ZipDataset,
} from "../data/index.ts";

type Obj = Record<string, unknown>;

const inputClass =
  "w-full rounded-lg border border-ink/15 bg-white/80 px-2 py-1.5 text-xs focus:border-accent focus:outline-none";

export function ShippingPanel({
  value,
  datasets,
  api,
  onChange,
  onImportDataset,
}: {
  value: Obj;
  datasets: ZipDataset[];
  api: (input: string, init?: RequestInit) => Promise<Response>;
  onChange: (next: Obj) => void;
  onImportDataset: (path: string, content: unknown) => Promise<boolean>;
}) {
  const parsed = useMemo(() => shippingConfigSchema.safeParse(value), [value]);
  const [testZip, setTestZip] = useState("90620");
  const [testTotal, setTestTotal] = useState("65");

  if (!parsed.success) {
    return (
      <p className="rounded-lg bg-accent/10 p-3 text-sm">
        shipping.json doesn’t match the schema — switch to JSON to repair it.
        <span className="mt-1 block font-mono text-xs text-muted">{parsed.error.issues[0]?.message}</span>
      </p>
    );
  }
  const config = parsed.data;
  const dataset = datasets[0] ?? null;
  const set = (patch: Partial<ShippingConfig>) => onChange({ ...value, ...patch });

  const quote = evaluateShipping(config, dataset, testZip, Math.round(Number(testTotal || 0) * 100));

  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs">
        ⚠ Display & estimates only on the live shop — the amount a customer is <em>charged</em> stays server-computed (netlify/functions/_lib). Exported sites use this engine directly.
      </p>

      {/* live tester */}
      <div className="rounded-xl border border-ink/10 bg-white/60 p-3">
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Test a ZIP</h4>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <input type="text" value={testZip} onChange={(e) => setTestZip(e.target.value)} placeholder="ZIP" className={`${inputClass} font-mono`} aria-label="Test ZIP" />
          <input type="number" value={testTotal} onChange={(e) => setTestTotal(e.target.value)} placeholder="Order $" className={inputClass} aria-label="Test order total" />
        </div>
        <div className="text-xs">
          {quote.place ? (
            <p>📍 {quote.place.city}, {quote.place.state}{quote.place.alternates.length ? ` (also: ${quote.place.alternates.join(", ")})` : ""}</p>
          ) : dataset ? (
            <p className="text-accent">📍 not in the dataset — shown unconfirmed</p>
          ) : (
            <p className="text-muted">📍 no dataset imported — place autofill off</p>
          )}
          <p className="mt-1 font-medium">
            {quote.kind === "invalid" && "✕ not a valid ZIP"}
            {quote.kind === "blocked" && "🚫 blocked — no shipping offered"}
            {quote.kind === "local-delivery" && `🚚 ${config.localDelivery?.label}: ${dollars(quote.rateCents)}`}
            {quote.kind === "free" && "✓ free shipping (over threshold)"}
            {quote.kind === "zone" && `📦 zone “${quote.zoneId}”: ${dollars(quote.rateCents)}`}
            {quote.kind === "flat" && `📦 flat rate: ${dollars(quote.rateCents)}`}
            {quote.kind === "contact" && "✉ “write to us for a quote”"}
          </p>
          {quote.warnings.map((w, i) => (
            <p key={i} className="mt-1 text-accent">⚠ {w}</p>
          ))}
          {quote.leadTimeNote ? <p className="mt-1 text-muted">⏳ {quote.leadTimeNote}</p> : null}
        </div>
      </div>

      {/* config */}
      <div className="space-y-2 rounded-xl border border-ink/10 p-3 text-xs">
        <label className="block">
          <span className="mb-1 block font-medium">Origin ZIP (where orders ship from)</span>
          <input type="text" value={config.originZip} onChange={(e) => { const z = normalizeZip(e.target.value); if (z) set({ originZip: z }); }} className={`${inputClass} font-mono`} />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Free shipping over ($, blank = off)</span>
          <input
            type="number"
            value={config.freeShippingOverCents === null ? "" : config.freeShippingOverCents / 100}
            onChange={(e) => set({ freeShippingOverCents: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) })}
            className={inputClass}
          />
        </label>
        <ZipList label="Local delivery ZIPs" zips={config.localDelivery?.zips ?? []} onChange={(zips) =>
          set({ localDelivery: zips.length === 0 ? null : { zips, rateCents: config.localDelivery?.rateCents ?? 0, label: config.localDelivery?.label ?? "Local delivery" } })
        } />
        {config.localDelivery ? (
          <label className="block">
            <span className="mb-1 block font-medium">Local delivery rate ($)</span>
            <input type="number" value={config.localDelivery.rateCents / 100} onChange={(e) => set({ localDelivery: { ...config.localDelivery!, rateCents: Math.round(Number(e.target.value || 0) * 100) } })} className={inputClass} />
          </label>
        ) : null}
        <ZipList label="Blocked ZIPs" zips={config.blockedZips} onChange={(blockedZips) => set({ blockedZips })} />
        <div>
          <span className="mb-1 block font-medium">Zones (prefix groups; longest prefix wins)</span>
          {config.zones.map((zone, i) => (
            <div key={zone.id} className="mb-1 grid grid-cols-[1fr_1fr_70px_24px] items-center gap-1">
              <input type="text" value={zone.label} onChange={(e) => set({ zones: config.zones.map((z, n) => (n === i ? { ...z, label: e.target.value } : z)) })} className={inputClass} aria-label="Zone label" />
              <input type="text" value={zone.prefixes.join(",")} onChange={(e) => set({ zones: config.zones.map((z, n) => (n === i ? { ...z, prefixes: e.target.value.split(",").map((p) => p.trim()).filter((p) => /^\d{1,5}$/.test(p)) } : z)) })} className={`${inputClass} font-mono`} aria-label="Zone prefixes" />
              <input type="number" value={zone.rateCents / 100} onChange={(e) => set({ zones: config.zones.map((z, n) => (n === i ? { ...z, rateCents: Math.round(Number(e.target.value || 0) * 100) } : z)) })} className={inputClass} aria-label="Zone rate dollars" />
              <button type="button" onClick={() => set({ zones: config.zones.filter((_, n) => n !== i) })} aria-label="Remove zone" className="text-red-700">✕</button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set({ zones: [...config.zones, { id: `zone-${config.zones.length + 1}`, label: `Zone ${config.zones.length + 1}`, prefixes: ["9"], rateCents: 800 }] })}
            className="rounded-full border border-ink/20 px-2.5 py-0.5 text-[11px] hover:bg-cream"
          >
            + Add zone
          </button>
        </div>
        <label className="block">
          <span className="mb-1 block font-medium">Default rate ($, blank = “contact us”)</span>
          <input type="number" value={config.defaultRateCents === null ? "" : config.defaultRateCents / 100} onChange={(e) => set({ defaultRateCents: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) })} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Lead-time note (handmade production)</span>
          <input type="text" value={config.leadTimeNote} onChange={(e) => set({ leadTimeNote: e.target.value })} className={inputClass} />
        </label>
      </div>

      {/* dataset manager */}
      <div className="space-y-2 rounded-xl border border-ink/10 p-3 text-xs">
        <h4 className="font-medium uppercase tracking-wide text-muted">ZIP datasets</h4>
        {datasets.length === 0 ? <p className="text-muted">None imported — lookup/autofill is off, rules still work.</p> : null}
        {datasets.map((d) => (
          <div key={d.manifest.id} className="rounded-lg bg-white/60 p-2">
            <p className="font-medium">{d.manifest.name} · {d.manifest.rows} ZIPs</p>
            <p className="text-muted">{d.manifest.source}</p>
            <p className="text-muted">License: {d.manifest.licenseNotes}</p>
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${d.manifest.id}.json`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
              className="mt-1 rounded-full border border-ink/20 px-2.5 py-0.5 text-[11px] hover:bg-cream"
            >
              Download (trimmed export) ↓
            </button>
          </div>
        ))}
        <BundledImport api={api} onImportDataset={onImportDataset} />
        <CsvImport onImportDataset={onImportDataset} />
      </div>
    </div>
  );
}

function dollars(cents: number | null): string {
  return cents === null ? "—" : cents === 0 ? "free" : `$${(cents / 100).toFixed(2)}`;
}

function ZipList({ label, zips, onChange }: { label: string; zips: string[]; onChange: (zips: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <span className="mb-1 block font-medium">{label}</span>
      <div className="flex flex-wrap items-center gap-1">
        {zips.map((z) => (
          <span key={z} className="rounded-full bg-cream px-2 py-0.5 font-mono">
            {z}
            <button type="button" onClick={() => onChange(zips.filter((x) => x !== z))} aria-label={`Remove ${z}`} className="ml-1 text-red-700">×</button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const z = normalizeZip(draft);
              if (z && !zips.includes(z)) onChange([...zips, z]);
              setDraft("");
            }
          }}
          placeholder="add ZIP ⏎"
          className="w-24 rounded-lg border border-ink/15 bg-white/80 px-2 py-1 font-mono text-xs"
          aria-label={`Add ${label}`}
        />
      </div>
    </div>
  );
}

function BundledImport({
  api,
  onImportDataset,
}: {
  api: (input: string, init?: RequestInit) => Promise<Response>;
  onImportDataset: (path: string, content: unknown) => Promise<boolean>;
}) {
  const [states, setStates] = useState("CA");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-1">
      <input type="text" value={states} onChange={(e) => setStates(e.target.value)} className={`${inputClass} w-24 flex-none font-mono`} aria-label="States to import (comma-separated)" />
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await api(`/api/builder/zip-bundled?states=${encodeURIComponent(states)}`);
            const body = await res.json();
            if (res.ok) await onImportDataset(body.path, body.content);
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-full border border-ink/20 px-2.5 py-1 text-[11px] hover:bg-cream disabled:opacity-40"
      >
        {busy ? "Importing…" : "Import bundled US data (BSD) for these states"}
      </button>
    </div>
  );
}

function CsvImport({ onImportDataset }: { onImportDataset: (path: string, content: unknown) => Promise<boolean> }) {
  const [report, setReport] = useState("");
  return (
    <div>
      <label className="cursor-pointer rounded-full border border-ink/20 px-2.5 py-1 text-[11px] hover:bg-cream">
        Import your own CSV (zip,city,state)…
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const source = window.prompt("Where is this data from? (required — recorded on the dataset)");
            if (!source) return setReport("Import cancelled — source is required.");
            const license = window.prompt("License / legal basis for using it? (required — e.g. “licensed from X”, “our own data”)");
            if (!license) return setReport("Import cancelled — license notes are required.");
            const parsed = parseZipCsv(await f.text());
            if (parsed.entries.length === 0) return setReport("No valid rows found.");
            const now = new Date().toISOString();
            const id = f.name.replace(/\.csv$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "imported";
            const doc = {
              schemaVersion: 1,
              manifest: {
                id, name: f.name, kind: "zip-places", source, licenseNotes: license,
                version: now.slice(0, 10), importedAt: now, updatedAt: now,
                coverage: `${parsed.entries.length} ZIPs (user import)`,
                limitations: parsed.skipped.length ? `${parsed.skipped.length} row(s) skipped on import` : "",
                rows: parsed.entries.length,
              },
              entries: parsed.entries,
            };
            const check = zipDatasetSchema.safeParse(doc);
            if (!check.success) return setReport(`Import failed: ${check.error.issues[0]?.message}`);
            const ok = await onImportDataset(`builder/data/datasets/${id}.json`, doc);
            setReport(ok ? `Imported ${parsed.entries.length} ZIPs (${parsed.skipped.length} skipped)` : "Save failed");
          }}
        />
      </label>
      {report ? <p className="mt-1 text-muted">{report}</p> : null}
    </div>
  );
}
