"use client";

// ============================================================
// Communication Coach (§28) — the offline coaching workspace
// ============================================================
// A built-in mode of the Workshop: Client Outreach Coach + Interview
// Coach, both powered by the local conversation brain (no cloud AI,
// no network). Your details + trackers stay on this device.
// ============================================================

import { useMemo, useState } from "react";
import { OutreachCoach } from "./OutreachCoach.tsx";
import { InterviewCoach } from "./InterviewCoach.tsx";
import { DETAIL_FIELDS, useLocalState, type CoachVars } from "./storage.ts";
import { Section, card, field } from "./widgets.tsx";
import { MIC_RULES, MIC_DISCLOSURE, DATA_NOTE, OUTREACH_HONESTY_NOTE, INTERVIEW_HONESTY_NOTE } from "../index.ts";

type View = "home" | "outreach" | "interview" | "details" | "privacy";

export function CommunicationCoach() {
  const [view, setView] = useState<View>("home");
  const [vars, setVars] = useLocalState<CoachVars>("vars", {});
  const filledCount = useMemo(() => DETAIL_FIELDS.filter((f) => (vars[f.key] ?? "").trim()).length, [vars]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 font-body text-ink">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">🗣️ Communication Coach</h1>
        {view !== "home" ? <button type="button" onClick={() => setView("home")} className="rounded-full border border-ink/20 px-3 py-1 text-sm">‹ All coaches</button> : null}
      </div>
      <p className="mt-1 text-sm text-muted">Practice speaking clearly, honestly, and confidently — for offering website services and for interviews. Works fully offline; nothing is uploaded.</p>

      {view === "home" ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setView("outreach")} className={`${card} text-left hover:bg-cream`} aria-label="Open Client Outreach Coach">
              <h2 className="font-display text-xl">📞 Client Outreach Coach</h2>
              <p className="mt-1 text-sm text-muted">Offer website help to local businesses — opening lines, honest replies to objections, follow-ups, and a simple call tracker.</p>
            </button>
            <button type="button" onClick={() => setView("interview")} className={`${card} text-left hover:bg-cream`} aria-label="Open Interview Coach">
              <h2 className="font-display text-xl">💼 Interview Coach</h2>
              <p className="mt-1 text-sm text-muted">Prepare for interviews and client meetings — example answers, frameworks, a practice roleplay, and thank-you messages.</p>
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setView("details")} className={`${card} text-left hover:bg-cream`} aria-label="Edit my details">
              <h2 className="font-display text-lg">✍️ My details</h2>
              <p className="mt-1 text-sm text-muted">Fill these once and every script personalizes itself. {filledCount}/{DETAIL_FIELDS.length} filled.</p>
            </button>
            <button type="button" onClick={() => setView("privacy")} className={`${card} text-left hover:bg-cream`} aria-label="Privacy and honesty">
              <h2 className="font-display text-lg">🔒 Settings & privacy</h2>
              <p className="mt-1 text-sm text-muted">How this stays honest, private, and offline.</p>
            </button>
          </div>
        </>
      ) : null}

      {view === "outreach" ? <div className="mt-4"><OutreachCoach vars={vars} /></div> : null}
      {view === "interview" ? <div className="mt-4"><InterviewCoach vars={vars} /></div> : null}

      {view === "details" ? (
        <Section title="My details" subtitle="Saved on this device. They auto-fill the scripts and messages — fill what you can; the rest show as friendly placeholders.">
          <div className="grid gap-3 sm:grid-cols-2">
            {DETAIL_FIELDS.map((f) => (
              <label key={f.key} className="block text-sm">
                <span className="mb-1 block text-xs text-muted">{f.label}</span>
                <input value={vars[f.key] ?? ""} onChange={(e) => setVars((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className={field} aria-label={f.label} />
              </label>
            ))}
          </div>
        </Section>
      ) : null}

      {view === "privacy" ? (
        <Section title="Settings & privacy" subtitle="Plain-English promises this coach keeps.">
          <div className={`${card} space-y-3 text-sm`}>
            <p>{DATA_NOTE}</p>
            <div>
              <p className="font-medium">Honesty</p>
              <p className="text-xs text-muted">{OUTREACH_HONESTY_NOTE}</p>
              <p className="mt-1 text-xs text-muted">{INTERVIEW_HONESTY_NOTE}</p>
            </div>
            <div>
              <p className="font-medium">Microphone (for the future Live Call Assist)</p>
              <p className="text-xs text-muted">{MIC_DISCLOSURE}</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-muted">{MIC_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
            <p className="text-[11px] text-muted">Always follow your local laws and get permission when required. This tool is for honest, respectful communication only.</p>
          </div>
        </Section>
      ) : null}

      <p className="mt-8 text-[11px] text-muted">Communication Coach gives practice and suggestions, not guarantees. Speak honestly, be respectful, and a polite “no” is always a fine outcome.</p>
    </main>
  );
}
