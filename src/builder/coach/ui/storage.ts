"use client";

// Local, offline persistence for Communication Coach — everything lives in
// the browser (localStorage). No network, no accounts. A tiny typed hook plus
// the "My details" variable definitions used to fill scripts.

import { useCallback, useEffect, useState } from "react";
import type { CoachData } from "../io.ts";

const PREFIX = "lusik_coach_";

// Read every piece of coach data straight from localStorage (for export).
export function readAllCoachData(): CoachData {
  const get = <T>(k: string, fallback: T): T => {
    try {
      const r = localStorage.getItem(PREFIX + k);
      return r != null ? (JSON.parse(r) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  return { vars: get("vars", {}), outreachLeads: get("outreach_leads", []), interviewLeads: get("interview_leads", []) };
}

// Overwrite all coach data (for import). Caller should reload so mounted
// components re-read from storage.
export function writeAllCoachData(d: CoachData): void {
  localStorage.setItem(PREFIX + "vars", JSON.stringify(d.vars));
  localStorage.setItem(PREFIX + "outreach_leads", JSON.stringify(d.outreachLeads));
  localStorage.setItem(PREFIX + "interview_leads", JSON.stringify(d.interviewLeads));
}

export function clearAllCoachData(): void {
  for (const k of ["vars", "outreach_leads", "interview_leads"]) localStorage.removeItem(PREFIX + k);
}

/** A useState that mirrors to localStorage (offline, per-device). */
export function useLocalState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const full = PREFIX + key;
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(full);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore corrupt/absent */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);

  const set = useCallback(
    (v: T | ((p: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        try {
          localStorage.setItem(full, JSON.stringify(next));
        } catch {
          /* storage full / disabled — stays in memory */
        }
        return next;
      });
    },
    [full]
  );

  return [value, set];
}

// The personal details that fill [TOKENS] in scripts. Grouped for the form.
export const DETAIL_FIELDS: Array<{ key: string; label: string; placeholder: string; group: "you" | "outreach" | "interview" }> = [
  { key: "USER_NAME", label: "Your name", placeholder: "e.g. Alex Rivera", group: "you" },
  { key: "USER_PHONE", label: "Your phone", placeholder: "e.g. (555) 123-4567", group: "you" },
  { key: "USER_EMAIL", label: "Your email", placeholder: "e.g. alex@example.com", group: "you" },
  { key: "USER_BUSINESS_NAME", label: "Your business name (optional)", placeholder: "e.g. Rivera Web Studio", group: "you" },
  { key: "PORTFOLIO_LINK", label: "Your examples / portfolio link (optional)", placeholder: "e.g. a link to past work", group: "you" },
  { key: "BUSINESS_NAME", label: "Business you're calling", placeholder: "e.g. Joe's Cafe", group: "outreach" },
  { key: "BUSINESS_TYPE", label: "Business type", placeholder: "e.g. Cafe", group: "outreach" },
  { key: "CONTACT_NAME", label: "Their name (if known)", placeholder: "e.g. Joe", group: "outreach" },
  { key: "COMPANY_NAME", label: "Company (interview)", placeholder: "e.g. Lakeside Diner", group: "interview" },
  { key: "JOB_TITLE", label: "Job title (interview)", placeholder: "e.g. Prep cook", group: "interview" },
  { key: "AVAILABILITY", label: "Your availability", placeholder: "e.g. weekdays after 3pm, weekends", group: "interview" },
];

export type CoachVars = Record<string, string>;
