// ============================================================
// Game Lab — offline "vibe coding" intent parser (pure)
// ============================================================
// Plain-English → a GameProject, with NO cloud AI. A transparent
// matcher: safety-check first, detect the kind / objects / rules /
// difficulty, then BUILD a project from a preset or MODIFY the current
// one. Always returns human-readable `notes` explaining what it did.
// ============================================================

import type { GameKind, GameProject, Entity } from "./schemas.ts";
import { makePreset } from "./presets.ts";
import { objectDef } from "./objects.ts";
import { applyDifficulty } from "./difficulty.ts";
import { checkRequest, type SafetyResult } from "./safety.ts";

const KIND_KEYWORDS: Array<[GameKind, string[]]> = [
  ["platformer", ["platformer", "platform game", "jump game"]],
  ["endless-runner", ["endless runner", "runner", "auto-run", "auto run"]],
  ["space-shooter", ["space shooter", "shooter", "spaceship", "space ship", "shoot"]],
  ["dodge", ["dodge", "falling objects", "avoid objects", "dodge the", "fall from the sky"]],
  ["clicker", ["clicker", "tap game", "click game", "idle game"]],
  ["quiz", ["quiz", "trivia", "questions"]],
  ["memory", ["memory", "match cards", "memory card", "matching"]],
  ["puzzle", ["puzzle", "switches", "button puzzle"]],
  ["visual-novel", ["visual novel", "story game", "dialogue", "novel"]],
  ["top-down", ["top-down", "top down", "adventure", "maze", "restaurant"]],
];

const OBJECT_WORDS: Array<[Entity["type"], string[]]> = [
  ["coin", ["coin", "coins", "collect"]],
  ["spike", ["spike", "spikes"]],
  ["enemy", ["enemy", "enemies", "monster"]],
  ["key", ["key", "keys"]],
  ["door", ["door", "doors"]],
  ["goal", ["goal", "finish", "exit", "flag"]],
  ["platform", ["platform", "platforms"]],
  ["npc", ["npc", "customer", "character"]],
  ["health", ["health item", "heart"]],
];

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9 -]/g, " ").replace(/\s+/g, " ")} `;
const has = (hay: string, kw: string) => hay.includes(` ${kw} `) || hay.includes(`${kw} `) || hay.includes(` ${kw}`);

export function detectKind(text: string): GameKind | null {
  const hay = norm(text);
  for (const [kind, words] of KIND_KEYWORDS) for (const w of words) if (has(hay, w)) return kind;
  return null;
}

export interface VibeResult {
  ok: boolean;
  project?: GameProject;
  notes: string[];
  safety?: SafetyResult;
}

let entSeq = 0;
function addEntity(project: GameProject, type: Entity["type"], notes: string[]) {
  if (project.entities.some((e) => e.type === type)) return;
  const d = objectDef(type);
  if (!d) return;
  project.entities.push({ id: `${type}-v${++entSeq}`, type, name: d.label, x: 120 + project.entities.length * 30, y: 200, w: d.w, h: d.h, color: d.color, props: { ...(d.defaultProps ?? {}) } });
  notes.push(`Added ${d.label.toLowerCase()}.`);
}

const numS = (v: unknown, d: number) => (typeof v === "number" ? v : d);

/** Parse a request. With `current`, a tweak modifies it; otherwise build new. */
export function vibe(text: string, current?: GameProject): VibeResult {
  const safety = checkRequest(text);
  if (!safety.ok) return { ok: false, notes: [safety.reason ?? "Let's keep it original.", safety.suggestion ?? ""].filter(Boolean), safety };

  const hay = norm(text);
  const kind = detectKind(text);
  const wantsNew = /\bmake (a|an|me)\b/.test(hay) || (!current && !!kind);

  const notes: string[] = [];
  let project: GameProject;

  if (wantsNew || !current) {
    const k = kind ?? "platformer";
    project = makePreset(k, current?.id ?? `game-${Date.now()}`)!;
    notes.push(kind ? `Started a ${k.replace("-", " ")} game.` : `Couldn't tell the game type, so I started a platformer — change it anytime.`);
    // add any explicitly requested objects on top of the preset
    for (const [type, words] of OBJECT_WORDS) if (words.some((w) => has(hay, w))) addEntity(project, type, notes);
  } else {
    project = { ...current, entities: current.entities.map((e) => ({ ...e })), rules: current.rules.map((r) => ({ ...r })), settings: { ...current.settings } };
    for (const [type, words] of OBJECT_WORDS) if (words.some((w) => has(hay, w))) addEntity(project, type, notes);
  }

  // difficulty words
  if (has(hay, "easier") || has(hay, "easy")) { project = applyDifficulty(project, "easy"); notes.push("Made it easier."); }
  if (has(hay, "harder") || has(hay, "hard")) { project = applyDifficulty(project, "hard"); notes.push("Made it harder."); }

  // targeted tweaks
  if (has(hay, "slower")) { project.settings.enemySpeed = Math.max(1, Math.round(numS(project.settings.enemySpeed, 80) * 0.7)); notes.push("Slowed the enemies down."); }
  if (has(hay, "faster")) { project.settings.enemySpeed = Math.round(numS(project.settings.enemySpeed, 80) * 1.3); notes.push("Sped the enemies up."); }
  if (has(hay, "jump higher") || has(hay, "higher jump")) { project.settings.jumpForce = Math.round(numS(project.settings.jumpForce, 420) * 1.2); notes.push("Raised the player's jump."); }
  if (has(hay, "health bar") || has(hay, "health")) { project.ui = { ...project.ui, health: true }; if (project.settings.playerHealth === undefined) project.settings.playerHealth = 3; notes.push("Added a health bar."); }
  if (has(hay, "win screen") || has(hay, "victory")) { project.ui = { ...project.ui, winScreen: true }; notes.push("Added a win screen."); }
  if (has(hay, "background music") || has(hay, "music")) { if (!project.rules.some((r) => r.then === "playMusic")) project.rules.push({ id: `music-v${++entSeq}`, when: "levelStart", then: "playMusic", params: {} }); notes.push("Added background music on start (drop your own track in /audio)."); }
  if (has(hay, "second level") || has(hay, "another level") || has(hay, "more levels")) { project.settings.levels = numS(project.settings.levels, 1) + 1; notes.push("Noted a second level — v1 generates one level; this flags it for you to extend."); }

  // collect-N detection ("collects 10 coins")
  const m = /collects? (\d{1,3})/.exec(hay) || /(\d{1,3}) coins/.exec(hay);
  if (m) { project.settings.scoreGoal = Number(m[1]); notes.push(`Set the score goal to ${m[1]}.`); }

  if (notes.length === 0) notes.push("I didn't catch a specific change — try naming a game type, an object (coin, spike, enemy), or a tweak (easier, jump higher).");
  return { ok: true, project, notes };
}
