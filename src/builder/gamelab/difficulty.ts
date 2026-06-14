// ============================================================
// Game Lab — difficulty tuning (pure)
// ============================================================
// Easy / Normal / Hard scale the same tunables (enemy speed, player
// health, timer, spawn rate, score goal). "custom" leaves settings
// alone. Applied to a GameProject's settings without mutating input.
// ============================================================

import type { Difficulty, GameProject } from "./schemas.ts";

interface Tuning {
  enemySpeed: number;
  playerHealth: number;
  timeLimit: number;
  spawnRate: number; // higher = more obstacles
  scoreGoal: number;
}

// Multipliers relative to a preset's baseline.
const TUNING: Record<Exclude<Difficulty, "custom">, Tuning> = {
  easy: { enemySpeed: 0.7, playerHealth: 1.5, timeLimit: 1.4, spawnRate: 0.7, scoreGoal: 0.7 },
  normal: { enemySpeed: 1, playerHealth: 1, timeLimit: 1, spawnRate: 1, scoreGoal: 1 },
  hard: { enemySpeed: 1.4, playerHealth: 0.7, timeLimit: 0.75, spawnRate: 1.4, scoreGoal: 1.3 },
};

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const round = (n: number) => Math.max(1, Math.round(n));

/** Return a copy of the project with settings scaled to a difficulty. */
export function applyDifficulty(project: GameProject, difficulty: Difficulty, base?: GameProject["settings"]): GameProject {
  if (difficulty === "custom") return { ...project, difficulty };
  const t = TUNING[difficulty];
  const s = base ?? project.settings;
  const settings = { ...project.settings };
  if (s.enemySpeed !== undefined) settings.enemySpeed = round(num(s.enemySpeed, 80) * t.enemySpeed);
  if (s.playerHealth !== undefined) settings.playerHealth = round(num(s.playerHealth, 3) * t.playerHealth);
  if (s.timeLimit !== undefined) settings.timeLimit = round(num(s.timeLimit, 60) * t.timeLimit);
  if (s.spawnRate !== undefined) settings.spawnRate = Math.max(0.2, Math.round(num(s.spawnRate, 1) * t.spawnRate * 100) / 100);
  if (s.scoreGoal !== undefined) settings.scoreGoal = round(num(s.scoreGoal, 10) * t.scoreGoal);
  return { ...project, difficulty, settings };
}
