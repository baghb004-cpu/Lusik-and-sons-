"use client";

// ============================================================
// Payroll / self-employment "set-aside" calculator (UI, §27)
// ============================================================
// Runs the pure engine 100% in the browser — no network, nothing
// saved anywhere. Built for "assume I'm five years old": pick your
// situation, type what you earned, get one big number to put aside,
// with a plain-English breakdown and the official update link.
// ============================================================

import { useMemo, useState } from "react";
import { computePayroll, ESTIMATED_TAX_DUE_DATES } from "../engine.ts";
import { ratePack, payrollInput, type PayrollScenario, type PayInterval, type PayrollFilingStatus } from "../schemas.ts";
import { payrollUpdateGuidance } from "../updater.ts";

const usd = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SCENARIOS: Array<{ id: PayrollScenario; label: string; blurb: string }> = [
  { id: "self-employed-1099", label: "I'm a 1099 contractor / self-employed", blurb: "You get paid without taxes taken out — so you set aside your own. (This is you.)" },
  { id: "w2-employee", label: "I'm a W-2 employee", blurb: "See the Social Security + Medicare taken from a paycheck." },
  { id: "employer-cost", label: "I'm paying someone", blurb: "See the employer's matching cost on top of wages." },
];
const INTERVALS: PayInterval[] = ["per-payment", "weekly", "biweekly", "semimonthly", "monthly", "quarterly", "annually"];
const STATUSES: Array<{ id: PayrollFilingStatus; label: string }> = [
  { id: "single", label: "Single" },
  { id: "married-jointly", label: "Married, filing together" },
  { id: "married-separately", label: "Married, filing separately" },
  { id: "head-of-household", label: "Head of household" },
];

const field = "w-full rounded-xl border border-ink/20 bg-white px-3 py-2.5 text-base focus:border-accent focus:outline-none";

export function PayrollCalculator() {
  const [scenario, setScenario] = useState<PayrollScenario>("self-employed-1099");
  const [amount, setAmount] = useState("5000");
  const [interval, setInterval] = useState<PayInterval>("per-payment");
  const [filingStatus, setFilingStatus] = useState<PayrollFilingStatus>("single");
  const [useRate, setUseRate] = useState(false);
  const [incomeRate, setIncomeRate] = useState("12");
  const [wageBase, setWageBase] = useState(""); // optional, for high earners

  const result = useMemo(() => {
    const amt = Number(amount.replace(/[^\d.]/g, "")) || 0;
    const pack = ratePack.parse({
      taxYear: new Date().getFullYear(),
      officialSource: "https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-taxes",
      ...(wageBase ? { socialSecurityWageBase: Number(wageBase.replace(/[^\d.]/g, "")) || null, socialSecurityWageBaseVerified: true } : {}),
    });
    const input = payrollInput.parse({
      scenario,
      amount: amt,
      interval,
      filingStatus,
      ...(useRate ? { incomeTaxRate: Math.min(0.5, Math.max(0, Number(incomeRate) / 100)) } : {}),
    });
    return computePayroll(input, pack);
  }, [scenario, amount, interval, filingStatus, useRate, incomeRate, wageBase]);

  const guidance = payrollUpdateGuidance(new Date().getFullYear());
  const isSelf = scenario === "self-employed-1099";

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 font-body text-ink">
      <h1 className="font-display text-3xl">💰 Set-Aside Calculator</h1>
      <p className="mt-1 text-sm text-muted">
        Type what you earn and I'll tell you how much to put aside for taxes — in plain words. Everything stays on this
        device; nothing is sent anywhere.
      </p>

      {/* 1. your situation */}
      <section className="mt-6 space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">1 · What's your situation?</h2>
        <div className="grid gap-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScenario(s.id)}
              className={`rounded-xl border p-3 text-left transition ${scenario === s.id ? "border-ink bg-cream" : "border-ink/15 hover:bg-cream/60"}`}
            >
              <span className="block font-medium">{s.label}</span>
              <span className="block text-xs text-muted">{s.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 2. how much */}
      <section className="mt-6 grid grid-cols-2 gap-3">
        <label className="col-span-2 block text-sm sm:col-span-1">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            2 · {isSelf ? "Your profit (after expenses)" : "Wages"}
          </span>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" className={field} aria-label="Amount" />
        </label>
        <label className="col-span-2 block text-sm sm:col-span-1">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">…for each</span>
          <select value={interval} onChange={(e) => setInterval(e.target.value as PayInterval)} className={field} aria-label="Pay interval">
            {INTERVALS.map((i) => <option key={i} value={i}>{i === "per-payment" ? "payment" : i.replace("ly", "ly")}</option>)}
          </select>
        </label>
        <label className="col-span-2 block text-sm">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Filing status</span>
          <select value={filingStatus} onChange={(e) => setFilingStatus(e.target.value as PayrollFilingStatus)} className={field} aria-label="Filing status">
            {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </section>

      {/* 3. the big answer */}
      <section className="mt-6 rounded-2xl border-2 border-accent/40 bg-accent/5 p-5 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Put aside about</p>
        <p data-testid="setaside" className="font-display text-4xl text-ink">{usd(result.setAsideCents)}</p>
        <p className="mt-1 text-sm text-muted">
          ≈ {result.setAsidePercent}% of {isSelf ? "every payment" : "your pay"} · {usd(result.perPaymentCents)} per {interval === "per-payment" ? "payment" : interval.replace(/ly$/, "")} · {usd(result.quarterlyCents)} per quarter
        </p>
      </section>

      {/* breakdown */}
      <section className="mt-4 space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Where it comes from</h2>
        {result.lines.map((l, i) => (
          <div key={i} className="rounded-xl border border-ink/10 bg-white/60 p-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{l.label}</span>
              {l.cents !== result.setAsideCents || l.label !== "What to do" ? <span className="tabular-nums">{usd(l.cents)}</span> : null}
            </div>
            <p className="mt-0.5 text-xs text-muted">{l.plain}</p>
          </div>
        ))}
        {isSelf && result.deductibleHalfCents > 0 ? (
          <p className="text-xs text-muted">💡 Good news: you can deduct half of the self-employment tax ({usd(result.deductibleHalfCents)}) on your income taxes.</p>
        ) : null}
      </section>

      {/* income-tax refinement (optional) */}
      {isSelf ? (
        <section className="mt-4 rounded-xl border border-ink/10 p-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useRate} onChange={(e) => setUseRate(e.target.checked)} className="h-4 w-4 accent-ink" />
            I know my income-tax rate (for a closer number)
          </label>
          {useRate ? (
            <label className="mt-2 block text-sm">
              <span className="mb-1 block text-xs text-muted">Your expected income-tax rate (%)</span>
              <input inputMode="decimal" value={incomeRate} onChange={(e) => setIncomeRate(e.target.value)} className={field} aria-label="Income tax rate" />
            </label>
          ) : (
            <p className="mt-1 text-xs text-muted">Leave this off and I use a safe 30% cushion. Not sure of your rate? The Tax Assistant can help.</p>
          )}
        </section>
      ) : null}

      {/* warnings */}
      {result.warnings.length > 0 ? (
        <section className="mt-4 space-y-1">
          {result.warnings.map((w, i) => (
            <p key={i} className="rounded-lg bg-cream/70 px-3 py-2 text-xs text-ink">ℹ️ {w}</p>
          ))}
        </section>
      ) : null}

      {/* high-earner wage base + the official update path */}
      <details className="mt-4 rounded-xl border border-ink/10">
        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">Update the rules / high earners</summary>
        <div className="space-y-2 px-3 pb-3 text-sm">
          <p className="text-xs text-muted">
            The percentages are built in and rarely change. The one yearly number is the Social Security wage cap — below it,
            this calculator is already exact. For high earners, enter this year's cap:
          </p>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">This year's Social Security wage base ($)</span>
            <input inputMode="decimal" value={wageBase} onChange={(e) => setWageBase(e.target.value)} placeholder="e.g. 176100" className={field} aria-label="Social Security wage base" />
          </label>
          <p className="text-xs text-muted">Get the official number here (opens the IRS/SSA site):</p>
          <ul className="space-y-1 text-xs">
            {guidance.sources.map((s) => (
              <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">{s.label} ↗</a></li>
            ))}
          </ul>
        </div>
      </details>

      {isSelf ? (
        <p className="mt-4 text-xs text-muted">
          Quarterly estimated-tax due dates: {ESTIMATED_TAX_DUE_DATES.join(" · ")}.
        </p>
      ) : null}
      <p className="mt-6 text-[11px] text-muted">
        This is a helper, not tax advice. It uses the standard FICA/self-employment percentages; confirm anything unusual
        with the IRS or a professional.
      </p>
    </main>
  );
}
