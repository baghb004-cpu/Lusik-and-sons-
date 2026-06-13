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

import { useMemo, useState } from "react";
import { INTERVIEW, neededDocuments, likelyForms } from "../checklist.ts";
import { compareDeductions } from "../engine.ts";
import { taxProject, rulePack } from "../schemas.ts";
import { updateGuidanceFor } from "../updater.ts";

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

  const docs = useMemo(() => neededDocuments(answers), [answers]);
  const forms = useMemo(() => likelyForms(answers), [answers]);
  const guidance = updateGuidanceFor(year);

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

      <p className="mt-6 text-[11px] text-muted">
        Complex situations (a business, rental property, multi-state, K-1s, foreign income) are beyond this organizer —
        see a professional or the IRS. This tool supports legal, good-faith filing only.
      </p>
    </main>
  );
}
