// ============================================================
// Communication Coach (§28) — public surface
// ============================================================
// Offline professional-communication coaching: Client Outreach +
// Interview prep. Pure engine + local content + the honesty
// guardrail. No network, no cloud AI, privacy-first.
// ============================================================

export * from "./schemas.ts";
export * from "./variables.ts";
export * from "./styles.ts";
export * from "./match.ts";
export * from "./safety.ts";
export * from "./roleplay.ts";
export * from "./engine.ts";
export * from "./proposal.ts";
export * from "./io.ts";
export * from "./stt.ts";

export {
  BUSINESS_TYPES,
  OUTREACH_SCENARIOS,
  OUTREACH_OBJECTIONS,
  OUTREACH_SCRIPTS,
  FOLLOW_UPS,
  SERVICE_PACKAGES,
  OUTREACH_FAQ,
  OUTREACH_ROLEPLAY,
  AVOID_PHRASES,
  PREFER_PHRASES,
} from "./data/outreach.ts";

export {
  INTERVIEW_TYPES,
  ANSWER_FRAMEWORKS,
  INTERVIEW_QUESTIONS,
  INTERVIEW_AVOID,
  CONFIDENCE_PROMPTS,
  PREP_CHECKLIST,
  INTERVIEW_ROLEPLAY,
  INTERVIEW_FOLLOWUPS,
} from "./data/interview.ts";

export { MIC_DISCLOSURE, MIC_RULES, INTERVIEW_HONESTY_NOTE, OUTREACH_HONESTY_NOTE, DATA_NOTE } from "./data/privacy.ts";
