// ============================================================
// Game Lab — draggable object catalog (pure data)
// ============================================================
// The palette the user drags onto a scene. Each carries a friendly
// label, a default size, and a placeholder COLOR/shape (license-safe —
// never a copyrighted sprite). Real art is whatever the user imports.
// ============================================================

import type { EntityType } from "./schemas.ts";

export interface ObjectDef {
  type: EntityType;
  label: string;
  color: string; // placeholder fill
  w: number;
  h: number;
  blurb: string;
  defaultProps?: Record<string, number | string | boolean>;
}

export const OBJECT_CATALOG: ObjectDef[] = [
  { type: "player", label: "Player", color: "#3b82f6", w: 32, h: 48, blurb: "The character you control.", defaultProps: { speed: 200, jump: 420 } },
  { type: "enemy", label: "Enemy", color: "#ef4444", w: 32, h: 32, blurb: "Hurts the player on touch.", defaultProps: { speed: 80, damage: 1 } },
  { type: "npc", label: "NPC", color: "#a855f7", w: 32, h: 48, blurb: "A friendly character to talk to.", defaultProps: {} },
  { type: "coin", label: "Coin", color: "#facc15", w: 20, h: 20, blurb: "Collect for points.", defaultProps: { score: 1 } },
  { type: "key", label: "Key", color: "#eab308", w: 20, h: 20, blurb: "Unlocks a door.", defaultProps: {} },
  { type: "door", label: "Door", color: "#92400e", w: 32, h: 48, blurb: "Opens when you have the key.", defaultProps: { locked: true } },
  { type: "platform", label: "Platform", color: "#65a30d", w: 96, h: 16, blurb: "Stand or jump on it.", defaultProps: {} },
  { type: "wall", label: "Wall", color: "#6b7280", w: 32, h: 96, blurb: "Blocks movement.", defaultProps: {} },
  { type: "spike", label: "Spike", color: "#dc2626", w: 32, h: 16, blurb: "Hurts on touch.", defaultProps: { damage: 1 } },
  { type: "powerup", label: "Power-up", color: "#22d3ee", w: 24, h: 24, blurb: "A helpful boost.", defaultProps: {} },
  { type: "health", label: "Health item", color: "#16a34a", w: 24, h: 24, blurb: "Restores health.", defaultProps: { heal: 1 } },
  { type: "checkpoint", label: "Checkpoint", color: "#0ea5e9", w: 24, h: 48, blurb: "Save progress point.", defaultProps: {} },
  { type: "goal", label: "Goal", color: "#10b981", w: 40, h: 64, blurb: "Reach it to win the level.", defaultProps: {} },
  { type: "movingPlatform", label: "Moving platform", color: "#84cc16", w: 96, h: 16, blurb: "Carries the player.", defaultProps: { range: 120, speed: 60 } },
  { type: "projectile", label: "Projectile", color: "#f97316", w: 12, h: 12, blurb: "Fired by the player or enemy.", defaultProps: { speed: 400 } },
  { type: "button", label: "Button", color: "#e879f9", w: 32, h: 16, blurb: "Press to trigger something.", defaultProps: {} },
  { type: "background", label: "Background", color: "#1f2937", w: 640, h: 360, blurb: "Backdrop behind the scene.", defaultProps: {} },
  { type: "card", label: "Card", color: "#64748b", w: 64, h: 88, blurb: "A memory-match card.", defaultProps: {} },
  { type: "question", label: "Question", color: "#7c3aed", w: 480, h: 120, blurb: "A quiz question.", defaultProps: {} },
];

const byType = new Map(OBJECT_CATALOG.map((o) => [o.type, o]));
export function objectDef(type: EntityType): ObjectDef | undefined {
  return byType.get(type);
}
