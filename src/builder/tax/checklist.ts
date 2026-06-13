// ============================================================
// Tax Assistant — document checklist + form guidance (data)
// ============================================================
// General, stable "which document / which form when" guidance,
// each item citing an OFFICIAL IRS page. This is plain-language
// organization help, NOT tax advice and NOT year-specific dollar
// figures (those live in verified rule packs). Phase 1's core.
//
// Triggers key off guided-interview answer ids so the organizer
// can say "based on what you told me, gather these and you'll
// likely touch these forms." Every claim points to irs.gov.
// ============================================================

export interface ChecklistItem {
  id: string;
  doc: string; // plain name
  why: string; // five-year-old-simple reason
  /** interview answer ids that make this relevant; empty = everyone. */
  triggers: string[];
  source: string; // official IRS URL
}

export interface FormGuidance {
  form: string;
  plain: string; // what it's for, simply
  triggers: string[];
  source: string;
}

const IRS = "https://www.irs.gov";

// ── what to gather ──────────────────────────────────────────
export const DOCUMENT_CHECKLIST: ChecklistItem[] = [
  { id: "id-info", doc: "Names, birthdates & Social Security numbers for everyone on the return", why: "The IRS matches these exactly — a typo can hold up a refund.", triggers: [], source: `${IRS}/individuals` },
  { id: "w2", doc: "W-2 from each employer", why: "Shows the wages you earned and the tax already taken out of your paychecks.", triggers: ["had-job"], source: `${IRS}/forms-pubs/about-form-w-2` },
  { id: "1099-nec", doc: "1099-NEC for any freelance / gig / contractor pay", why: "Money you earned working for yourself that no one withheld tax from.", triggers: ["self-employed"], source: `${IRS}/forms-pubs/about-form-1099-nec` },
  { id: "1099-k", doc: "1099-K from payment apps / marketplaces", why: "Reports money you received through apps or selling platforms.", triggers: ["self-employed", "sold-online"], source: `${IRS}/businesses/understanding-your-form-1099-k` },
  { id: "1099-int", doc: "1099-INT from banks", why: "Interest your savings earned counts as income.", triggers: ["bank-interest"], source: `${IRS}/forms-pubs/about-form-1099-int` },
  { id: "1099-div", doc: "1099-DIV from investments", why: "Dividends your investments paid you.", triggers: ["investments"], source: `${IRS}/forms-pubs/about-form-1099-div` },
  { id: "1099-r", doc: "1099-R for retirement / pension withdrawals", why: "Money taken out of a retirement account is usually taxable.", triggers: ["retirement-withdrawal"], source: `${IRS}/forms-pubs/about-form-1099-r` },
  { id: "1099-g", doc: "1099-G for unemployment or state refunds", why: "Unemployment pay can be taxable income.", triggers: ["unemployment"], source: `${IRS}/forms-pubs/about-form-1099-g` },
  { id: "1098", doc: "1098 mortgage interest statement", why: "Interest you paid on a home loan may lower your taxes if you itemize.", triggers: ["owns-home"], source: `${IRS}/forms-pubs/about-form-1098` },
  { id: "1098-t", doc: "1098-T tuition statement", why: "College tuition can unlock education credits.", triggers: ["paid-tuition"], source: `${IRS}/forms-pubs/about-form-1098-t` },
  { id: "1098-e", doc: "1098-E student loan interest", why: "Interest on student loans may reduce your taxable income.", triggers: ["student-loan"], source: `${IRS}/forms-pubs/about-form-1098-e` },
  { id: "1095-a", doc: "1095-A if you bought health insurance through the Marketplace", why: "Required to reconcile any premium help you received — skipping it stalls the return.", triggers: ["marketplace-insurance"], source: `${IRS}/forms-pubs/about-form-1095-a` },
  { id: "ssa-1099", doc: "SSA-1099 for Social Security benefits", why: "Part of Social Security can be taxable depending on your other income.", triggers: ["social-security"], source: `${IRS}/forms-pubs/about-form-ssa-1099` },
  { id: "donations", doc: "Records of charitable donations", why: "Gifts to charity can lower taxes if you itemize — keep the receipts.", triggers: ["donated"], source: `${IRS}/charities-non-profits/charitable-contribution-deductions` },
  { id: "property-tax", doc: "Property tax bills", why: "State/local taxes you paid may count if you itemize.", triggers: ["owns-home"], source: `${IRS}/taxtopics/tc503` },
];

// ── which forms you'll likely touch ─────────────────────────
export const FORM_GUIDANCE: FormGuidance[] = [
  { form: "Form 1040", plain: "The main tax return — almost everyone files this.", triggers: [], source: `${IRS}/forms-pubs/about-form-1040` },
  { form: "Schedule 1", plain: "Extra income (like unemployment) and a few adjustments (like student-loan interest).", triggers: ["unemployment", "student-loan"], source: `${IRS}/forms-pubs/about-schedule-1-form-1040` },
  { form: "Schedule A", plain: "Use this ONLY if itemizing beats the standard deduction (mortgage interest, big donations, etc.).", triggers: ["owns-home", "donated"], source: `${IRS}/forms-pubs/about-schedule-a-form-1040` },
  { form: "Schedule B", plain: "Interest and dividends, once they add up past a threshold.", triggers: ["bank-interest", "investments"], source: `${IRS}/forms-pubs/about-schedule-b-form-1040` },
  { form: "Schedule C", plain: "Profit or loss from self-employment / a small business.", triggers: ["self-employed"], source: `${IRS}/forms-pubs/about-schedule-c-form-1040` },
  { form: "Schedule SE", plain: "Self-employment tax (Social Security + Medicare on your own earnings).", triggers: ["self-employed"], source: `${IRS}/forms-pubs/about-schedule-se-form-1040` },
  { form: "Form 8863", plain: "Education credits, if you paid college tuition.", triggers: ["paid-tuition"], source: `${IRS}/forms-pubs/about-form-8863` },
  { form: "Form 8962", plain: "Reconciles Marketplace health-insurance help (needs your 1095-A).", triggers: ["marketplace-insurance"], source: `${IRS}/forms-pubs/about-form-8962` },
];

/** What to gather, given the user's yes/no interview answers. */
export function neededDocuments(answers: Record<string, unknown>): ChecklistItem[] {
  return DOCUMENT_CHECKLIST.filter((i) => i.triggers.length === 0 || i.triggers.some((t) => answers[t] === true));
}
export function likelyForms(answers: Record<string, unknown>): FormGuidance[] {
  return FORM_GUIDANCE.filter((f) => f.triggers.length === 0 || f.triggers.some((t) => answers[t] === true));
}

// ── the plain-English guided-interview questions (Phase 2 seed) ─
export interface InterviewQuestion {
  id: string;
  ask: string;
  why: string;
}
export const INTERVIEW: InterviewQuestion[] = [
  { id: "had-job", ask: "Did you work a regular job with a paycheck this year?", why: "That means a W-2, the most common income document." },
  { id: "self-employed", ask: "Did you do any freelance, gig, or self-employed work?", why: "Self-employment is taxed differently and may add Schedule C + SE." },
  { id: "sold-online", ask: "Did you sell things online or through an app?", why: "Payment apps may send a 1099-K you need to account for." },
  { id: "bank-interest", ask: "Did your bank accounts earn interest?", why: "Interest is taxable income (1099-INT)." },
  { id: "investments", ask: "Did you own stocks, funds, or crypto that paid you?", why: "Dividends/distributions are income (1099-DIV)." },
  { id: "retirement-withdrawal", ask: "Did you take money out of a retirement account?", why: "Withdrawals are usually taxable (1099-R)." },
  { id: "unemployment", ask: "Did you receive unemployment benefits?", why: "Unemployment can be taxable (1099-G, Schedule 1)." },
  { id: "social-security", ask: "Did you receive Social Security benefits?", why: "Part may be taxable (SSA-1099)." },
  { id: "owns-home", ask: "Do you own a home with a mortgage?", why: "Mortgage interest and property tax may help if you itemize." },
  { id: "paid-tuition", ask: "Did you pay college tuition for yourself or a dependent?", why: "Tuition can unlock education credits (1098-T, Form 8863)." },
  { id: "student-loan", ask: "Did you pay interest on student loans?", why: "It may reduce taxable income (1098-E)." },
  { id: "donated", ask: "Did you give money or goods to charity?", why: "Donations help only if you itemize — and you must keep records." },
  { id: "marketplace-insurance", ask: "Did you buy health insurance through HealthCare.gov / a state Marketplace?", why: "You MUST file a 1095-A / Form 8962, or the return stalls." },
];
