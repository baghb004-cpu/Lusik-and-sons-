// ============================================================
// Communication Coach — offline phrase / intent matching (pure)
// ============================================================
// "Type what they said" → the most likely objection/intent. A
// transparent keyword scorer (no ML, no network): tokenize the
// input, score each intent by how many of its keywords appear,
// return the best match with a confidence, or null when unsure
// (the UI then shows the common objections to pick from).
// ============================================================

export interface Intent {
  id: string; // matches an Objection id
  keywords: string[]; // lowercase words/phrases that signal this intent
}

// Keyword table for the built-in outreach objections. Phrases (with spaces)
// are matched as substrings; single words match as whole tokens.
export const OUTREACH_INTENTS: Intent[] = [
  { id: "have-website", keywords: ["already have a website", "have a website", "got a site", "we have a site", "our website"] },
  { id: "have-someone", keywords: ["already have someone", "have a guy", "got a guy", "guy who handles", "handles it", "we have a guy", "someone handles", "someone who does", "our own person", "in house", "in-house"] },
  { id: "not-interested", keywords: ["not interested", "no thanks", "we're good", "were good", "all set", "not right now"] },
  { id: "how-much", keywords: ["how much", "what's the cost", "whats the cost", "price", "pricing", "cost", "expensive", "how much does it cost"] },
  { id: "send-info", keywords: ["send me", "send info", "send information", "email me", "send something", "send over"] },
  { id: "no-budget", keywords: ["no budget", "don't have the budget", "dont have the budget", "can't afford", "cant afford", "too expensive"] },
  { id: "call-back", keywords: ["call back", "call later", "callback", "busy right now", "try later", "not a good time"] },
  { id: "who-are-you", keywords: ["who is this", "who are you", "what company", "where you calling from"] },
  { id: "see-examples", keywords: ["see examples", "any examples", "portfolio", "samples", "show me", "your work"] },
  { id: "ask-owner", keywords: ["ask the owner", "talk to the owner", "owner", "manager", "not my decision", "not up to me"] },
  { id: "too-busy", keywords: ["too busy", "we're busy", "were busy", "swamped", "no time"] },
  { id: "social-only", keywords: ["facebook", "instagram", "just use social", "only social", "we use facebook"] },
  { id: "site-fine", keywords: ["site is fine", "website is fine", "happy with", "works fine", "no problems"] },
  { id: "tried-before", keywords: ["tried that", "tried before", "didn't work", "didnt work", "waste of money", "bad experience"] },
  { id: "guarantee", keywords: ["guarantee", "promise more customers", "get me customers", "more sales", "more business"] },
  { id: "monthly-fee", keywords: ["monthly", "subscription", "recurring", "every month", "ongoing fee"] },
  { id: "how-long", keywords: ["how long", "timeline", "when done", "how soon", "turnaround"] },
  { id: "provide-photos", keywords: ["provide photos", "need photos", "who takes photos", "my own pictures", "supply images"] },
  { id: "update-instead", keywords: ["update instead", "fix our current", "update our current", "keep our site", "not a new one", "just update"] },
];

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

export interface MatchResult {
  id: string;
  confidence: number; // 0..1
}

/** Best-matching intent for free text, or null when nothing scores. */
export function matchIntent(text: string, intents: Intent[] = OUTREACH_INTENTS): MatchResult | null {
  const hay = ` ${normalize(text)} `;
  if (hay.trim().length === 0) return null;
  let best: MatchResult | null = null;
  for (const intent of intents) {
    let hits = 0;
    let strongest = 0;
    for (const kw of intent.keywords) {
      const k = normalize(kw);
      if (!k) continue;
      const isPhrase = k.includes(" ");
      const present = isPhrase ? hay.includes(` ${k} `) || hay.includes(`${k} `) || hay.includes(` ${k}`) : hay.includes(` ${k} `);
      if (present) {
        hits++;
        strongest = Math.max(strongest, k.split(" ").length); // longer phrase = stronger signal
      }
    }
    if (hits > 0) {
      const score = Math.min(1, 0.45 + 0.2 * (strongest - 1) + 0.1 * (hits - 1));
      if (!best || score > best.confidence) best = { id: intent.id, confidence: Number(score.toFixed(2)) };
    }
  }
  return best;
}
