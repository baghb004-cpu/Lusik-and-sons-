// ============================================================
// Game Lab — beginner logic blocks (pure data)
// ============================================================
// The "When … → …" rules a beginner snaps together. Each maps a
// GameEvent to a GameAction with a human label. The code generator
// turns these into commented GDScript.
// ============================================================

import type { GameEvent, GameAction } from "./schemas.ts";

export interface LogicBlock {
  id: string;
  when: GameEvent;
  then: GameAction;
  label: string;
}

export const LOGIC_BLOCKS: LogicBlock[] = [
  { id: "coin-score", when: "touchCoin", then: "addScore", label: "When player touches a coin → add score" },
  { id: "enemy-damage", when: "touchEnemy", then: "loseHealth", label: "When player touches an enemy → lose health" },
  { id: "spike-damage", when: "touchSpike", then: "loseHealth", label: "When player touches a spike → lose health" },
  { id: "health-zero", when: "healthZero", then: "gameOver", label: "When health reaches zero → game over" },
  { id: "reach-goal", when: "touchGoal", then: "winLevel", label: "When player reaches the goal → win the level" },
  { id: "timer-out", when: "timerZero", then: "gameOver", label: "When the timer reaches zero → game over" },
  { id: "key-door", when: "touchKey", then: "unlockDoor", label: "When the key is collected → unlock the door" },
  { id: "button-gate", when: "buttonPressed", then: "openGate", label: "When a button is pressed → open the gate" },
  { id: "enemy-chase", when: "levelStart", then: "chasePlayer", label: "When the level starts → enemies chase the player" },
  { id: "click-action", when: "objectClicked", then: "addScore", label: "When an object is clicked → add points" },
  { id: "start-music", when: "levelStart", then: "playMusic", label: "When the level starts → play music" },
  { id: "score-win", when: "scoreReached", then: "showVictory", label: "When score reaches the goal → show victory" },
  { id: "health-pickup", when: "touchHealth", then: "loseHealth", label: "When player touches a health item → restore health" },
];

const byId = new Map(LOGIC_BLOCKS.map((b) => [b.id, b]));
export function logicBlock(id: string): LogicBlock | undefined {
  return byId.get(id);
}
