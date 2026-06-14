// ============================================================
// Communication Coach — honesty guardrail (pure)
// ============================================================
// This module is the reason the feature can't be turned into a
// pressure/scam tool: it scans a line the USER drafted and flags
// over-promising, pushy, or dishonest phrasing, suggesting an
// honest rewrite. It coaches AWAY from manipulation. Pure + local.
// ============================================================

import type { PhraseGuard } from "./schemas.ts";

// Substrings (lowercased) that signal a promise we can't keep or a pushy /
// dishonest line — each paired with WHY and an honest thing to say instead.
export const PHRASE_GUARDS: PhraseGuard[] = [
  { match: "guarantee", why: "You can't honestly guarantee results like customers or rankings.", insteadTry: "I can help build a clean, modern site — I can't promise specific results, but I'll do solid work." },
  { match: "more customers", why: "Promising more customers is an over-promise.", insteadTry: "A clearer, faster, mobile-friendly site can help customers find and contact you more easily." },
  { match: "number one on google", why: "No one can honestly promise a #1 ranking, let alone instantly.", insteadTry: "I can set up the basics of SEO so your site is easier to find — rankings take time and aren't guaranteed." },
  { match: "rank you first", why: "Guaranteed rankings are an over-promise.", insteadTry: "I can cover SEO basics; search rankings depend on many things and take time." },
  { match: "make you rich", why: "That's a false promise.", insteadTry: "I can help your business look more professional online." },
  { match: "terrible", why: "Insulting their current site is disrespectful and pushy.", insteadTry: "I noticed a few things that could be modernized — happy to show you." },
  { match: "your website is bad", why: "Insulting their site is disrespectful.", insteadTry: "There are a couple of easy improvements I could help with." },
  { match: "you need this", why: "Telling someone they 'need' it is pushy.", insteadTry: "This might help — no pressure at all." },
  { match: "you have to", why: "Pressure language.", insteadTry: "If it's useful to you, I'd be glad to help — totally your call." },
  { match: "decide today", why: "Creating false urgency is manipulative.", insteadTry: "Take all the time you need — there's no rush." },
  { match: "act now", why: "False urgency.", insteadTry: "Whenever you're ready is fine." },
  { match: "everyone else is doing it", why: "Pressure by comparison.", insteadTry: "I'd just focus on what would actually help your business." },
  { match: "limited time", why: "False-urgency sales pressure.", insteadTry: "No deadline from me — reach out whenever it suits you." },
  { match: "best in the world", why: "Unverifiable boast.", insteadTry: "I do careful, honest work and can show you examples." },
];

export interface GuardHit {
  match: string;
  why: string;
  insteadTry: string;
}

/** Flag any over-promise / pushy / dishonest phrasing in the user's draft. */
export function checkHonesty(draft: string, guards: PhraseGuard[] = PHRASE_GUARDS): GuardHit[] {
  const hay = draft.toLowerCase();
  return guards.filter((g) => hay.includes(g.match)).map((g) => ({ match: g.match, why: g.why, insteadTry: g.insteadTry }));
}

/** True when the draft has no honesty problems. */
export function isHonest(draft: string, guards: PhraseGuard[] = PHRASE_GUARDS): boolean {
  return checkHonesty(draft, guards).length === 0;
}
