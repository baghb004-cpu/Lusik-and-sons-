// ============================================================
// Game Lab — preset mini-games (pure data)
// ============================================================
// Editable starter GameProjects, one per kind. Each is a real,
// schema-valid project (placeholder shapes only) the user can tweak,
// vibe-edit, and export. Baseline `settings` are what difficulty.ts
// scales. Kept small on purpose.
// ============================================================

import { gameProjectSchema, type GameProject, type EntityType, type Entity, type Rule } from "./schemas.ts";
import { objectDef } from "./objects.ts";

let seq = 0;
const E = (type: EntityType, x: number, y: number, over: Partial<Entity> = {}): Entity => {
  const d = objectDef(type);
  return {
    id: `${type}-${++seq}`,
    type,
    name: d?.label ?? type,
    x,
    y,
    w: d?.w ?? 32,
    h: d?.h ?? 32,
    color: d?.color ?? "#888888",
    props: { ...(d?.defaultProps ?? {}) },
    ...over,
  };
};
const R = (id: string, when: Rule["when"], then: Rule["then"], params: Rule["params"] = {}): Rule => ({ id, when, then, params });

interface PresetSpec {
  name: string;
  kind: GameProject["kind"];
  settings: GameProject["settings"];
  entities: Entity[];
  rules: Rule[];
  ui: Partial<GameProject["ui"]>;
}

const SPECS: PresetSpec[] = [
  {
    name: "Platformer",
    kind: "platformer",
    settings: { gravity: 980, playerSpeed: 200, jumpForce: 420, enemySpeed: 80, playerHealth: 3, scoreGoal: 10 },
    entities: [
      E("player", 80, 260), E("platform", 0, 340, { w: 640, h: 20 }), E("platform", 220, 250, { w: 120 }),
      E("coin", 250, 220), E("coin", 290, 220), E("spike", 360, 324), E("enemy", 480, 308), E("goal", 580, 276),
    ],
    rules: [R("coin-score", "touchCoin", "addScore", { points: 1 }), R("spike-damage", "touchSpike", "loseHealth", { amount: 1 }), R("enemy-damage", "touchEnemy", "loseHealth", { amount: 1 }), R("health-zero", "healthZero", "gameOver"), R("reach-goal", "touchGoal", "winLevel")],
    ui: { score: true, health: true, winScreen: true },
  },
  {
    name: "Top-Down Adventure",
    kind: "top-down",
    settings: { playerSpeed: 180, enemySpeed: 70, playerHealth: 3, scoreGoal: 5 },
    entities: [E("player", 320, 180), E("wall", 0, 0, { w: 640, h: 16 }), E("npc", 200, 120), E("key", 120, 280), E("door", 560, 160), E("coin", 420, 240), E("goal", 580, 280)],
    rules: [R("key-door", "touchKey", "unlockDoor"), R("coin-score", "touchCoin", "addScore", { points: 1 }), R("reach-goal", "touchGoal", "winLevel")],
    ui: { score: true, winScreen: true },
  },
  {
    name: "Endless Runner",
    kind: "endless-runner",
    settings: { playerSpeed: 260, jumpForce: 440, gravity: 1100, spawnRate: 1, scoreGoal: 30, playerHealth: 1 },
    entities: [E("player", 100, 280), E("platform", 0, 340, { w: 640, h: 20 }), E("spike", 700, 320)],
    rules: [R("spike-damage", "touchSpike", "gameOver"), R("level-music", "levelStart", "playMusic")],
    ui: { score: true, gameOverScreen: true },
  },
  {
    name: "Space Shooter",
    kind: "space-shooter",
    settings: { playerSpeed: 240, enemySpeed: 60, spawnRate: 1, playerHealth: 3, scoreGoal: 20 },
    entities: [E("player", 320, 320), E("enemy", 200, 40), E("enemy", 360, 40), E("projectile", 320, 300)],
    rules: [R("enemy-damage", "touchEnemy", "loseHealth", { amount: 1 }), R("health-zero", "healthZero", "gameOver"), R("score-win", "scoreReached", "showVictory")],
    ui: { score: true, health: true, winScreen: true, gameOverScreen: true },
  },
  {
    name: "Dodge the Objects",
    kind: "dodge",
    settings: { playerSpeed: 260, spawnRate: 1, timeLimit: 30, playerHealth: 3, scoreGoal: 0 },
    entities: [E("player", 320, 320), E("spike", 200, 0), E("spike", 440, 0)],
    rules: [R("spike-damage", "touchSpike", "loseHealth", { amount: 1 }), R("health-zero", "healthZero", "gameOver"), R("timer-win", "timerZero", "showVictory")],
    ui: { score: true, health: true, timer: true, winScreen: true, gameOverScreen: true },
  },
  {
    name: "Clicker",
    kind: "clicker",
    settings: { timeLimit: 20, scoreGoal: 25 },
    entities: [E("button", 300, 180, { w: 80, h: 80, name: "Tap target" })],
    rules: [R("click-score", "objectClicked", "addScore", { points: 1 }), R("score-win", "scoreReached", "showVictory")],
    ui: { score: true, timer: true, winScreen: true },
  },
  {
    name: "Quiz",
    kind: "quiz",
    settings: { scoreGoal: 3 },
    entities: [E("question", 80, 60, { name: "Question 1" }), E("question", 80, 200, { name: "Question 2" })],
    rules: [R("answer-score", "objectClicked", "addScore", { points: 1 }), R("score-win", "scoreReached", "showVictory")],
    ui: { score: true, winScreen: true },
  },
  {
    name: "Memory Cards",
    kind: "memory",
    settings: { timeLimit: 60, scoreGoal: 6 },
    entities: [E("card", 120, 100), E("card", 220, 100), E("card", 320, 100), E("card", 120, 220), E("card", 220, 220), E("card", 320, 220)],
    rules: [R("match-score", "objectClicked", "addScore", { points: 1 }), R("score-win", "scoreReached", "showVictory")],
    ui: { score: true, timer: true, winScreen: true },
  },
  {
    name: "Puzzle",
    kind: "puzzle",
    settings: { playerSpeed: 180 },
    entities: [E("player", 80, 280), E("button", 200, 320), E("door", 540, 240), E("wall", 360, 120, { h: 200 }), E("goal", 580, 280)],
    rules: [R("button-gate", "buttonPressed", "openGate"), R("reach-goal", "touchGoal", "winLevel")],
    ui: { winScreen: true },
  },
  {
    name: "Visual Novel",
    kind: "visual-novel",
    settings: {},
    entities: [E("npc", 420, 120, { name: "Storyteller" }), E("question", 80, 240, { name: "Your choice" })],
    rules: [R("level-music", "levelStart", "playMusic")],
    ui: { score: false, winScreen: false },
  },
];

/** Build a fresh, schema-valid GameProject for a kind (or null if unknown). */
export function makePreset(kind: GameProject["kind"], id = `game-${Date.now()}`): GameProject | null {
  const spec = SPECS.find((s) => s.kind === kind);
  if (!spec) return null;
  return gameProjectSchema.parse({
    id,
    name: spec.name,
    kind: spec.kind,
    style: "simple",
    difficulty: "normal",
    settings: { ...spec.settings },
    entities: spec.entities.map((e) => ({ ...e, props: { ...e.props } })),
    rules: spec.rules.map((r) => ({ ...r })),
    ui: spec.ui,
  });
}

export const PRESET_LIST = SPECS.map((s) => ({ kind: s.kind, name: s.name }));
