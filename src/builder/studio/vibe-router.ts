// ============================================================
// Creation Studio — cross-mode vibe router (pure, §30 Phase 9)
// ============================================================
// One plain-English box → the right mode. A transparent keyword
// scorer (no cloud AI) boosted by the per-mode detectors we already
// ship. When confident it routes (and pre-seeds the vibe-capable
// builders); when unsure it returns guided choices instead of failing.
// ============================================================

import { detectKind } from "./../gamelab/vibe.ts";
import { detectScrollKind } from "./immersive/vibe.ts";

export interface ModeRoute {
  mode: string;
  label: string;
  route: string;
  seedable: boolean; // true = the builder can auto-run this prompt on open
  keywords: string[];
}

export const MODE_ROUTES: ModeRoute[] = [
  { mode: "game-lab", label: "Game Lab", route: "/tools/game-lab", seedable: true, keywords: ["game", "platformer", "runner", "shooter", "dodge", "clicker", "quiz", "memory", "puzzle", "maze", "tower defense", "rpg", "arcade", "mini game", "play"] },
  { mode: "immersive", label: "Immersive Builder", route: "/tools/immersive", seedable: true, keywords: ["3d", "scroll", "cinematic", "immersive", "parallax", "product reveal", "scroll experience", "floating", "reveal as", "appears as", "showroom", "brand story", "scroll animation"] },
  { mode: "store", label: "Store Manager", route: "/tools/store", seedable: false, keywords: ["customer", "inventory", "barcode", "purchase history", "crm", "stock", "low stock", "orders", "point of sale", "pos", "product catalog", "business software", "store software", "loyalty"] },
  { mode: "photo-booth", label: "Photo Booth Builder", route: "/tools/photo-booth", seedable: false, keywords: ["photo booth", "booth", "selfie", "photo strip", "countdown", "event camera", "4-photo", "3-photo", "collage"] },
  { mode: "sensors", label: "Sensor Builder", route: "/tools/sensors", seedable: false, keywords: ["tilt", "shake", "gyroscope", "gyro", "accelerometer", "motion control", "device motion"] },
  { mode: "coach", label: "Communication Coach", route: "/tools/coach", seedable: false, keywords: ["interview", "cold call", "outreach", "objection", "pitch", "what to say", "phone script", "sales call"] },
  { mode: "builder", label: "Website & App Builder", route: "/builder", seedable: false, keywords: ["website", "landing page", "web page", "mobile app", "homepage", "site"] },
];

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9 -]/g, " ").replace(/\s+/g, " ")} `;
const hit = (h: string, k: string) => (k.includes(" ") ? h.includes(` ${k} `) || h.includes(`${k} `) || h.includes(` ${k}`) : h.includes(` ${k} `));

export interface RouteScore {
  mode: string;
  label: string;
  route: string;
  seedable: boolean;
  score: number;
}
export interface VibeRoute {
  best: RouteScore | null; // null = unsure → show choices
  confident: boolean;
  choices: RouteScore[]; // ranked alternatives (for guided pick)
}

/** Score the request across modes and pick the best (or offer choices). */
export function routeVibe(text: string): VibeRoute {
  const h = norm(text);
  // Strong signals from the per-mode parsers (count as 2 keyword hits).
  const gameBoost = detectKind(text) ? 2 : 0;
  const scrollBoost = h.includes(" 3d ") || detectScrollKind(text) ? 0 : 0; // scroll handled via keywords below

  const scored: RouteScore[] = MODE_ROUTES.map((m) => {
    let score = m.keywords.reduce((s, k) => s + (hit(h, k) ? 1 : 0), 0);
    if (m.mode === "game-lab") score += gameBoost;
    if (m.mode === "immersive") score += scrollBoost;
    // "builder" is the generic fallback — only let it win when nothing specific did.
    if (m.mode === "builder") score = Math.min(score, 1);
    return { mode: m.mode, label: m.label, route: m.route, seedable: m.seedable, score };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  const second = scored[1];
  const choices = scored.filter((s) => s.score > 0).slice(0, 5);

  if (!top || top.score === 0) return { best: null, confident: false, choices: scored.map((s) => ({ ...s, score: 0 })) };
  // Confident when the leader is clearly ahead (and not the generic fallback alone).
  const confident = top.score >= 2 || (top.score >= 1 && (!second || top.score - second.score >= 1));
  return { best: top, confident, choices };
}
