// ============================================================
// Communication Coach — variable fill-in (pure)
// ============================================================
// Scripts/templates carry [UPPER_SNAKE] tokens. fillTemplate swaps
// in the user's saved details; an UNFILLED token renders as a clear
// bracketed label (never a blank), so a script always shows exactly
// what's left to personalize.
// ============================================================

import type { CoachVariables } from "./schemas.ts";

// Known variables → a friendly label shown when the value is still empty.
export const VARIABLE_LABELS: Record<string, string> = {
  USER_NAME: "your name",
  USER_BUSINESS_NAME: "your business name",
  USER_PHONE: "your phone",
  USER_EMAIL: "your email",
  PORTFOLIO_LINK: "your examples link",
  BUSINESS_NAME: "the business name",
  BUSINESS_TYPE: "the business type",
  CONTACT_NAME: "their name",
  CURRENT_WEBSITE_STATUS: "what you noticed about their site",
  MAIN_ISSUE: "the main issue you noticed",
  SERVICE_TYPE: "the service you're offering",
  PRICE_RANGE: "your price range",
  FOLLOW_UP_DATE: "the follow-up date",
  COMPANY_NAME: "the company",
  JOB_TITLE: "the job title",
  INTERVIEW_TYPE: "the interview type",
  EXPERIENCE_SUMMARY: "your experience",
  EDUCATION: "your education or training",
  AVAILABILITY: "your availability",
  STRENGTHS: "your strengths",
  SKILLS: "your skills",
  WORK_HISTORY: "your work history",
};

const TOKEN = /\[([A-Z][A-Z0-9_]*)\]/g;

/** Replace [TOKENS] with saved values; unfilled → "[friendly label]". */
export function fillTemplate(text: string, vars: CoachVariables = {}): string {
  return text.replace(TOKEN, (_m, key: string) => {
    const v = vars[key];
    if (v && v.trim()) return v.trim();
    return `[${VARIABLE_LABELS[key] ?? key.toLowerCase().replace(/_/g, " ")}]`;
  });
}

/** The distinct tokens in a template that aren't filled yet (for a checklist). */
export function missingVars(text: string, vars: CoachVariables = {}): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(TOKEN)) {
    const key = m[1];
    if (!(vars[key] && vars[key].trim())) out.add(key);
  }
  return [...out];
}
