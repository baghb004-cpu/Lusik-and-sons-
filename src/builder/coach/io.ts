// ============================================================
// Communication Coach — export / import (pure)
// ============================================================
// Back up everything that lives on this device (your details + both
// trackers) to one JSON file, and restore it. Validated on import so
// a malformed or foreign file can't corrupt the app. No network.
// ============================================================

import { z } from "zod";
import { outreachLeadSchema, interviewLeadSchema, type OutreachLead, type InterviewLead } from "./schemas.ts";

export const COACH_EXPORT_VERSION = 1;
const APP_TAG = "lusik-communication-coach";

export interface CoachData {
  vars: Record<string, string>;
  outreachLeads: OutreachLead[];
  interviewLeads: InterviewLead[];
}

const exportSchema = z.object({
  app: z.literal(APP_TAG),
  version: z.number().int().min(1),
  vars: z.record(z.string(), z.string()).default({}),
  outreachLeads: z.array(outreachLeadSchema).default([]),
  interviewLeads: z.array(interviewLeadSchema).default([]),
});

/** A pretty JSON snapshot of all coach data, tagged + versioned. */
export function serializeCoachData(d: CoachData): string {
  return JSON.stringify({ app: APP_TAG, version: COACH_EXPORT_VERSION, vars: d.vars, outreachLeads: d.outreachLeads, interviewLeads: d.interviewLeads }, null, 2);
}

/** Parse + validate an exported file. Throws a friendly error on bad input. */
export function parseCoachData(json: string): CoachData {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const parsed = exportSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("That doesn't look like a Communication Coach backup file.");
  }
  if (parsed.data.version > COACH_EXPORT_VERSION) {
    throw new Error("This backup was made by a newer version of the app. Update first, then import.");
  }
  return { vars: parsed.data.vars, outreachLeads: parsed.data.outreachLeads, interviewLeads: parsed.data.interviewLeads };
}
