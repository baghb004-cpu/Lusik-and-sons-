"use client";

// Live Call Assist — type (or, optionally, speak) what they said and get an
// honest reply to adapt. Typing is the offline core; Microphone Assist is
// optional, consent-first, clearly indicated, and never records.

import { useEffect, useMemo, useState } from "react";
import { suggestReply, objectionById, replyForObjection } from "../engine.ts";
import { availableStyles } from "../styles.ts";
import { OUTREACH_SCRIPTS, MIC_DISCLOSURE, MIC_RULES } from "../index.ts";
import { fillTemplate } from "../variables.ts";
import type { Style } from "../schemas.ts";
import { useSpeechRecognition } from "./useSpeechRecognition.ts";
import { CopyButton, StyleChips, Section, card, field } from "./widgets.tsx";
import type { CoachVars } from "./storage.ts";

// Quick situation chips → the objection to jump to (or a special action).
const QUICK: Array<{ label: string; objectionId?: string; special?: "interested" | "end" }> = [
  { label: "They asked for pricing", objectionId: "how-much" },
  { label: "They already have a website", objectionId: "have-website" },
  { label: "They said send information", objectionId: "send-info" },
  { label: "They said call back later", objectionId: "call-back" },
  { label: "They are not interested", objectionId: "not-interested" },
  { label: "They sound interested", special: "interested" },
  { label: "End the call politely", special: "end" },
];

export function LiveCallAssist({ vars }: { vars: CoachVars }) {
  const speech = useSpeechRecognition();
  const [consented, setConsented] = useState(false);
  const [query, setQuery] = useState("");
  const [style, setStyle] = useState<Style>("friendly");
  const [pinned, setPinned] = useState<{ title: string; text: string } | null>(null);

  // When the mic produces final text, feed it to the matcher.
  useEffect(() => {
    if (speech.finalText) setQuery(speech.finalText);
  }, [speech.finalText]);

  const suggestion = useMemo(() => (query.trim() ? suggestReply(query, style, vars) : null), [query, style, vars]);

  const runQuick = (q: (typeof QUICK)[number]) => {
    setPinned(null);
    if (q.objectionId) {
      const obj = objectionById(q.objectionId);
      if (obj) {
        setQuery(obj.says);
        return;
      }
    }
    if (q.special === "end") {
      const end = OUTREACH_SCRIPTS.find((s) => s.id === "end-polite")!;
      setPinned({ title: "End politely", text: fillTemplate(end.body, vars) });
    } else if (q.special === "interested") {
      setPinned({
        title: "They sound interested",
        text: "That's great to hear. The next step is simple — what's the best email or number, and I'll send a couple of examples and a clear quote once I understand what you need. No pressure at all.",
      });
    }
  };

  return (
    <Section title="Live Call Assist" subtitle="During a call, type (or speak) what they said and get an honest reply to adapt.">
      {/* honesty / mechanism note */}
      <div className="rounded-xl border border-ink/10 bg-cream/60 p-3 text-xs text-muted">
        <p>{MIC_DISCLOSURE}</p>
      </div>

      {/* quick situation chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button key={q.label} type="button" onClick={() => runQuick(q)} className="min-h-8 rounded-full border border-ink/20 px-3 text-xs hover:bg-cream">{q.label}</button>
        ))}
      </div>

      {/* type what they said */}
      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-xs text-muted">Type what they said</span>
        <textarea value={query} onChange={(e) => setQuery(e.target.value)} rows={2} placeholder='e.g. "How much would something like that cost?"' className={field} aria-label="What they said" />
      </label>

      {/* microphone assist (optional) */}
      <div className="mt-3">
        {!speech.supported ? (
          <p className="text-xs text-muted">Microphone Assist isn't available in this browser — typing works fully offline.</p>
        ) : !speech.listening ? (
          <div className="rounded-xl border border-ink/10 p-3">
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-ink" />
              <span>
                I understand: it listens to nearby room audio (put the call on speakerphone), it does not connect to the call, audio is not saved, and on some browsers the built-in recognition may use an online service. I'll get permission where required.
              </span>
            </label>
            <button type="button" disabled={!consented} onClick={() => speech.start()} className="mt-2 rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream disabled:opacity-40">🎙 Use microphone</button>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-rose-300 bg-rose-50 p-3">
            <span className="flex items-center gap-2 text-sm font-medium text-rose-800"><span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-rose-600" aria-hidden /> Listening… (room audio)</span>
            <button type="button" onClick={() => speech.stop()} className="rounded-full border border-rose-300 px-3 py-1 text-xs text-rose-800">Stop listening</button>
          </div>
        )}
        {speech.listening && speech.interimText ? <p className="mt-1 text-xs italic text-muted">…{speech.interimText}</p> : null}
        {speech.error ? <p className="mt-1 text-xs text-amber-800">{speech.error}</p> : null}
      </div>

      {/* the suggestion */}
      <div className="mt-3">
        {pinned ? (
          <div className={card}>
            <div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs text-muted">{pinned.title}</span><CopyButton text={pinned.text} /></div>
            <p className="text-sm">{pinned.text}</p>
          </div>
        ) : suggestion?.objection ? (
          <div className={card}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs text-muted">Sounds like: <strong className="text-ink">“{suggestion.objection.says}”</strong></span>
              <CopyButton text={suggestion.reply ?? ""} />
            </div>
            <StyleChips available={availableStyles(suggestion.objection.replies)} value={style} onChange={setStyle} />
            <p className="mt-2 text-sm">{suggestion.reply}</p>
          </div>
        ) : query.trim() ? (
          <p className="text-sm text-muted">I'm not sure which objection that is — try a quick chip above, or rephrase.</p>
        ) : null}
      </div>

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-muted">How Microphone Assist handles privacy</summary>
        <ul className="mt-1 list-disc pl-5 text-muted">{MIC_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
      </details>
    </Section>
  );
}

/** Build a reply for a quick objection chip (kept for potential reuse/testing). */
export function quickReply(objectionId: string, style: Style, vars: CoachVars): string | null {
  const obj = objectionById(objectionId);
  return obj ? replyForObjection(obj, style, vars) : null;
}
