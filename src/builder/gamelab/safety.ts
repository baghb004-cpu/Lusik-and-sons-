// ============================================================
// Game Lab — originality + safety guardrail (pure)
// ============================================================
// Keeps generated games ORIGINAL and user-owned: refuses requests that
// name a copyrighted franchise/character/world, or that ask for
// anything harmful (malware, cheats, miners). It nudges toward an
// original version instead of refusing flatly. Runs before the vibe
// parser builds anything.
// ============================================================

// Franchise / character / world names we won't clone or reference by name.
const FRANCHISES = [
  "mario", "luigi", "bowser", "peach", "yoshi", "zelda", "link", "ganon", "hyrule",
  "pokemon", "pikachu", "charizard", "sonic", "tails", "minecraft", "creeper",
  "fortnite", "roblox", "call of duty", "gta", "grand theft auto", "halo",
  "pac-man", "pacman", "donkey kong", "kirby", "metroid", "samus", "fifa",
  "street fighter", "mortal kombat", "tetris", "among us", "fall guys",
  "spider-man", "spiderman", "batman", "disney", "marvel", "star wars",
];

const HARMFUL = [
  "malware", "virus", "ransomware", "keylogger", "crypto miner", "cryptominer",
  "steal password", "phishing", "ddos", "botnet", "cheat engine", "aimbot", "wallhack",
];

export interface SafetyResult {
  ok: boolean;
  reason?: string;
  suggestion?: string;
  flagged?: string;
}

/** Check a vibe request. ok:false means refuse (with a friendly redirect). */
export function checkRequest(text: string): SafetyResult {
  const hay = ` ${text.toLowerCase().replace(/[^a-z0-9 -]/g, " ").replace(/\s+/g, " ")} `;
  for (const h of HARMFUL) {
    if (hay.includes(` ${h} `) || hay.includes(h)) {
      return { ok: false, flagged: h, reason: "Game Lab only makes ordinary, safe games.", suggestion: "Try describing a normal mini-game instead — like a platformer or a dodge game." };
    }
  }
  for (const f of FRANCHISES) {
    if (hay.includes(` ${f} `) || hay.includes(`${f} `) || hay.includes(` ${f}`)) {
      return {
        ok: false,
        flagged: f,
        reason: `To keep your game yours, Game Lab doesn't copy "${f}" or other existing games.`,
        suggestion: "Describe your OWN version — e.g. \"a platformer where a little robot collects bolts and avoids saw blades.\" You'll own everything you make.",
      };
    }
  }
  return { ok: true };
}
