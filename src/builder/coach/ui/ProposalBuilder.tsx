"use client";

// Proposal builder — pick packages, add a short note, get an honest proposal
// (no fixed/guaranteed prices) filled with your details. Copy and send.

import { useMemo, useState } from "react";
import { SERVICE_PACKAGES } from "../index.ts";
import { buildProposal } from "../proposal.ts";
import { Section, card, field, CopyButton } from "./widgets.tsx";
import type { CoachVars } from "./storage.ts";

export function ProposalBuilder({ vars }: { vars: CoachVars }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [intro, setIntro] = useState("");
  const proposal = useMemo(() => buildProposal(selected, vars, { intro }), [selected, vars, intro]);

  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Section title="Proposal builder" subtitle="Tick what you'd offer, add a short note, and copy a clean proposal — honest 'starting' language, no guaranteed prices.">
      <div className="grid gap-1.5 sm:grid-cols-2">
        {SERVICE_PACKAGES.map((p) => (
          <label key={p.id} className="flex items-start gap-2 rounded-xl border border-ink/15 p-2 text-sm">
            <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} className="mt-0.5 h-3.5 w-3.5 accent-ink" />
            <span><span className="font-medium">{p.name}</span><span className="block text-xs text-muted">{p.summary}</span></span>
          </label>
        ))}
      </div>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-xs text-muted">Optional note (what you noticed or discussed)</span>
        <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={2} placeholder="e.g. Thanks for the call — here's a quick summary of what I can help with." className={field} aria-label="Proposal note" />
      </label>
      <div className={`mt-3 ${card}`}>
        <div className="mb-2 flex justify-end"><CopyButton text={proposal} /></div>
        <pre className="whitespace-pre-wrap font-body text-sm">{proposal}</pre>
      </div>
    </Section>
  );
}
