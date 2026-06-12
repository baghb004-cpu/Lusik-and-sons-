// ============================================================
// Game Mode — quests & XP (pure, plan §23)
// ============================================================
// The playful layer's progress system. Quests are REAL builder
// actions (the engine confirms them through its own APIs); XP is
// just a number on the local profile. Nothing here gates any
// feature — finishing quests is encouragement, not permission.
// ============================================================

import type { Profile } from "./schemas.ts";

export interface Quest {
  id: string;
  title: string;
  hint: string;
  xp: number;
  station: "website" | "mobile" | "export" | "room";
}

export const QUESTS: Quest[] = [
  { id: "open-first-page", title: "Open your first page", hint: "Pick a document in the Workshop — or start one from a template.", xp: 10, station: "website" },
  { id: "edit-a-block", title: "Change something", hint: "Click any block and edit it with the form on the right.", xp: 15, station: "website" },
  { id: "upload-a-photo", title: "Hang a photo", hint: "Drag a picture into the 🖼 Media panel.", xp: 15, station: "website" },
  { id: "translate-something", title: "Say it in another language", hint: "Use the ✏️ selector to translate any text field.", xp: 20, station: "website" },
  { id: "run-an-audit", title: "Run the inspection", hint: "The Audit panel checks structure, layout, readability and translations.", xp: 15, station: "website" },
  { id: "try-a-preset", title: "Shrink the screen", hint: "Preview your page on a compact phone in ▢ Screens.", xp: 15, station: "mobile" },
  { id: "polish-mobile", title: "Mobile-only polish", hint: "Switch the device toggle to mobile and adjust spacing — desktop won't change.", xp: 20, station: "mobile" },
  { id: "export-static", title: "Ship a website", hint: "Export the static site — a complete folder you can host anywhere.", xp: 30, station: "export" },
  { id: "export-pwa", title: "Make it installable", hint: "The PWA export adds the manifest + offline support.", xp: 30, station: "export" },
  { id: "visit-the-room", title: "Take a break", hint: "Step into the Retro Game Room (when the owner has switched it on).", xp: 10, station: "room" },
];

export const LEVELS = [0, 50, 120, 220, 360, 550]; // xp thresholds

export function levelFor(xp: number): number {
  let level = 1;
  for (let i = 1; i < LEVELS.length; i++) if (xp >= LEVELS[i]) level = i + 1;
  return level;
}

/** Award a quest once; repeat calls are no-ops (returns the same profile). */
export function awardQuest(profile: Profile, questId: string, now = Date.now()): Profile {
  const quest = QUESTS.find((q) => q.id === questId);
  if (!quest || profile.quests[questId]) return profile;
  return {
    ...profile,
    xp: profile.xp + quest.xp,
    quests: { ...profile.quests, [questId]: now },
  };
}
