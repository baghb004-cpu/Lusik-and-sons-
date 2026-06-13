// ============================================================
// Tax Assistant — rule-pack updater / new-year scaffolder (pure)
// ============================================================
// The "subsequent years" piece (plan §25): when a new tax year
// arrives, the user clicks ONE button that (a) shows the official
// IRS pages to open and (b) scaffolds a fresh rule pack for that
// year from the template — every figure empty, cited, unverified.
// The user then fills in the real numbers from those official
// pages and flips verified:true. We NEVER fetch or guess figures;
// this only opens official URLs and builds the empty structure.
// ============================================================

import { rulePack, type RulePack } from "./schemas.ts";

/** The official IRS landing pages to open when starting a new year.
 *  These are stable URLs (not year-specific amounts) — the user reads
 *  the current year's numbers there and enters them. */
export const OFFICIAL_SOURCES = {
  formsAndInstructions: "https://www.irs.gov/forms-instructions",
  form1040: "https://www.irs.gov/forms-pubs/about-form-1040",
  standardDeduction: "https://www.irs.gov/credits-deductions/individuals/standard-deduction",
  freeFile: "https://www.irs.gov/filing/free-file-do-your-federal-taxes-for-free",
  freeFileFillable: "https://www.irs.gov/e-file-providers/free-file-fillable-forms",
  whatsNew: "https://www.irs.gov/newsroom",
} as const;

export interface UpdateGuidance {
  taxYear: number;
  steps: string[];
  sources: Array<{ label: string; url: string }>;
}

/** Plain-language "how to update for a new year" guidance + the links. */
export function updateGuidanceFor(taxYear: number): UpdateGuidance {
  return {
    taxYear,
    steps: [
      `Open the official IRS pages below for tax year ${taxYear}. (This is the ONLY time the app touches the internet, and only because you asked.)`,
      `Find the standard deduction for each filing status and this year's other figures in the official 1040 instructions.`,
      `Click "Scaffold a new rule pack" to create an empty, source-cited pack for ${taxYear}.`,
      `Type each figure from the official page into the pack and mark it verified — the app won't compute a final number from any figure until you do.`,
      `Save. The app now treats ${taxYear} as ready; older packs stay untouched for amended/prior-year work.`,
    ],
    sources: [
      { label: `IRS forms & instructions (${taxYear})`, url: OFFICIAL_SOURCES.formsAndInstructions },
      { label: "About Form 1040", url: OFFICIAL_SOURCES.form1040 },
      { label: "Standard deduction (official)", url: OFFICIAL_SOURCES.standardDeduction },
      { label: "What's new at the IRS", url: OFFICIAL_SOURCES.whatsNew },
      { label: "IRS Free File", url: OFFICIAL_SOURCES.freeFile },
      { label: "Free File Fillable Forms", url: OFFICIAL_SOURCES.freeFileFillable },
    ],
  };
}

/** The figure keys every federal pack needs (filing-status standard
 *  deductions to start; more added as the engine grows). */
export const REQUIRED_FEDERAL_FIGURES = [
  "std_deduction_single",
  "std_deduction_married_jointly",
  "std_deduction_married_separately",
  "std_deduction_head_of_household",
  "std_deduction_qualifying_surviving_spouse",
] as const;

/** Build a fresh, EMPTY, source-cited federal rule pack for a year.
 *  Optionally carry the structure (keys) from a previous pack so a new
 *  year inherits the same fields — but never the previous VALUES, and
 *  always reset to unverified (last year's numbers aren't this year's). */
export function scaffoldRulePack(taxYear: number, previous?: RulePack): RulePack {
  const keys = previous ? previous.figures.map((f) => f.key) : [...REQUIRED_FEDERAL_FIGURES];
  const unique = Array.from(new Set([...REQUIRED_FEDERAL_FIGURES, ...keys]));
  return rulePack.parse({
    schemaVersion: 1,
    taxYear,
    jurisdiction: "us-federal",
    status: "template",
    officialSource: OFFICIAL_SOURCES.formsAndInstructions,
    figures: unique.map((key) => ({
      key,
      value: null, // ALWAYS empty — never inherit a prior year's amount
      unit: "usd" as const,
      verified: false, // ALWAYS unverified until the user confirms
      source: OFFICIAL_SOURCES.form1040,
      note: `Enter the ${taxYear} value from the official IRS instructions, then mark verified.`,
    })),
    updatedAt: Date.now(),
  });
}

/** Is a pack safe to compute final numbers from? (all figures verified) */
export function isPackReady(pack: RulePack): boolean {
  return pack.status === "user-verified" && pack.figures.every((f) => f.verified && f.value !== null);
}

/** Human summary for the "is this year ready?" banner. */
export function packReadiness(pack: RulePack): { ready: boolean; verified: number; total: number; message: string } {
  const verified = pack.figures.filter((f) => f.verified && f.value !== null).length;
  const total = pack.figures.length;
  const ready = isPackReady(pack);
  return {
    ready,
    verified,
    total,
    message: ready
      ? `Tax year ${pack.taxYear} is ready — all ${total} figures verified against official sources.`
      : `Tax year ${pack.taxYear} needs review: ${verified}/${total} figures verified. Fill in the rest from the official IRS pages before relying on any totals.`,
  };
}
