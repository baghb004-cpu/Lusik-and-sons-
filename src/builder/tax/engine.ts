// ============================================================
// Tax Assistant — calculation + confidence engine (pure)
// ============================================================
// Safe arithmetic only. The two jobs that are genuinely
// computable offline without asserting tax law:
//   1. Standard-vs-itemized COMPARISON — once the user supplies
//      the standard-deduction figure for THEIR situation from a
//      verified rule pack, this just compares two sums. If that
//      figure isn't verified, the result is "needs-review", never
//      a number (the safety contract).
//   2. Confidence rollups — the weakest input governs the output,
//      so nothing downstream ever looks more certain than its
//      shakiest source.
// No brackets, no tax-due calculation here — those need verified,
// year-specific tables the user confirms; this stays honest.
// ============================================================

import type { Confidence, RulePack, TaxProject } from "./schemas.ts";

const RANK: Record<Confidence, number> = {
  "confirmed-document": 4,
  "confirmed-manual": 3,
  calculated: 2,
  "needs-review": 1,
  "not-enough-info": 0,
};

/** The weakest confidence wins (a sum is only as solid as its softest term). */
export function rollupConfidence(parts: Confidence[]): Confidence {
  if (parts.length === 0) return "not-enough-info";
  return parts.reduce((worst, c) => (RANK[c] < RANK[worst] ? c : worst), "confirmed-document" as Confidence);
}

export function sumCents(items: Array<{ amountCents: number; confidence: Confidence }>): { cents: number; confidence: Confidence } {
  return { cents: items.reduce((s, i) => s + i.amountCents, 0), confidence: rollupConfidence(items.map((i) => i.confidence)) };
}

export interface DeductionComparison {
  recommendation: "standard" | "itemized" | "needs-review";
  standardCents: number | null;
  itemizedCents: number;
  itemizedConfidence: Confidence;
  /** Spelled out so the UI can show the reasoning. */
  explanation: string;
}

/** Find the standard-deduction figure for the project's filing status in a
 *  rule pack — only if it's present AND verified. */
export function standardDeductionCents(pack: RulePack | null, project: TaxProject): number | null {
  if (!pack || !project.filingStatus) return null;
  const key = `std_deduction_${project.filingStatus.replace(/-/g, "_")}`;
  const fig = pack.figures.find((f) => f.key === key);
  if (!fig || !fig.verified || fig.value === null) return null;
  return Math.round(fig.value * 100);
}

export function compareDeductions(project: TaxProject, pack: RulePack | null): DeductionComparison {
  const itemized = sumCents(project.deductions.filter((d) => d.itemized));
  const std = standardDeductionCents(pack, project);

  if (std === null) {
    return {
      recommendation: "needs-review",
      standardCents: null,
      itemizedCents: itemized.cents,
      itemizedConfidence: itemized.confidence,
      explanation:
        "Enter (and verify against the official IRS instructions for your year and filing status) the standard deduction so I can compare it to your itemized total. Until then I won't guess.",
    };
  }
  const useItemized = itemized.cents > std;
  return {
    recommendation: useItemized ? "itemized" : "standard",
    standardCents: std,
    itemizedCents: itemized.cents,
    itemizedConfidence: itemized.confidence,
    explanation: useItemized
      ? `Your itemized deductions ($${(itemized.cents / 100).toLocaleString()}) are larger than the standard deduction ($${(std / 100).toLocaleString()}), so itemizing likely saves more — keep every receipt that backs it up.`
      : `The standard deduction ($${(std / 100).toLocaleString()}) is larger than your itemized total ($${(itemized.cents / 100).toLocaleString()}), so the standard deduction is simpler and likely better — no itemized receipts needed.`,
  };
}

/** Whole-project confidence summary for the dashboard. */
export function projectConfidence(project: TaxProject): Record<Confidence, number> {
  const tally: Record<Confidence, number> = {
    "confirmed-document": 0, "confirmed-manual": 0, calculated: 0, "needs-review": 0, "not-enough-info": 0,
  };
  for (const i of project.income) tally[i.confidence]++;
  for (const d of project.deductions) tally[d.confidence]++;
  for (const c of project.credits) tally[c.confidence]++;
  for (const doc of project.documents) for (const f of doc.fields) tally[f.confidence]++;
  return tally;
}
