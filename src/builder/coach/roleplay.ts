// ============================================================
// Communication Coach — roleplay stepping + scoring (pure)
// ============================================================
// A plain id→node walk over a RoleplayScenario: show a prompt,
// take a choice, accrue a score with per-choice feedback, and at
// the end produce a simple reflection (a percentage + the strongest
// and weakest moments). No branching-tree engine beyond a lookup.
// ============================================================

import type { RoleplayScenario, RoleplayNode } from "./schemas.ts";

export function nodeById(scenario: RoleplayScenario, id: string): RoleplayNode | null {
  return scenario.nodes.find((n) => n.id === id) ?? null;
}

export interface RoleplayTurn {
  nodeId: string;
  prompt: string;
  choiceLabel: string;
  feedback: string;
  score: number; // 0..3
}

/** Apply a choice (by index) at a node; returns the turn + the next node id. */
export function takeChoice(scenario: RoleplayScenario, nodeId: string, choiceIndex: number): { turn: RoleplayTurn; nextId: string | null } | null {
  const node = nodeById(scenario, nodeId);
  if (!node) return null;
  const choice = node.choices[choiceIndex];
  if (!choice) return null;
  return {
    turn: { nodeId, prompt: node.prompt, choiceLabel: choice.label, feedback: choice.feedback, score: choice.score },
    nextId: choice.nextId ?? null,
  };
}

export interface Reflection {
  turns: number;
  points: number;
  maxPoints: number;
  percent: number; // 0..100
  grade: "keep practicing" | "good" | "strong";
  best?: RoleplayTurn;
  improve?: RoleplayTurn;
}

/** Summarize a completed run into an encouraging, honest reflection. */
export function reflect(turns: RoleplayTurn[]): Reflection {
  const points = turns.reduce((s, t) => s + t.score, 0);
  const maxPoints = turns.length * 3;
  const percent = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;
  const grade = percent >= 80 ? "strong" : percent >= 55 ? "good" : "keep practicing";
  const sorted = [...turns].sort((a, b) => b.score - a.score);
  return {
    turns: turns.length,
    points,
    maxPoints,
    percent,
    grade,
    best: sorted[0],
    improve: turns.length > 0 ? sorted[sorted.length - 1] : undefined,
  };
}
