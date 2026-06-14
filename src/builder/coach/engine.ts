// ============================================================
// Communication Coach — the composed engine (pure)
// ============================================================
// Thin glue over the parts: turn "what they said" into a suggested,
// style-switched, variable-filled reply; fill any script/template;
// look items up by id. Data is injected (defaults to the bundled
// packs) so tests can drive it with fixtures.
// ============================================================

import type { CoachVariables, Objection, Style, Script, FollowUpTemplate } from "./schemas.ts";
import { matchIntent, OUTREACH_INTENTS, type Intent } from "./match.ts";
import { pickVariant } from "./styles.ts";
import { fillTemplate } from "./variables.ts";
import { OUTREACH_OBJECTIONS } from "./data/outreach.ts";

export function objectionById(id: string, list: Objection[] = OUTREACH_OBJECTIONS): Objection | null {
  return list.find((o) => o.id === id) ?? null;
}

/** A reply for a specific objection, in the requested style, variables filled. */
export function replyForObjection(objection: Objection, style: Style, vars: CoachVariables = {}): string | null {
  const v = pickVariant(objection.replies, style);
  return v ? fillTemplate(v.text, vars) : null;
}

export interface Suggestion {
  objection: Objection | null;
  reply: string | null;
  confidence: number;
}

/** "Type what they said" → matched objection + a filled, styled reply. */
export function suggestReply(
  text: string,
  style: Style = "friendly",
  vars: CoachVariables = {},
  opts: { objections?: Objection[]; intents?: Intent[] } = {}
): Suggestion {
  const objections = opts.objections ?? OUTREACH_OBJECTIONS;
  const intents = opts.intents ?? OUTREACH_INTENTS;
  const m = matchIntent(text, intents);
  if (!m) return { objection: null, reply: null, confidence: 0 };
  const objection = objections.find((o) => o.id === m.id) ?? null;
  if (!objection) return { objection: null, reply: null, confidence: m.confidence };
  return { objection, reply: replyForObjection(objection, style, vars), confidence: m.confidence };
}

/** Fill a call/voicemail/proposal script with the user's saved details. */
export function fillScript(script: Script, vars: CoachVariables = {}): string {
  return fillTemplate(script.body, vars);
}

/** Fill a follow-up template (subject + body) with the user's details. */
export function fillFollowUp(t: FollowUpTemplate, vars: CoachVariables = {}): { subject?: string; body: string } {
  return { subject: t.subject ? fillTemplate(t.subject, vars) : undefined, body: fillTemplate(t.body, vars) };
}
