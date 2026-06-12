// ============================================================
// Local AI — guardrails: LLM proposes, gates dispose (plan §15)
// ============================================================
// Three walls, in order:
//
//   1. PROTECTED ZONES — the assistant may only ever produce
//      builder/content documents. Functions, payment logic, env
//      files, app code: structurally unreachable (assertAiWritable
//      throws before anything else runs).
//   2. SCHEMA GATES — AI-generated blocks parse through the SAME
//      blockSchema + commerce-binding checks as human edits. A
//      javascript: href or an invented product coming out of a
//      model dies exactly like one typed by hand.
//   3. HUMAN APPLY — guardrails never write. Validated output is
//      handed to the editor as a proposal; inserting it goes
//      through the normal edit path, and saving runs the server
//      gates again. The model cannot reach storage.
// ============================================================

import { z } from "zod";
import { blockSchema, type Block } from "../schema/index.ts";
import { validateCommerceRefs, type CatalogSnapshot } from "../engine/commerce.ts";
import type { ValidationIssue } from "../engine/validate.ts";

const AI_WRITABLE = [/^builder\/pages\//, /^builder\/templates\//, /^content\/(products|categories|pages)\//];

export class AiGuardrailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiGuardrailError";
  }
}

/** Wall 1: the only paths AI proposals may ever target. */
export function assertAiWritable(path: string): void {
  if (!AI_WRITABLE.some((re) => re.test(path))) {
    throw new AiGuardrailError(
      `The assistant may not touch "${path}" — payment logic, functions, configuration and app code are protected zones (plan §5 tier 3).`
    );
  }
}

export interface BlocksProposal {
  ok: boolean;
  blocks: Block[];
  issues: ValidationIssue[];
}

/**
 * Wall 2: parse a model's JSON reply into validated blocks. Tolerates
 * the classic failure modes (markdown fences, a bare object instead of
 * an array, trailing prose) and then validates STRICTLY.
 */
export function gateAiBlocks(raw: string, catalog: CatalogSnapshot): BlocksProposal {
  const issues: ValidationIssue[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return { ok: false, blocks: [], issues: [{ level: "error", code: "ai_not_json", message: "The model didn't return valid JSON — try again or lower the temperature" }] };
  }
  const candidate = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { blocks?: unknown[] }).blocks)
      ? (parsed as { blocks: unknown[] }).blocks
      : [parsed];

  const blocks: Block[] = [];
  for (const [i, item] of candidate.entries()) {
    const result = blockSchema.safeParse(item);
    if (!result.success) {
      issues.push({
        level: "error",
        code: "ai_invalid_block",
        message: `Block ${i + 1}: ${result.error.issues[0]?.message ?? "invalid"}`,
      });
    } else {
      blocks.push(result.data);
    }
  }
  if (blocks.length === 0 && issues.length === 0) {
    issues.push({ level: "error", code: "ai_empty", message: "The model returned no blocks" });
  }
  issues.push(...validateCommerceRefs(blocks, catalog));
  const ok = !issues.some((i) => i.level === "error");
  return { ok, blocks: ok ? blocks : [], issues };
}

/** Strip ```json fences / surrounding prose around the first JSON value. */
export function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.search(/[[{]/);
  if (start === -1) return body;
  // walk to the matching close of the FIRST value
  const open = body[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return body.slice(start, i + 1);
  }
  return body.slice(start);
}

/** Plain-text task results (copy drafts, explanations) — length-bounded, never HTML. */
export const textResultSchema = z.string().min(1).max(20_000);
