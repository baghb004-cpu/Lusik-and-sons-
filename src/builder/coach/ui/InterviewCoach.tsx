"use client";

// Interview Coach — honest interview prep, practice, and follow-ups.

import { useState } from "react";
import {
  INTERVIEW_QUESTIONS, ANSWER_FRAMEWORKS, INTERVIEW_ROLEPLAY, INTERVIEW_FOLLOWUPS, PREP_CHECKLIST,
  CONFIDENCE_PROMPTS, INTERVIEW_AVOID, INTERVIEW_HONESTY_NOTE,
} from "../index.ts";
import { pickVariant, availableStyles } from "../styles.ts";
import { fillTemplate } from "../variables.ts";
import { fillFollowUp } from "../engine.ts";
import { INTERVIEW_STATUS, type InterviewLead, type Style, type InterviewQuestion } from "../schemas.ts";
import { useLocalState, type CoachVars } from "./storage.ts";
import { CopyButton, StyleChips, Section, card, field } from "./widgets.tsx";
import { RoleplayPanel } from "./RoleplayPanel.tsx";

const newId = () => `iv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function InterviewCoach({ vars }: { vars: CoachVars }) {
  const [openId, setOpenId] = useState<string | null>(INTERVIEW_QUESTIONS[0].id);
  const [followId, setFollowId] = useState(INTERVIEW_FOLLOWUPS[0].id);
  const follow = INTERVIEW_FOLLOWUPS.find((f) => f.id === followId)!;
  const filledFollow = fillFollowUp(follow, vars);

  return (
    <div className="font-body text-ink">
      <p className="rounded-lg bg-cream/70 px-3 py-2 text-xs">{INTERVIEW_HONESTY_NOTE}</p>

      <Section title="Practice answers" subtitle="Tap a question for honest example answers — switch the style, then make it your own.">
        <div className="flex flex-wrap gap-1.5">
          {INTERVIEW_QUESTIONS.map((q) => (
            <button key={q.id} type="button" onClick={() => setOpenId(openId === q.id ? null : q.id)} className={`min-h-8 rounded-full border px-3 text-xs ${openId === q.id ? "border-ink bg-ink text-cream" : "border-ink/20 hover:bg-cream"}`}>
              {q.question}
            </button>
          ))}
        </div>
        {openId ? <QuestionDetail question={INTERVIEW_QUESTIONS.find((q) => q.id === openId)!} vars={vars} /> : null}
      </Section>

      <Section title="Answer frameworks" subtitle="Simple shapes for building your own honest answers.">
        <div className="grid gap-2 sm:grid-cols-3">
          {ANSWER_FRAMEWORKS.map((f) => (
            <div key={f.id} className={card}>
              <p className="font-medium">{f.name}</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-xs">{f.steps.map((s) => <li key={s.label}><strong>{s.label}:</strong> {s.hint}</li>)}</ol>
              <p className="mt-2 text-[11px] italic text-muted">{f.example}</p>
            </div>
          ))}
        </div>
      </Section>

      <RoleplayPanel scenarios={INTERVIEW_ROLEPLAY} title="Practice roleplay" subtitle="A safe mock conversation. Pick a persona, choose a reply, and see how it lands." />

      <Section title="Before the interview" subtitle="A quick checklist — no internet required.">
        <ul className="space-y-1 text-sm">{PREP_CHECKLIST.map((p) => <li key={p} className="flex gap-2"><span aria-hidden>☐</span><span>{p}</span></li>)}</ul>
      </Section>

      <Section title="Follow-up message" subtitle="Send a short thank-you — it genuinely helps.">
        <select value={followId} onChange={(e) => setFollowId(e.target.value)} className={field} aria-label="Follow-up template">
          {INTERVIEW_FOLLOWUPS.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
        </select>
        <div className={`mt-2 ${card}`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            {filledFollow.subject ? <span className="text-xs text-muted">Subject: {filledFollow.subject}</span> : <span />}
            <CopyButton text={(filledFollow.subject ? filledFollow.subject + "\n\n" : "") + filledFollow.body} />
          </div>
          <p className="whitespace-pre-wrap text-sm">{filledFollow.body}</p>
        </div>
      </Section>

      <details className="mt-6 rounded-xl border border-ink/10">
        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">Things to avoid + confidence reminders</summary>
        <div className="px-4 pb-3 text-sm">
          <p className="mt-1 font-medium">Avoid:</p>
          <ul className="list-disc pl-5 text-xs">{INTERVIEW_AVOID.map((a) => <li key={a}>{a}</li>)}</ul>
          <p className="mt-2 font-medium">Remember:</p>
          <ul className="list-disc pl-5 text-xs">{CONFIDENCE_PROMPTS.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      </details>

      <InterviewTracker vars={vars} />
    </div>
  );
}

function QuestionDetail({ question, vars }: { question: InterviewQuestion; vars: CoachVars }) {
  const [style, setStyle] = useState<Style>(question.answers[0].style);
  const variant = pickVariant(question.answers, style);
  const answer = variant ? fillTemplate(variant.text, vars) : "";
  const fw = question.framework ? ANSWER_FRAMEWORKS.find((f) => f.id === question.framework) : null;
  return (
    <div className={`mt-2 ${card}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <StyleChips available={availableStyles(question.answers)} value={style} onChange={setStyle} />
        <CopyButton text={answer} />
      </div>
      <p className="text-sm">{answer}</p>
      {question.tips.length ? <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted">{question.tips.map((t) => <li key={t}>{t}</li>)}</ul> : null}
      {fw ? <p className="mt-2 text-[11px] text-muted">Tip: try the <strong>{fw.name}</strong>.</p> : null}
    </div>
  );
}

function InterviewTracker({ vars }: { vars: CoachVars }) {
  const [leads, setLeads] = useLocalState<InterviewLead[]>("interview_leads", []);
  const add = () =>
    setLeads((prev) => [
      { id: newId(), company: vars.COMPANY_NAME ?? "", jobTitle: vars.JOB_TITLE ?? "", contact: "", phone: "", email: "", interviewDate: "", interviewType: "", status: "Applied", notes: "", followUpDate: "", thankYouSent: false, nextStep: "" },
      ...prev,
    ]);
  const update = (id: string, patch: Partial<InterviewLead>) => setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const remove = (id: string) => setLeads((prev) => prev.filter((l) => l.id !== id));

  return (
    <Section title="Interview tracker" subtitle="Track applications and interviews — saved on this device only.">
      <button type="button" onClick={add} className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream hover:opacity-90">+ Add an interview</button>
      <div className="mt-3 space-y-2">
        {leads.length === 0 ? <p className="text-sm text-muted">Nothing tracked yet.</p> : null}
        {leads.map((l) => (
          <div key={l.id} className={card}>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={l.company} onChange={(e) => update(l.id, { company: e.target.value })} placeholder="Company" className={field} aria-label="Company" />
              <input value={l.jobTitle} onChange={(e) => update(l.id, { jobTitle: e.target.value })} placeholder="Job title" className={field} aria-label="Job title" />
              <select value={l.status} onChange={(e) => update(l.id, { status: e.target.value as InterviewLead["status"] })} className={field} aria-label="Status">
                {INTERVIEW_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input value={l.interviewDate} onChange={(e) => update(l.id, { interviewDate: e.target.value })} placeholder="Interview date" className={field} aria-label="Interview date" />
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={l.thankYouSent} onChange={(e) => update(l.id, { thankYouSent: e.target.checked })} className="h-3.5 w-3.5 accent-ink" /> Thank-you message sent
            </label>
            <textarea value={l.notes} onChange={(e) => update(l.id, { notes: e.target.value })} rows={2} placeholder="Notes" className={`mt-2 ${field}`} aria-label="Notes" />
            <div className="mt-1 flex justify-end"><button type="button" onClick={() => remove(l.id)} className="text-xs text-red-700">Remove</button></div>
          </div>
        ))}
      </div>
    </Section>
  );
}
