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

// ============================================================
// State module (plan §25 Phase 5) — same safety contract: empty + cited.
// State rules vary enormously (some states have no income tax), so we NEVER
// guess a figure. We scaffold an empty, source-cited pack pointing at the
// official state directory and let the user fill verified numbers themselves.
// ============================================================

/** Official IRS directory that links to every state's government / tax site. */
export const STATE_DIRECTORY_URL =
  "https://www.irs.gov/businesses/small-businesses-self-employed/state-government-websites";

export const COMMON_STATE_FIGURES = ["state-standard-deduction", "state-personal-exemption", "state-income-tax"] as const;

/** Build an empty, cited STATE rule pack (e.g. "us-ca"). No figure is ever
 *  guessed or carried over — every value is null + unverified. */
export function scaffoldStatePack(stateCode: string, taxYear: number, figureKeys?: string[]): RulePack {
  const code = stateCode.toLowerCase().replace(/[^a-z]/g, "");
  if (!code) throw new Error("Provide a 2-letter state code, e.g. 'ca'.");
  const keys = figureKeys && figureKeys.length ? figureKeys : [...COMMON_STATE_FIGURES];
  return rulePack.parse({
    schemaVersion: 1,
    taxYear,
    jurisdiction: `us-${code}`,
    status: "template",
    officialSource: STATE_DIRECTORY_URL,
    figures: keys.map((key) => ({
      key,
      value: null,
      unit: key.includes("tax") || key.includes("rate") ? ("percent" as const) : ("usd" as const),
      verified: false,
      source: STATE_DIRECTORY_URL,
      note: `Find the ${taxYear} ${key.replace(/-/g, " ")} on YOUR state's official Department of Revenue site (via the source link), then mark it verified.`,
    })),
    updatedAt: Date.now(),
  });
}

export function stateGuidanceFor(stateCode: string, taxYear: number): UpdateGuidance {
  return {
    taxYear,
    steps: [
      `Open your state's official Department of Revenue site for ${taxYear} (find it in the official directory below — only .gov sites).`,
      `Read your state's standard deduction, exemptions, and tax rate/brackets from the official instructions.`,
      `Scaffold the state pack, fill each figure from those pages, then mark it verified. Figures are never guessed or carried over.`,
      `State rules vary widely — some states have no income tax at all. Verify everything locally.`,
    ],
    sources: [{ label: "Official state government / tax sites", url: STATE_DIRECTORY_URL }],
  };
}

// ============================================================
// Filing helpers (plan §25 Phase 6) — guidance + official links ONLY.
// This organizer NEVER e-files, auto-fills a form, or submits anything.
// ============================================================

export function freeFileGuidance(taxYear: number): UpdateGuidance {
  return {
    taxYear,
    steps: [
      `This organizer never files for you. To e-file yourself, use the official IRS Free File or Free File Fillable Forms.`,
      `Open Free File Fillable Forms (below), make your account, and type in the figures from this organizer.`,
      `Double-check every number against your documents before you submit on the official site.`,
    ],
    sources: [
      { label: "IRS Free File", url: OFFICIAL_SOURCES.freeFile },
      { label: "Free File Fillable Forms", url: OFFICIAL_SOURCES.freeFileFillable },
    ],
  };
}

export function printAndMailGuidance(taxYear: number): UpdateGuidance {
  return {
    taxYear,
    steps: [
      `Prefer paper? Download the official ${taxYear} Form 1040 (and the schedules you need) from the IRS, print them, and copy your figures from this organizer by hand.`,
      `The mailing address depends on your state and whether you enclose a payment — use the official IRS "Where to File" page.`,
      `Keep a copy for your records. This app does not mail or submit anything for you.`,
    ],
    sources: [
      { label: "About Form 1040 (download / print)", url: OFFICIAL_SOURCES.form1040 },
      { label: "Forms & instructions", url: OFFICIAL_SOURCES.formsAndInstructions },
    ],
  };
}
