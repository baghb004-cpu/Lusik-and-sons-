// ============================================================
// Communication Coach — data shapes (§28)
// ============================================================
// The whole "conversation brain" is local data validated by these
// schemas: prepared scripts, objections + multi-style replies,
// interview questions + answers, frameworks, roleplay nodes,
// follow-up templates, service packages, and the two trackers.
// Offline-first: nothing here talks to a network.
// ============================================================

import { z } from "zod";

// The eight response registers the "make it shorter / friendlier / …" chips
// switch between. Authored content carries one or more of these per item.
export const STYLES = ["simple", "friendly", "professional", "confident", "short", "beginner", "less-pushy", "follow-up"] as const;
export const styleSchema = z.enum(STYLES);
export type Style = (typeof STYLES)[number];

export const responseVariantSchema = z.object({
  style: styleSchema,
  text: z.string().min(1),
});
export type ResponseVariant = z.infer<typeof responseVariantSchema>;

// ── Client Outreach content ─────────────────────────────────
export const objectionSchema = z.object({
  id: z.string().min(1),
  says: z.string().min(1), // what the business said
  replies: z.array(responseVariantSchema).min(1), // honest, non-pushy replies
  tags: z.array(z.string()).default([]),
});
export type Objection = z.infer<typeof objectionSchema>;

export const scenarioSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  situation: z.string().min(1),
  openingScript: z.string().min(1), // may contain [VARIABLES]
  tips: z.array(z.string()).default([]),
  relatedObjections: z.array(z.string()).default([]),
});
export type Scenario = z.infer<typeof scenarioSchema>;

export const SCRIPT_KINDS = ["call", "voicemail", "text", "email", "dm", "proposal"] as const;
export const scriptSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(SCRIPT_KINDS),
  title: z.string().min(1),
  body: z.string().min(1), // [VARIABLES] allowed
});
export type Script = z.infer<typeof scriptSchema>;

export const servicePackageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  summary: z.string().min(1),
  includes: z.array(z.string()).min(1),
  // Honest "starting" language only — never a hard guaranteed price.
  startingNote: z.string().min(1),
});
export type ServicePackage = z.infer<typeof servicePackageSchema>;

// ── Interview content ───────────────────────────────────────
export const interviewQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  answers: z.array(responseVariantSchema).min(1),
  framework: z.string().optional(), // id of a suggested AnswerFramework
  tips: z.array(z.string()).default([]),
});
export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>;

export const answerFrameworkSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  steps: z.array(z.object({ label: z.string().min(1), hint: z.string().min(1) })).min(1),
  example: z.string().min(1),
});
export type AnswerFramework = z.infer<typeof answerFrameworkSchema>;

// ── Roleplay (a plain id→node map, kept deliberately simple) ─
export const roleplayChoiceSchema = z.object({
  label: z.string().min(1),
  nextId: z.string().optional(), // undefined = end of this path
  feedback: z.string().min(1),
  score: z.number().int().min(0).max(3), // 0 weak … 3 strong
});
export const roleplayNodeSchema = z.object({
  id: z.string().min(1),
  persona: z.string().min(1),
  prompt: z.string().min(1), // what the interviewer/owner says
  choices: z.array(roleplayChoiceSchema).min(2),
});
export type RoleplayNode = z.infer<typeof roleplayNodeSchema>;

export const roleplayScenarioSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  persona: z.string().min(1),
  difficulty: z.enum(["beginner", "confident"]).default("beginner"),
  startId: z.string().min(1),
  nodes: z.array(roleplayNodeSchema).min(1),
});
export type RoleplayScenario = z.infer<typeof roleplayScenarioSchema>;

// ── Follow-up templates ─────────────────────────────────────
export const FOLLOWUP_CHANNELS = ["text", "email", "dm", "voicemail"] as const;
export const followUpTemplateSchema = z.object({
  id: z.string().min(1),
  channel: z.enum(FOLLOWUP_CHANNELS),
  title: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1), // [VARIABLES] allowed
});
export type FollowUpTemplate = z.infer<typeof followUpTemplateSchema>;

// ── Honesty guardrail data ──────────────────────────────────
export const phraseGuardSchema = z.object({
  // a substring (lowercased) that signals over-promise / pushy / dishonest
  match: z.string().min(1),
  why: z.string().min(1),
  insteadTry: z.string().min(1),
});
export type PhraseGuard = z.infer<typeof phraseGuardSchema>;

// ── Variables (fill-in) ─────────────────────────────────────
export type CoachVariables = Record<string, string>;

// ── Trackers (localStorage rows) ────────────────────────────
export const OUTREACH_STATUS = ["New", "Called", "Interested", "Follow Up", "Call Back Later", "Sent Info", "Not Interested", "Won", "Lost"] as const;
export const outreachLeadSchema = z.object({
  id: z.string().min(1),
  businessName: z.string().default(""),
  businessType: z.string().default(""),
  phone: z.string().default(""),
  website: z.string().default(""),
  contact: z.string().default(""),
  dateCalled: z.string().default(""),
  callResult: z.string().default(""),
  interest: z.enum(["", "low", "medium", "high"]).default(""),
  followUpDate: z.string().default(""),
  notes: z.string().default(""),
  nextStep: z.string().default(""),
  status: z.enum(OUTREACH_STATUS).default("New"),
});
export type OutreachLead = z.infer<typeof outreachLeadSchema>;

export const INTERVIEW_STATUS = ["Applied", "Interview Scheduled", "Practicing", "Interview Completed", "Follow-Up Needed", "Waiting", "Offer Received", "Not Selected", "Accepted", "Declined"] as const;
export const interviewLeadSchema = z.object({
  id: z.string().min(1),
  company: z.string().default(""),
  jobTitle: z.string().default(""),
  contact: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  interviewDate: z.string().default(""),
  interviewType: z.string().default(""),
  status: z.enum(INTERVIEW_STATUS).default("Applied"),
  notes: z.string().default(""),
  followUpDate: z.string().default(""),
  thankYouSent: z.boolean().default(false),
  nextStep: z.string().default(""),
});
export type InterviewLead = z.infer<typeof interviewLeadSchema>;
