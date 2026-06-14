// ============================================================
// Payroll / self-employment tax calculator — data model (§27)
// ============================================================
// "How much do I set aside?" for a 1099 contractor (Baghdo's
// case: working for Pocock Design Solutions) AND other common
// situations. Same honesty rule as the tax module:
//   - STABLE statutory percentages (Social Security 12.4%,
//     Medicare 2.9%, the 0.9% additional, the 92.35% net-earnings
//     factor, the half-deductible) are the METHOD — encoded with
//     citations because they've been law for many years.
//   - YEAR-SPECIFIC figures (the Social Security wage base, the
//     additional-Medicare thresholds) live in a versioned rate
//     pack with a source URL + verified flag, updatable in one
//     click. The engine is honest when a figure isn't entered.
// ============================================================

import { z } from "zod";

export const PAYROLL_SCENARIOS = [
  "self-employed-1099", // you pay BOTH halves (SE tax) — Baghdo's case
  "w2-employee", // what's withheld from your paycheck
  "employer-cost", // employer's side of FICA, if you hire someone
] as const;
export const payrollScenario = z.enum(PAYROLL_SCENARIOS);
export type PayrollScenario = (typeof PAYROLL_SCENARIOS)[number];

export const payrollFilingStatus = z.enum(["single", "married-jointly", "married-separately", "head-of-household"]);
export type PayrollFilingStatus = z.infer<typeof payrollFilingStatus>;

export const payInterval = z.enum(["per-payment", "weekly", "biweekly", "semimonthly", "monthly", "quarterly", "annually"]);
export type PayInterval = z.infer<typeof payInterval>;

// ── the rate pack (the dataset, updatable per year) ─────────
const pct = z.number().min(0).max(1);
export const ratePack = z
  .object({
    schemaVersion: z.number().int().min(1).default(1),
    taxYear: z.number().int().min(2000).max(2100),
    status: z.enum(["defaults", "user-verified"]).default("defaults"),
    officialSource: z.string().url(),
    // STABLE statutory method (defaults are the long-standing law; the
    // source is cited so the user can confirm they haven't changed).
    socialSecurityRateSelf: pct.default(0.124), // 12.4% (both halves)
    socialSecurityRateEmployee: pct.default(0.062), // 6.2%
    medicareRateSelf: pct.default(0.029), // 2.9%
    medicareRateEmployee: pct.default(0.0145), // 1.45%
    additionalMedicareRate: pct.default(0.009), // 0.9% over threshold
    netEarningsFactor: pct.default(0.9235), // SE tax applies to 92.35% of profit
    // YEAR-SPECIFIC — must be verified against the official source.
    socialSecurityWageBase: z.number().nullable().default(null), // $ cap; null = not entered
    socialSecurityWageBaseVerified: z.boolean().default(false),
    // Additional-Medicare thresholds by status (fixed since 2013, still cited).
    additionalMedicareThreshold: z
      .object({
        single: z.number().default(200000),
        "married-jointly": z.number().default(250000),
        "married-separately": z.number().default(125000),
        "head-of-household": z.number().default(200000),
      })
      .default({ single: 200000, "married-jointly": 250000, "married-separately": 125000, "head-of-household": 200000 }),
    updatedAt: z.number().int().optional(),
  })
  .strict();
export type RatePack = z.infer<typeof ratePack>;

// ── input + result ──────────────────────────────────────────
export const payrollInput = z
  .object({
    scenario: payrollScenario,
    /** Net self-employment PROFIT (1099) or gross WAGES (w2/employer), in dollars. */
    amount: z.number().min(0).max(100_000_000),
    /** The period `amount` covers — annualized internally for the cap math. */
    interval: payInterval.default("annually"),
    filingStatus: payrollFilingStatus.default("single"),
    /** Optional: your expected effective FEDERAL income-tax rate (0–0.5) for
     *  the set-aside estimate. Leave undefined to use the simple cushion %. */
    incomeTaxRate: z.number().min(0).max(0.5).optional(),
    /** Already-earned this year (for the SS cap) — defaults to 0. */
    priorEarningsThisYear: z.number().min(0).default(0),
  })
  .strict();
export type PayrollInput = z.infer<typeof payrollInput>;

export interface PayrollLine {
  label: string;
  cents: number;
  /** Five-year-old-simple explanation. */
  plain: string;
}

export interface PayrollResult {
  scenario: PayrollScenario;
  annualizedAmountCents: number;
  lines: PayrollLine[];
  /** The headline number: put this aside. */
  setAsideCents: number;
  setAsidePercent: number; // of the input amount
  /** Per-payment + quarterly breakdowns. */
  perPaymentCents: number;
  quarterlyCents: number;
  /** Half of SE tax is deductible (1099 only). */
  deductibleHalfCents: number;
  /** Anything the user must confirm/enter for an exact number. */
  warnings: string[];
  /** True when a year-specific figure (wage base) was assumed, not verified. */
  approximate: boolean;
}
