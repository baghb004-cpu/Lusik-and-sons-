// ============================================================
// Game Lab — data model (§29)
// ============================================================
// A small, beginner-friendly model: a GameProject is a kind + tunable
// settings + placed entities + beginner logic rules + UI flags. Kept
// deliberately simple so the code generator and the visual builder both
// read from one shape. Pure data, validated by zod.
// ============================================================

import { z } from "zod";

export const GAME_KINDS = [
  "platformer", "top-down", "endless-runner", "space-shooter", "dodge",
  "clicker", "quiz", "memory", "puzzle", "visual-novel",
] as const;
export const gameKindSchema = z.enum(GAME_KINDS);
export type GameKind = (typeof GAME_KINDS)[number];

export const DIFFICULTIES = ["easy", "normal", "hard", "custom"] as const;
export const difficultySchema = z.enum(DIFFICULTIES);
export type Difficulty = (typeof DIFFICULTIES)[number];

// The draggable object types. Visuals are placeholder shapes until the user
// imports their own assets — never copyrighted sprites.
export const ENTITY_TYPES = [
  "player", "enemy", "npc", "coin", "key", "door", "platform", "wall", "spike",
  "powerup", "health", "checkpoint", "goal", "movingPlatform", "projectile",
  "button", "background", "card", "question",
] as const;
export const entityTypeSchema = z.enum(ENTITY_TYPES);
export type EntityType = (typeof ENTITY_TYPES)[number];

export const entitySchema = z.object({
  id: z.string().min(1),
  type: entityTypeSchema,
  name: z.string().default(""),
  x: z.number().default(0),
  y: z.number().default(0),
  w: z.number().positive().default(32),
  h: z.number().positive().default(32),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#888888"),
  // free-form per-type tunables (speed, score value, etc.) — numbers/strings/bools
  props: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
});
export type Entity = z.infer<typeof entitySchema>;

// Beginner logic blocks: an Event triggers an Action.
export const EVENTS = [
  "touchCoin", "touchEnemy", "touchSpike", "touchGoal", "touchKey", "touchHealth",
  "healthZero", "timerZero", "scoreReached", "levelStart", "objectClicked", "buttonPressed",
] as const;
export const ACTIONS = [
  "addScore", "loseHealth", "gameOver", "winLevel", "unlockDoor", "openGate",
  "playMusic", "showVictory", "chasePlayer", "removeSelf", "nextLevel",
] as const;
export const eventSchema = z.enum(EVENTS);
export const actionSchema = z.enum(ACTIONS);
export type GameEvent = (typeof EVENTS)[number];
export type GameAction = (typeof ACTIONS)[number];

export const ruleSchema = z.object({
  id: z.string().min(1),
  when: eventSchema,
  then: actionSchema,
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
});
export type Rule = z.infer<typeof ruleSchema>;

export const uiSchema = z.object({
  score: z.boolean().default(true),
  health: z.boolean().default(false),
  timer: z.boolean().default(false),
  winScreen: z.boolean().default(true),
  gameOverScreen: z.boolean().default(true),
});

export const gameProjectSchema = z.object({
  schemaVersion: z.number().int().min(1).default(1),
  id: z.string().min(1),
  name: z.string().min(1).default("My Game"),
  kind: gameKindSchema,
  dimension: z.literal("2d").default("2d"),
  style: z.string().default("simple"),
  difficulty: difficultySchema.default("normal"),
  // tunables: gravity, playerSpeed, jumpForce, enemySpeed, scoreGoal, timeLimit,
  // playerHealth, spawnRate, … — a flat, codegen-friendly bag.
  settings: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
  entities: z.array(entitySchema).default([]),
  rules: z.array(ruleSchema).default([]),
  ui: uiSchema.default({ score: true, health: false, timer: false, winScreen: true, gameOverScreen: true }),
});
export type GameProject = z.infer<typeof gameProjectSchema>;

export const EXPORT_TARGETS = ["godot-project", "zip", "config-json", "template"] as const;
export const exportProfileSchema = z.object({
  target: z.enum(EXPORT_TARGETS).default("godot-project"),
  includeReadme: z.boolean().default(true),
});
export type ExportProfile = z.infer<typeof exportProfileSchema>;
