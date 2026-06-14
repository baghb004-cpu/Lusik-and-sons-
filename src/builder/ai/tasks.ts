// ============================================================
// Local AI — the task library (plan §15)
// ============================================================
// Each task = a system prompt + an input builder + (for
// structured tasks) the JSON schema the runner constrains output
// to. The system prompts carry the protected-zone law in words;
// guardrails.ts carries it in code — both, always.
// ============================================================

import type { ChatMessage } from "./adapter.ts";

const HOUSE_RULES = `You are the writing/planning assistant inside a website builder for a small handmade-goods business.
Rules you must always follow:
- You only draft content and page blocks. You NEVER write code, payment logic, prices, environment variables, or configuration — those are protected and your output there will be discarded.
- Prices come from the shop's catalog, never from you. Never invent a price, product, or discount.
- Be warm, concrete and brief. No marketing clichés, no exclamation inflation.
- When asked for JSON, return ONLY JSON.`;

// The block subset the model may produce — small on purpose; the full
// registry stays a human tool. Commerce blocks are reference-only here.
const BLOCKS_SCHEMA = {
  type: "array",
  minItems: 1,
  maxItems: 8,
  items: {
    type: "object",
    required: ["id", "type", "props"],
    additionalProperties: false,
    properties: {
      id: { type: "string", pattern: "^b_[a-z0-9]{12}$" },
      type: { enum: ["section", "richText", "card", "button", "accordion", "spacer"] },
      props: { type: "object" },
      children: { type: "array" },
    },
  },
} as const;

export interface AiTask {
  id: string;
  label: string;
  kind: "blocks" | "text";
  schema?: Record<string, unknown>;
  build(input: string, context: string): ChatMessage[];
}

const msg = (system: string, user: string): ChatMessage[] => [
  { role: "system", content: system },
  { role: "user", content: user },
];

export const AI_TASKS: AiTask[] = [
  {
    id: "draft-blocks",
    label: "Draft page blocks",
    kind: "blocks",
    schema: BLOCKS_SCHEMA as unknown as Record<string, unknown>,
    build: (input, context) =>
      msg(
        `${HOUSE_RULES}
Produce builder blocks as a JSON array. Allowed types and their props:
- section: { eyebrow?, heading?, container?: true } with children
- richText: { doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] } }
- card: { title, body?: <richText doc>, href?, ctaLabel? } — href must be a site path like "/shop"
- button: { label, href, variant?: "primary"|"secondary"|"ghost" }
- accordion: { items: [{ id, title, body: <richText doc> }] }
- spacer: { size: "spacing.md" }
Every id must match ^b_[a-z0-9]{12}$ and be unique. Links must be site-relative paths or https URLs — anything else is rejected.`,
        `Site context:\n${context}\n\nDraft blocks for: ${input}`
      ),
  },
  {
    id: "product-description",
    label: "Write a product description",
    kind: "text",
    build: (input, context) =>
      msg(
        `${HOUSE_RULES}
Write a warm, honest product description (60–120 words) for a handmade item. Lead with what makes it special, mention materials and care plainly, no hype words ("stunning", "must-have"), no invented facts. Return only the description.`,
        `Site context:\n${context}\n\nProduct notes from the maker:\n${input}`
      ),
  },
  {
    id: "seo-suggest",
    label: "Suggest SEO title + description",
    kind: "text",
    build: (input, context) =>
      msg(
        `${HOUSE_RULES}
Suggest 3 search-result titles (max 60 chars each) and 3 meta descriptions (max 155 chars each) for the given page. Plain language, no clickbait, include what a real searcher would type. Return them as two labeled lists.`,
        `Site context:\n${context}\n\nPage content/topic:\n${input}`
      ),
  },
  {
    id: "mobile-review",
    label: "Review for mobile-friendliness",
    kind: "text",
    build: (input, context) =>
      msg(
        `${HOUSE_RULES}
Review the described page for small screens: reading order, tap target spacing, line lengths, image weight, anything that forces horizontal scrolling. Return a short prioritized list of concrete fixes the builder's own tools can make (device overrides, the Screens grader, spacing edits).`,
        `Site context:\n${context}\n\nPage outline:\n${input}`
      ),
  },
  {
    id: "improve-copy",
    label: "Improve this copy",
    kind: "text",
    build: (input, context) =>
      msg(
        `${HOUSE_RULES}
Rewrite the given copy: keep the meaning and any facts EXACTLY (names, numbers, materials), improve warmth and rhythm, cut filler. Return only the rewritten text.`,
        `Site context:\n${context}\n\nCopy to improve:\n${input}`
      ),
  },
  {
    id: "review-page",
    label: "Review accessibility & clarity",
    kind: "text",
    build: (input, context) =>
      msg(
        `${HOUSE_RULES}
You review a page's block JSON for content problems a validator can't see: confusing copy, missing context, weak headings, alt text that doesn't describe, walls of text, unclear CTAs. Reply as a short numbered list, most important first. You do NOT comment on code, performance, or anything outside the content itself.`,
        `Site context:\n${context}\n\nPage JSON:\n${input}`
      ),
  },
  {
    id: "explain-error",
    label: "Explain this error",
    kind: "text",
    build: (input) =>
      msg(
        `${HOUSE_RULES}
Explain the given builder validation error in one or two plain sentences a non-technical shop owner understands, then say what to change. Never suggest disabling a gate — they protect the shop.`,
        `Error:\n${input}`
      ),
  },
  {
    id: "plan-project",
    label: "Draft a project plan",
    kind: "text",
    build: (input, context) =>
      msg(
        `${HOUSE_RULES}
Draft a short project plan for a new site/app: audience, the 3–7 pages/screens it needs, what each contains, what data it touches, and open questions to answer before building. Markdown headings, brief.`,
        `Existing site context:\n${context}\n\nProject idea:\n${input}`
      ),
  },
];

export function taskById(id: string): AiTask | null {
  return AI_TASKS.find((t) => t.id === id) ?? null;
}

/** Compact site context the tasks receive — facts, not the whole catalog. */
export function buildSiteContext(catalog: Record<string, Array<{ name: string; status: string; priceFrom: number | null }>>): string {
  const lines: string[] = ["Lusik & Sons — handmade Armenian cross-stitched baby goods, Buena Park CA."];
  for (const [category, products] of Object.entries(catalog)) {
    const live = products.filter((p) => p.status === "live").map((p) => `${p.name} ($${p.priceFrom})`);
    if (live.length) lines.push(`${category}: ${live.join(", ")}`);
  }
  return lines.join("\n");
}
