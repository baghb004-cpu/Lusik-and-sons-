// ============================================================
// Payroll calculator — rate updater / new-year pack (pure, §27)
// ============================================================
// "One button to get the new rules." Mirrors the tax updater:
// shows the official pages to open and scaffolds a rate pack for
// a year. The stable statutory percentages carry over (they're
// the long-standing law); the YEAR-SPECIFIC Social Security wage
// base is reset to "enter & verify" so a new year never silently
// reuses last year's cap. We never invent the wage base.
// ============================================================

import { ratePack, type RatePack } from "./schemas.ts";

export const PAYROLL_SOURCES = {
  ssWageBase: "https://www.ssa.gov/oact/cola/cbb.html", // official SS wage base history
  seTax: "https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-taxes",
  scheduleSE: "https://www.irs.gov/forms-pubs/about-schedule-se-form-1040",
  additionalMedicare: "https://www.irs.gov/businesses/small-businesses-self-employed/questions-and-answers-for-the-additional-medicare-tax",
  estimatedTaxes: "https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes",
} as const;

export interface PayrollUpdateGuidance {
  taxYear: number;
  steps: string[];
  sources: Array<{ label: string; url: string }>;
}

export function payrollUpdateGuidance(taxYear: number): PayrollUpdateGuidance {
  return {
    taxYear,
    steps: [
      `Open the official Social Security wage-base page below and find the ${taxYear} amount (it usually changes each year).`,
      `Click "Load ${taxYear} rates" to scaffold this year's rate pack with the standard percentages.`,
      `Type the ${taxYear} Social Security wage base into the one box and mark it verified.`,
      `Double-check the standard percentages (Social Security 12.4% / Medicare 2.9% / extra Medicare 0.9% / 92.35% factor) on the IRS page — they rarely change, but confirm.`,
      `Save. The calculator now uses ${taxYear} rules; older years stay for prior/amended math.`,
    ],
    sources: [
      { label: `Social Security wage base (${taxYear}, official SSA)`, url: PAYROLL_SOURCES.ssWageBase },
      { label: "Self-employment tax (IRS)", url: PAYROLL_SOURCES.seTax },
      { label: "About Schedule SE", url: PAYROLL_SOURCES.scheduleSE },
      { label: "Additional Medicare Tax (IRS)", url: PAYROLL_SOURCES.additionalMedicare },
      { label: "Estimated taxes (IRS)", url: PAYROLL_SOURCES.estimatedTaxes },
    ],
  };
}

/** Build a rate pack for a year. Stable percentages carry from `previous`
 *  (or the schema defaults); the wage base ALWAYS resets to unentered. */
export function scaffoldRatePack(taxYear: number, previous?: RatePack): RatePack {
  const base = previous ?? ratePack.parse({ taxYear, officialSource: PAYROLL_SOURCES.seTax });
  return ratePack.parse({
    ...base,
    taxYear,
    status: "defaults",
    officialSource: PAYROLL_SOURCES.seTax,
    socialSecurityWageBase: null, // never inherit last year's cap
    socialSecurityWageBaseVerified: false,
    updatedAt: Date.now(),
  });
}

/** Is the pack ready for exact high-earner math? (wage base verified) */
export function ratePackReadiness(pack: RatePack): { ready: boolean; message: string } {
  const ready = pack.socialSecurityWageBase !== null && pack.socialSecurityWageBaseVerified;
  return {
    ready,
    message: ready
      ? `Rates for ${pack.taxYear} are set (Social Security cap entered). Calculations are exact at any income.`
      : `Rates for ${pack.taxYear}: enter this year's Social Security wage base for exact math at high incomes. Below the cap, results are already exact.`,
  };
}
