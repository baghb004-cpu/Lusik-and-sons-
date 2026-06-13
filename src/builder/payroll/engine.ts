// ============================================================
// Payroll / SE tax calculator — the math (pure, §27)
// ============================================================
// Deterministic from the rate pack. The SE-tax formula is the
// long-standing IRS Schedule SE method (net earnings × 92.35%,
// 12.4% Social Security up to the wage base + 2.9% Medicare with
// no cap + 0.9% additional over the threshold; half deductible).
// Medicare is always exact (no cap). Social Security needs the
// year's wage base to cap correctly; without a VERIFIED wage
// base the engine computes it UNCAPPED and says so — accurate
// for anyone under the cap, clearly flagged for anyone above.
// ============================================================

import type { PayrollInput, PayrollResult, PayrollLine, RatePack } from "./schemas.ts";

const INTERVALS_PER_YEAR: Record<string, number> = {
  "per-payment": 1, weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12, quarterly: 4, annually: 1,
};
const c = (dollars: number) => Math.round(dollars * 100);

export function computePayroll(input: PayrollInput, pack: RatePack): PayrollResult {
  const perYear = INTERVALS_PER_YEAR[input.interval] ?? 1;
  // "per-payment" and "annually" both mean the amount is the whole figure for
  // the calc; the rest annualize so the Social Security cap is applied right.
  const annual = input.interval === "per-payment" || input.interval === "annually" ? input.amount : input.amount * perYear;
  const warnings: string[] = [];
  let approximate = false;
  const lines: PayrollLine[] = [];

  const threshold = pack.additionalMedicareThreshold[input.filingStatus] ?? 200000;
  const wageBaseKnown = pack.socialSecurityWageBase !== null && pack.socialSecurityWageBaseVerified;
  const wageBase = pack.socialSecurityWageBase ?? Infinity; // uncapped when unknown

  // ── self-employed (1099): you pay BOTH halves ─────────────
  if (input.scenario === "self-employed-1099") {
    const netEarnings = annual * pack.netEarningsFactor;
    const ssBaseRemaining = Math.max(0, wageBase - input.priorEarningsThisYear);
    const ssTaxable = Math.min(netEarnings, ssBaseRemaining);
    const ss = ssTaxable * pack.socialSecurityRateSelf;
    const medicare = netEarnings * pack.medicareRateSelf;
    const addlMed = Math.max(0, netEarnings - threshold) * pack.additionalMedicareRate;
    const seTax = ss + medicare + addlMed;
    const deductibleHalf = seTax / 2;

    if (!wageBaseKnown) {
      approximate = true;
      warnings.push(
        "I assumed you're under the Social Security wage cap. If your net earnings are very high, enter this year's Social Security wage base (one click in Update) so the Social Security part stops at the cap."
      );
    }

    lines.push({ label: "Net earnings (92.35% of profit)", cents: c(netEarnings), plain: `Self-employment tax is figured on 92.35% of your profit, so on $${Math.round(netEarnings).toLocaleString()} — not the whole amount.` });
    lines.push({ label: "Social Security (12.4%)", cents: c(ss), plain: `The Social Security piece${wageBaseKnown ? " (stops at the yearly cap)" : ""}.` });
    lines.push({ label: "Medicare (2.9%)", cents: c(medicare), plain: "The Medicare piece — no cap, every dollar counts." });
    if (addlMed > 0) lines.push({ label: "Extra Medicare (0.9%)", cents: c(addlMed), plain: `A little extra Medicare on earnings over $${threshold.toLocaleString()}.` });
    lines.push({ label: "Self-employment tax total", cents: c(seTax), plain: "This is the self-employment tax you owe — both the worker and employer halves, because you're both." });

    // Income-tax set-aside: exact SE tax + (your effective income-tax rate ×
    // profit after the half-SE deduction). No rate given → a simple cushion.
    let incomeTax = 0;
    if (input.incomeTaxRate !== undefined) {
      incomeTax = Math.max(0, annual - deductibleHalf) * input.incomeTaxRate;
      lines.push({ label: `Income tax estimate (${Math.round(input.incomeTaxRate * 100)}%)`, cents: c(incomeTax), plain: "A rough income-tax estimate using the rate you entered. Confirm your real rate with the tax module or the IRS." });
    } else {
      warnings.push("For income tax, I used a simple safety cushion. For a closer number, enter your expected income-tax rate, or use the Tax Assistant.");
    }

    // set-aside: if they gave a rate, SE tax + income tax; else 30% cushion of profit
    const cushion = annual * 0.30;
    const setAside = input.incomeTaxRate !== undefined ? seTax + incomeTax : Math.max(seTax, cushion);
    return finalize(input, annual, lines, setAside, deductibleHalf, warnings, approximate, input.incomeTaxRate === undefined
      ? "Quick rule: set aside about 30% of every self-employment payment. That covers self-employment tax plus a typical income-tax bite. Adjust once you know your real rate."
      : "");
  }

  // ── W-2 employee: what's withheld from YOUR paycheck ──────
  if (input.scenario === "w2-employee") {
    const ssBaseRemaining = Math.max(0, wageBase - input.priorEarningsThisYear);
    const ss = Math.min(annual, ssBaseRemaining) * pack.socialSecurityRateEmployee;
    const medicare = annual * pack.medicareRateEmployee;
    const addlMed = Math.max(0, annual - threshold) * pack.additionalMedicareRate;
    if (!wageBaseKnown) { approximate = true; warnings.push("Assumed you're under the Social Security wage cap — enter this year's wage base for high earners."); }
    lines.push({ label: "Social Security (6.2%)", cents: c(ss), plain: "Your half of Social Security (your employer pays a matching 6.2%)." });
    lines.push({ label: "Medicare (1.45%)", cents: c(medicare), plain: "Your half of Medicare." });
    if (addlMed > 0) lines.push({ label: "Extra Medicare (0.9%)", cents: c(addlMed), plain: `Extra Medicare on wages over $${threshold.toLocaleString()}.` });
    const fica = ss + medicare + addlMed;
    return finalize(input, annual, lines, fica, 0, warnings, approximate, "This is the FICA (Social Security + Medicare) taken from your pay. Your income-tax withholding is separate — set on your W-4.");
  }

  // ── employer cost: what an employer pays ON TOP ───────────
  const ssBaseRemaining = Math.max(0, wageBase - input.priorEarningsThisYear);
  const ss = Math.min(annual, ssBaseRemaining) * pack.socialSecurityRateEmployee;
  const medicare = annual * pack.medicareRateEmployee;
  if (!wageBaseKnown) { approximate = true; warnings.push("Assumed under the Social Security wage cap."); }
  lines.push({ label: "Employer Social Security (6.2%)", cents: c(ss), plain: "The employer's matching Social Security." });
  lines.push({ label: "Employer Medicare (1.45%)", cents: c(medicare), plain: "The employer's matching Medicare (no extra-Medicare match)." });
  const employer = ss + medicare;
  return finalize(input, annual, lines, employer, 0, warnings, approximate, "This is what an employer pays on top of wages. (There may also be federal/state unemployment tax — not included here.)");
}

function finalize(input: PayrollInput, annual: number, lines: PayrollLine[], setAsideDollars: number, deductibleHalf: number, warnings: string[], approximate: boolean, headlinePlain: string): PayrollResult {
  const setAsideCents = Math.round(setAsideDollars * 100);
  const perYear = INTERVALS_PER_YEAR[input.interval] ?? 1;
  const annualizedAmountCents = Math.round(annual * 100);
  if (headlinePlain) lines.push({ label: "What to do", cents: setAsideCents, plain: headlinePlain });
  return {
    scenario: input.scenario,
    annualizedAmountCents,
    lines,
    setAsideCents,
    setAsidePercent: annual > 0 ? Math.round((setAsideDollars / annual) * 1000) / 10 : 0,
    // per "payment" = the input interval's slice of the annual set-aside
    perPaymentCents: Math.round((setAsideCents / (input.interval === "per-payment" ? 1 : perYear))),
    quarterlyCents: Math.round(setAsideCents / 4),
    deductibleHalfCents: Math.round(deductibleHalf * 100),
    warnings,
    approximate,
  };
}

/** The four federal estimated-tax due dates (stable each year). */
export const ESTIMATED_TAX_DUE_DATES = ["April 15", "June 15", "September 15", "January 15 (next year)"];
