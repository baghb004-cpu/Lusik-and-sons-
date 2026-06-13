"use client";

// Reusable practice-roleplay panel (used by both coaches). Pick a persona,
// step through the conversation, and get an encouraging, honest reflection.

import { useMemo, useState } from "react";
import { takeChoice, reflect, nodeById, type RoleplayTurn } from "../roleplay.ts";
import type { RoleplayScenario } from "../schemas.ts";
import { Section, card, field } from "./widgets.tsx";

export function RoleplayPanel({ scenarios, title, subtitle }: { scenarios: RoleplayScenario[]; title: string; subtitle?: string }) {
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];
  const [nodeId, setNodeId] = useState<string | null>(scenario.startId);
  const [turns, setTurns] = useState<RoleplayTurn[]>([]);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const node = nodeId ? nodeById(scenario, nodeId) : null;
  const done = nodeId === null;
  const summary = useMemo(() => (done ? reflect(turns) : null), [done, turns]);

  const restart = (id = scenario.id) => {
    const sc = scenarios.find((s) => s.id === id) ?? scenario;
    setScenarioId(id);
    setNodeId(sc.startId);
    setTurns([]);
    setLastFeedback(null);
  };
  const choose = (i: number) => {
    if (!nodeId) return;
    const step = takeChoice(scenario, nodeId, i);
    if (!step) return;
    setTurns((prev) => [...prev, step.turn]);
    setLastFeedback(step.turn.feedback);
    setNodeId(step.nextId);
  };

  return (
    <Section title={title} subtitle={subtitle}>
      {scenarios.length > 1 ? (
        <select value={scenarioId} onChange={(e) => restart(e.target.value)} className={`mb-2 ${field}`} aria-label="Roleplay scenario">
          {scenarios.map((s) => <option key={s.id} value={s.id}>{s.title}{s.difficulty === "confident" ? " (tougher)" : ""}</option>)}
        </select>
      ) : null}
      <div className={card}>
        {node ? (
          <>
            <p className="text-xs text-muted">{node.persona} says:</p>
            <p className="mt-0.5 text-sm font-medium">“{node.prompt}”</p>
            <div className="mt-3 space-y-1.5">
              {node.choices.map((c, i) => (
                <button key={i} type="button" onClick={() => choose(i)} className="block w-full rounded-xl border border-ink/20 px-3 py-2 text-left text-sm hover:bg-cream">{c.label}</button>
              ))}
            </div>
            {lastFeedback ? <p className="mt-2 text-xs text-muted">Last reply: {lastFeedback}</p> : null}
          </>
        ) : summary ? (
          <div>
            <p className="text-sm font-medium">Nice work — you finished the practice.</p>
            <p className="mt-1 text-sm">Score: <strong>{summary.percent}%</strong> ({summary.grade}).</p>
            {summary.best ? <p className="mt-1 text-xs text-muted">Strongest: “{summary.best.choiceLabel}” — {summary.best.feedback}</p> : null}
            {summary.improve && summary.improve.score < 3 ? <p className="mt-1 text-xs text-muted">To improve: “{summary.improve.choiceLabel}” — {summary.improve.feedback}</p> : null}
            <button type="button" onClick={() => restart()} className="mt-3 rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream hover:opacity-90">Practice again</button>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
