"use client";

// Client Outreach Coach — help offer website services honestly and calmly.

import { useMemo, useState } from "react";
import {
  OUTREACH_SCENARIOS, OUTREACH_OBJECTIONS, SERVICE_PACKAGES, FOLLOW_UPS, PREFER_PHRASES, OUTREACH_HONESTY_NOTE, OUTREACH_ROLEPLAY,
} from "../index.ts";
import { replyForObjection, fillScript, fillFollowUp } from "../engine.ts";
import { availableStyles } from "../styles.ts";
import { checkHonesty } from "../safety.ts";
import { fillTemplate } from "../variables.ts";
import type { Objection, Style } from "../schemas.ts";
import { useLocalState, type CoachVars } from "./storage.ts";
import { CopyButton, StyleChips, Section, card, field } from "./widgets.tsx";
import { LiveCallAssist } from "./LiveCallAssist.tsx";
import { ProposalBuilder } from "./ProposalBuilder.tsx";
import { RoleplayPanel } from "./RoleplayPanel.tsx";
import { OUTREACH_STATUS, type OutreachLead } from "../schemas.ts";

const newId = () => `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function OutreachCoach({ vars }: { vars: CoachVars }) {
  const [draft, setDraft] = useState("");
  const [openObjId, setOpenObjId] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState(OUTREACH_SCENARIOS[0].id);
  const [followId, setFollowId] = useState(FOLLOW_UPS[0].id);

  const honesty = useMemo(() => (draft.trim() ? checkHonesty(draft) : []), [draft]);
  const scenario = OUTREACH_SCENARIOS.find((s) => s.id === scenarioId)!;
  const follow = FOLLOW_UPS.find((f) => f.id === followId)!;
  const filledFollow = fillFollowUp(follow, vars);

  return (
    <div className="font-body text-ink">
      <p className="rounded-lg bg-cream/70 px-3 py-2 text-xs">{OUTREACH_HONESTY_NOTE}</p>

      <LiveCallAssist vars={vars} />

      {/* Quick objections */}
      <Section title="Common objections" subtitle="Tap one to see calm, honest replies — switch the style with the chips.">
        <div className="flex flex-wrap gap-1.5">
          {OUTREACH_OBJECTIONS.map((o) => (
            <button key={o.id} type="button" onClick={() => setOpenObjId(openObjId === o.id ? null : o.id)} className={`min-h-8 rounded-full border px-3 text-xs ${openObjId === o.id ? "border-ink bg-ink text-cream" : "border-ink/20 hover:bg-cream"}`}>
              {o.says}
            </button>
          ))}
        </div>
        {openObjId ? <ObjectionDetail objection={OUTREACH_OBJECTIONS.find((o) => o.id === openObjId)!} vars={vars} /> : null}
      </Section>

      {/* Opening scripts by scenario */}
      <Section title="What to say first" subtitle="Pick your situation for a ready opening line (your saved details fill in automatically).">
        <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} className={field} aria-label="Scenario">
          {OUTREACH_SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <div className={`mt-2 ${card}`}>
          <div className="mb-2 flex justify-end"><CopyButton text={fillTemplate(scenario.openingScript, vars)} /></div>
          <p className="text-sm">{fillTemplate(scenario.openingScript, vars)}</p>
          {scenario.tips.length ? (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted">{scenario.tips.map((t) => <li key={t}>{t}</li>)}</ul>
          ) : null}
        </div>
      </Section>

      {/* Honesty check on your own words */}
      <Section title="Check your own line" subtitle="Type something you're thinking of saying — I'll flag anything pushy or over-promised and suggest an honest version.">
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="e.g. I guarantee this will get you more customers" className={field} aria-label="Your line" />
        {draft.trim() ? (
          honesty.length ? (
            <div className="mt-2 space-y-2">
              {honesty.map((h) => (
                <div key={h.match} className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <p>⚠️ Careful with “{h.match}”. {h.why}</p>
                  <p className="mt-1 text-xs">Try instead: <span className="font-medium">{h.insteadTry}</span></p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">✅ That sounds honest and respectful.</p>
          )
        ) : null}
      </Section>

      {/* Follow-up generator */}
      <Section title="Follow-up message" subtitle="Pick a channel; your details fill in. Copy and send.">
        <select value={followId} onChange={(e) => setFollowId(e.target.value)} className={field} aria-label="Follow-up template">
          {FOLLOW_UPS.map((f) => <option key={f.id} value={f.id}>{f.title} ({f.channel})</option>)}
        </select>
        <div className={`mt-2 ${card}`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            {filledFollow.subject ? <span className="text-xs text-muted">Subject: {filledFollow.subject}</span> : <span />}
            <CopyButton text={(filledFollow.subject ? filledFollow.subject + "\n\n" : "") + filledFollow.body} />
          </div>
          <p className="whitespace-pre-wrap text-sm">{filledFollow.body}</p>
        </div>
      </Section>

      {/* Service packages reference */}
      <details className="mt-6 rounded-xl border border-ink/10">
        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">Service packages ({SERVICE_PACKAGES.length}) — honest starting points</summary>
        <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
          {SERVICE_PACKAGES.map((p) => (
            <div key={p.id} className="rounded-xl border border-ink/10 p-3 text-sm">
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-muted">{p.summary}</p>
              <ul className="mt-1 list-disc pl-4 text-xs">{p.includes.map((i) => <li key={i}>{i}</li>)}</ul>
              <p className="mt-1 text-[11px] italic text-muted">{p.startingNote}</p>
            </div>
          ))}
        </div>
      </details>

      <details className="mt-3 rounded-xl border border-ink/10">
        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">Honest phrases to lean on</summary>
        <ul className="list-disc px-6 pb-3 text-sm">{PREFER_PHRASES.map((p) => <li key={p}>{p}</li>)}</ul>
      </details>

      <RoleplayPanel scenarios={OUTREACH_ROLEPLAY} title="Practice the call" subtitle="Run through a mock call before you dial — pick a reply and see how it lands." />

      <ProposalBuilder vars={vars} />

      <OutreachTracker vars={vars} />
    </div>
  );
}

function ObjectionDetail({ objection, vars }: { objection: Objection; vars: CoachVars }) {
  const [style, setStyle] = useState<Style>(objection.replies[0].style);
  const reply = replyForObjection(objection, style, vars) ?? "";
  return (
    <div className={`mt-2 ${card}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <StyleChips available={availableStyles(objection.replies)} value={style} onChange={setStyle} />
        <CopyButton text={reply} />
      </div>
      <p className="text-sm">{reply}</p>
    </div>
  );
}

function OutreachTracker({ vars }: { vars: CoachVars }) {
  const [leads, setLeads] = useLocalState<OutreachLead[]>("outreach_leads", []);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draftFollowUp = (l: OutreachLead) => {
    const tpl = FOLLOW_UPS.find((f) => f.id === "text-after-call")!;
    const filled = fillFollowUp(tpl, { ...vars, BUSINESS_NAME: l.businessName, CONTACT_NAME: l.contact });
    setDrafts((prev) => ({ ...prev, [l.id]: filled.body }));
  };
  const add = () =>
    setLeads((prev) => [
      { id: newId(), businessName: vars.BUSINESS_NAME ?? "", businessType: vars.BUSINESS_TYPE ?? "", phone: "", website: "", contact: vars.CONTACT_NAME ?? "", dateCalled: new Date().toISOString().slice(0, 10), callResult: "", interest: "", followUpDate: "", notes: "", nextStep: "", status: "Called" },
      ...prev,
    ]);
  const update = (id: string, patch: Partial<OutreachLead>) => setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const remove = (id: string) => setLeads((prev) => prev.filter((l) => l.id !== id));

  return (
    <Section title="Outreach tracker" subtitle="A simple list of who you've contacted — saved on this device only.">
      <button type="button" onClick={add} className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream hover:opacity-90">+ Add the current business</button>
      <div className="mt-3 space-y-2">
        {leads.length === 0 ? <p className="text-sm text-muted">No calls logged yet.</p> : null}
        {leads.map((l) => (
          <div key={l.id} className={card}>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={l.businessName} onChange={(e) => update(l.id, { businessName: e.target.value })} placeholder="Business name" className={field} aria-label="Business name" />
              <input value={l.phone} onChange={(e) => update(l.id, { phone: e.target.value })} placeholder="Phone" className={field} aria-label="Phone" />
              <select value={l.status} onChange={(e) => update(l.id, { status: e.target.value as OutreachLead["status"] })} className={field} aria-label="Status">
                {OUTREACH_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input value={l.followUpDate} onChange={(e) => update(l.id, { followUpDate: e.target.value })} placeholder="Follow-up date" className={field} aria-label="Follow-up date" />
              <select value={l.interest} onChange={(e) => update(l.id, { interest: e.target.value as OutreachLead["interest"] })} className={field} aria-label="Interest level">
                <option value="">Interest level…</option>
                <option value="low">Low interest</option>
                <option value="medium">Medium interest</option>
                <option value="high">High interest</option>
              </select>
              <input value={l.nextStep} onChange={(e) => update(l.id, { nextStep: e.target.value })} placeholder="Next step" className={field} aria-label="Next step" />
            </div>
            <textarea value={l.notes} onChange={(e) => update(l.id, { notes: e.target.value })} rows={2} placeholder="Notes" className={`mt-2 ${field}`} aria-label="Notes" />
            {drafts[l.id] ? (
              <div className="mt-2 rounded-xl border border-ink/10 bg-cream/50 p-2">
                <div className="mb-1 flex justify-end"><CopyButton text={drafts[l.id]} /></div>
                <p className="whitespace-pre-wrap text-xs">{drafts[l.id]}</p>
              </div>
            ) : null}
            <div className="mt-1 flex justify-between">
              <button type="button" onClick={() => draftFollowUp(l)} className="text-xs text-accent underline underline-offset-2">Draft follow-up text</button>
              <button type="button" onClick={() => remove(l.id)} className="text-xs text-red-700">Remove</button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
