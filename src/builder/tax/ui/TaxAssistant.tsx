"use client";

// ============================================================
// Tax Assistant — Phase 1 UI: the guided organizer (§25)
// ============================================================
// Runs the pure engine in the browser — nothing leaves the device.
// Answer plain-English questions → see exactly which documents to
// gather and which forms you'll likely touch (each citing irs.gov),
// then an optional standard-vs-itemized check that REFUSES to guess
// until you enter the official standard-deduction figure. It never
// invents a tax number. Not tax advice.
// ============================================================

import { useMemo, useRef, useState } from "react";
import { INTERVIEW, neededDocuments, likelyForms } from "../checklist.ts";
import { compareDeductions } from "../engine.ts";
import { taxProject, rulePack } from "../schemas.ts";
import { updateGuidanceFor, scaffoldRulePack, scaffoldStatePack, stateGuidanceFor, freeFileGuidance, printAndMailGuidance } from "../updater.ts";
import { encryptSession, decryptSession } from "./sessionCrypto.ts";
import { runOcr, type OcrResult } from "./ocr.ts";

type FilingStatus = "single" | "married-jointly" | "married-separately" | "head-of-household" | "qualifying-surviving-spouse";
const STATUSES: Array<{ id: FilingStatus; label: string }> = [
  { id: "single", label: "Single" },
  { id: "married-jointly", label: "Married, filing together" },
  { id: "married-separately", label: "Married, filing separately" },
  { id: "head-of-household", label: "Head of household" },
  { id: "qualifying-surviving-spouse", label: "Surviving spouse" },
];
const field = "w-full rounded-xl border border-ink/20 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";

export function TaxAssistant() {
  const year = new Date().getFullYear();
  const [filingStatus, setFilingStatus] = useState<FilingStatus>("single");
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [itemized, setItemized] = useState("");
  const [stdDeduction, setStdDeduction] = useState(""); // user enters from the official page
  const [stdVerified, setStdVerified] = useState(false);

  // encrypted save/load
  const [passphrase, setPassphrase] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const loadInputRef = useRef<HTMLInputElement | null>(null);

  // optional OCR import (always-confirm)
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [ocrMsg, setOcrMsg] = useState("");
  const ocrInputRef = useRef<HTMLInputElement | null>(null);

  const docs = useMemo(() => neededDocuments(answers), [answers]);
  const forms = useMemo(() => likelyForms(answers), [answers]);
  const guidance = updateGuidanceFor(year);

  // Everything that makes up "your session" — the only thing saved/loaded.
  const session = () => ({ v: 1, filingStatus, answers, itemized, stdDeduction, stdVerified });

  async function handleSave() {
    setSaveMsg("");
    try {
      const blob = await encryptSession(session(), passphrase);
      const file = new Blob([blob], { type: "application/octet-stream" });
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tax-${year}-encrypted.btax`;
      a.click();
      URL.revokeObjectURL(url);
      setSaveMsg("✅ Saved an encrypted file to your downloads. There is no recovery without this passphrase — keep it safe.");
    } catch (e) {
      setSaveMsg(`⚠️ ${(e as Error).message}`);
    }
  }

  async function handleLoad(file: File) {
    setSaveMsg("");
    try {
      const text = await file.text();
      const data = await decryptSession<ReturnType<typeof session>>(text, passphrase);
      setFilingStatus(data.filingStatus);
      setAnswers(data.answers ?? {});
      setItemized(data.itemized ?? "");
      setStdDeduction(data.stdDeduction ?? "");
      setStdVerified(!!data.stdVerified);
      setSaveMsg("✅ Loaded your saved session.");
    } catch (e) {
      setSaveMsg(`⚠️ ${(e as Error).message}`);
    }
  }

  async function handleOcr(file: File) {
    setOcr(null);
    setOcrMsg("Reading the photo on this device…");
    try {
      const result = await runOcr(file);
      setOcr(result);
      setOcrMsg(result.amounts.length ? "Read it. Tap an amount to use it as your itemized total — then check it against the document yourself." : "Read it, but I couldn't spot a dollar amount. Type the figure in from the document.");
    } catch (e) {
      setOcrMsg((e as Error).message);
    }
  }

  function downloadJson(obj: unknown, name: string) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  }
  function scaffoldNextYear() { downloadJson(scaffoldRulePack(year + 1), `rule-pack-${year + 1}-template.json`); }
  function scaffoldState() {
    const code = prompt("Your 2-letter state code (e.g. CA, NY, TX):", "");
    if (!code || !code.trim()) return;
    try { downloadJson(scaffoldStatePack(code.trim(), year), `state-${code.trim().toLowerCase()}-${year}-template.json`); }
    catch (e) { alert((e as Error).message); }
  }

  const comparison = useMemo(() => {
    const project = taxProject.parse({
      taxYear: year,
      filingStatus,
      deductions: itemized ? [{ label: "Itemized total", itemized: true, amountCents: Math.round((Number(itemized.replace(/[^\d.]/g, "")) || 0) * 100), confidence: "confirmed-manual" }] : [],
    });
    const pack = stdVerified && stdDeduction
      ? rulePack.parse({
          taxYear: year, jurisdiction: "us-federal", status: "user-verified",
          officialSource: "https://www.irs.gov/forms-instructions",
          figures: [{ key: `std_deduction_${filingStatus.replace(/-/g, "_")}`, value: Number(stdDeduction.replace(/[^\d.]/g, "")) || 0, unit: "usd", verified: true, source: "https://www.irs.gov/forms-pubs/about-form-1040" }],
        })
      : null;
    return compareDeductions(project, pack);
  }, [year, filingStatus, itemized, stdDeduction, stdVerified]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 font-body text-ink">
      <h1 className="font-display text-3xl">🧾 Tax Assistant</h1>
      <p className="mt-1 text-sm text-muted">
        A private organizer for your own taxes — answer simple questions and I'll tell you what to gather and which forms
        you'll likely need, with links to the official IRS pages. Everything stays on this device.
      </p>
      <p className="mt-2 rounded-lg bg-cream/70 px-3 py-2 text-xs">
        Not tax advice, not an e-file service, and never a guarantee — a careful helper. It will never invent a tax number;
        the official amounts come from the IRS pages you confirm.
      </p>

      {/* filing status */}
      <section className="mt-6">
        <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Filing status</h2>
        <select value={filingStatus} onChange={(e) => setFilingStatus(e.target.value as FilingStatus)} className={field} aria-label="Filing status">
          {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </section>

      {/* interview */}
      <section className="mt-6">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">A few yes/no questions</h2>
        <div className="space-y-2">
          {INTERVIEW.map((q) => (
            <div key={q.id} className="rounded-xl border border-ink/10 bg-white/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{q.ask}</p>
                  <p className="text-xs text-muted">{q.why}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {(["yes", "no"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: v === "yes" }))}
                      className={`min-h-9 rounded-full border px-3 text-sm ${answers[q.id] === (v === "yes") ? "border-ink bg-ink text-cream" : "border-ink/20"}`}
                    >
                      {v === "yes" ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* live results */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-ink/10 bg-white/60 p-4">
          <h2 className="font-display text-lg">📂 Gather these</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {docs.map((d) => (
              <li key={d.id}>
                <span className="font-medium">{d.doc}</span>
                <span className="block text-xs text-muted">{d.why} <a href={d.source} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">IRS ↗</a></span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-white/60 p-4">
          <h2 className="font-display text-lg">📄 Forms you'll likely touch</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {forms.map((f) => (
              <li key={f.form}>
                <span className="font-medium">{f.form}</span>
                <span className="block text-xs text-muted">{f.plain} <a href={f.source} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">IRS ↗</a></span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* standard vs itemized — refuses to guess */}
      <section className="mt-6 rounded-2xl border border-ink/10 bg-white/60 p-4">
        <h2 className="font-display text-lg">Standard vs itemized</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted">Your itemized total (mortgage interest, donations, etc.)</span>
            <input inputMode="decimal" value={itemized} onChange={(e) => setItemized(e.target.value)} placeholder="$" className={field} aria-label="Itemized total" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted">This year's standard deduction (from the IRS)</span>
            <input inputMode="decimal" value={stdDeduction} onChange={(e) => { setStdDeduction(e.target.value); setStdVerified(false); }} placeholder="$" className={field} aria-label="Standard deduction" />
          </label>
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs">
          <input type="checkbox" checked={stdVerified} onChange={(e) => setStdVerified(e.target.checked)} className="h-3.5 w-3.5 accent-ink" />
          I confirmed this standard-deduction number on the official IRS page for {STATUSES.find((s) => s.id === filingStatus)?.label}.
        </label>
        <p className={`mt-2 rounded-lg px-3 py-2 text-sm ${comparison.recommendation === "needs-review" ? "bg-cream/70" : "bg-emerald-50 text-emerald-900"}`} data-testid="deduction-result">
          {comparison.recommendation === "needs-review" ? "ℹ️ " : "✅ "}{comparison.explanation}
        </p>
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-muted">Where do I find the standard deduction?</summary>
          <ul className="mt-1 space-y-1">
            {guidance.sources.slice(0, 3).map((s) => (
              <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">{s.label} ↗</a></li>
            ))}
          </ul>
        </details>
      </section>

      {/* optional OCR import — always confirm, never auto-trust */}
      <section className="mt-6 rounded-2xl border border-ink/10 bg-white/60 p-4">
        <h2 className="font-display text-lg">📷 Read a document photo (optional)</h2>
        <p className="mt-1 text-xs text-muted">
          Snap or pick a photo of a W-2 or 1099 and I'll try to read the numbers — entirely on this device, nothing uploaded.
          It only ever <strong>suggests</strong> a figure; you always check it against the paper and confirm it yourself.
        </p>
        <input ref={ocrInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleOcr(f); e.target.value = ""; }} />
        <button type="button" onClick={() => ocrInputRef.current?.click()} className="mt-2 rounded-full border border-ink/30 px-4 py-1.5 text-sm">Choose a photo…</button>
        {ocrMsg ? <p className="mt-2 text-xs text-muted" data-testid="ocr-message">{ocrMsg}</p> : null}
        {ocr && ocr.amounts.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ocr.amounts.map((a) => (
              <button key={a} type="button" onClick={() => setItemized(a)} className="rounded-full border border-ink/20 bg-cream/60 px-2.5 py-1 text-xs tabular-nums">${a}</button>
            ))}
          </div>
        ) : null}
        {ocr?.text ? (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-muted">What it read (verify against your document)</summary>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-cream/60 p-2 text-[11px]">{ocr.text}</pre>
          </details>
        ) : null}
      </section>

      {/* encrypted save / load — stays on the device, no recovery by design */}
      <section className="mt-6 rounded-2xl border border-ink/10 bg-white/60 p-4">
        <h2 className="font-display text-lg">🔒 Save or reopen privately</h2>
        <p className="mt-1 text-xs text-muted">
          Save your answers as one encrypted file (AES-256). It never leaves this device, and there is
          <strong> no way to recover it without your passphrase</strong> — that's the privacy guarantee.
        </p>
        <label className="mt-2 block text-sm">
          <span className="mb-1 block text-xs text-muted">Passphrase (at least 8 characters)</span>
          <input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="A long passphrase you'll remember" className={field} aria-label="Passphrase" />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => void handleSave()} disabled={passphrase.length < 8} className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream disabled:opacity-40">Save encrypted file</button>
          <input ref={loadInputRef} type="file" accept=".btax,application/octet-stream" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleLoad(f); e.target.value = ""; }} />
          <button type="button" onClick={() => loadInputRef.current?.click()} disabled={passphrase.length < 8} className="rounded-full border border-ink/30 px-4 py-1.5 text-sm disabled:opacity-40">Open a saved file…</button>
        </div>
        {saveMsg ? <p className="mt-2 text-xs" data-testid="save-message">{saveMsg}</p> : null}
      </section>

      {/* next-year updater — opens official pages + scaffolds an EMPTY cited pack */}
      <section className="mt-6 rounded-2xl border border-ink/10 bg-white/60 p-4">
        <h2 className="font-display text-lg">🗓️ Start next year (tax year {year + 1})</h2>
        <p className="mt-1 text-xs text-muted">
          When a new tax year arrives, the figures change. This never guesses them — it opens the official IRS pages and
          builds an <strong>empty, source-cited</strong> template you fill in from those pages.
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted">
          {guidance.steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={scaffoldNextYear} className="rounded-full border border-ink/30 px-4 py-1.5 text-sm">Scaffold a {year + 1} rule pack</button>
          <a href={guidance.sources[0].url} target="_blank" rel="noreferrer" className="rounded-full border border-ink/20 px-4 py-1.5 text-sm">Open official IRS pages ↗</a>
        </div>
      </section>

      {/* state pack + filing helpers — all official links, never e-files */}
      <section className="mt-6 rounded-2xl border border-ink/10 bg-white/60 p-4">
        <h2 className="font-display text-lg">🏛️ State taxes & filing</h2>
        <p className="mt-1 text-xs text-muted">
          State rules vary a lot (some states have no income tax). Like the federal pack, this builds an
          <strong> empty, source-cited</strong> state template you fill from your state's official site — never guessed.
          And when you're ready to file, these point you to the official IRS options — this app never e-files for you.
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted">
          {stateGuidanceFor("your-state", year).steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={scaffoldState} className="rounded-full border border-ink/30 px-4 py-1.5 text-sm">Scaffold a state rule pack</button>
          <a href={stateGuidanceFor("x", year).sources[0].url} target="_blank" rel="noreferrer" className="rounded-full border border-ink/20 px-4 py-1.5 text-sm">Find your state's tax site ↗</a>
          <a href={freeFileGuidance(year).sources[1].url} target="_blank" rel="noreferrer" className="rounded-full border border-ink/20 px-4 py-1.5 text-sm">IRS Free File Fillable Forms ↗</a>
          <a href={printAndMailGuidance(year).sources[0].url} target="_blank" rel="noreferrer" className="rounded-full border border-ink/20 px-4 py-1.5 text-sm">Print &amp; mail (Form 1040) ↗</a>
        </div>
      </section>

      <p className="mt-6 text-[11px] text-muted">
        Complex situations (a business, rental property, multi-state, K-1s, foreign income) are beyond this organizer —
        see a professional or the IRS. This tool supports legal, good-faith filing only.
      </p>
    </main>
  );
}
