import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createOllamaAdapter,
  createLlamaCppAdapter,
  detectRunners,
  MODEL_CATALOG,
  recommendTier,
  aiSettingsSchema,
  assertAiWritable,
  AiGuardrailError,
  gateAiBlocks,
  extractJson,
  AI_TASKS,
  taskById,
  buildSiteContext,
} from "../ai/index.ts";
import type { CatalogSnapshot } from "../engine/commerce.ts";

const catalog: CatalogSnapshot = {
  bibs: [{ slug: "baby-bib", name: "The Custom Name Bib", status: "live", priceFrom: 22 }],
};

// ── adapters (fetch injected — no network) ──────────────────
function capture(reply: unknown, status = 200) {
  const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify(reply), { status });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

test("ollama adapter: schema → format, options mapped, fail-soft on errors", async () => {
  const { calls, fetchImpl } = capture({ message: { content: "hi" } });
  const adapter = createOllamaAdapter(undefined, fetchImpl);
  const result = await adapter.chat("qwen3:4b", {
    messages: [{ role: "user", content: "x" }],
    schema: { type: "array" },
    temperature: 0.2,
    maxTokens: 256,
  });
  assert.equal(result.ok, true);
  const body = calls[0].body!;
  assert.equal(calls[0].url, "http://127.0.0.1:11434/api/chat");
  assert.deepEqual(body.format, { type: "array" });
  assert.deepEqual(body.options, { temperature: 0.2, num_predict: 256 });
  assert.equal(body.stream, false);

  const down = (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch;
  const dead = await createOllamaAdapter(undefined, down).chat("m", { messages: [] });
  assert.equal(dead.ok, false);
  assert.match((dead as { error: string }).error, /unreachable/);
});

test("llama.cpp adapter: OpenAI shape with json_schema response_format", async () => {
  const { calls, fetchImpl } = capture({ choices: [{ message: { content: "ok" } }] });
  const adapter = createLlamaCppAdapter("http://127.0.0.1:9999/", fetchImpl);
  const result = await adapter.chat("local", { messages: [{ role: "user", content: "x" }], schema: { type: "object" } });
  assert.equal(result.ok, true);
  assert.equal(calls[0].url, "http://127.0.0.1:9999/v1/chat/completions");
  const rf = calls[0].body!.response_format as { type: string; json_schema: { schema: unknown } };
  assert.equal(rf.type, "json_schema");
  assert.deepEqual(rf.json_schema.schema, { type: "object" });
});

test("detectRunners reports availability without throwing when both are down", async () => {
  const down = (async () => { throw new Error("nope"); }) as unknown as typeof fetch;
  const statuses = await detectRunners(down);
  assert.deepEqual(statuses.map((s) => s.available), [false, false]);
});

// ── catalog licensing invariants ────────────────────────────
test("LICENSE LAW: every cataloged model is permissively licensed; traps are absent", () => {
  for (const m of MODEL_CATALOG) {
    assert.ok(["Apache-2.0", "MIT"].includes(m.license), `${m.id}: ${m.license}`);
    assert.equal(m.redistributable, true, m.id);
  }
  const ids = MODEL_CATALOG.map((m) => m.id).join(",");
  assert.ok(!/codestral/i.test(ids), "Codestral (non-production license) must not be cataloged");
  assert.ok(!/coder-3b|qwen2\.5-coder:3b/i.test(ids), "Qwen2.5-Coder-3B (research license) must not be cataloged");
});

test("tier advice is honest about weak hardware", () => {
  assert.equal(recommendTier(8).tier, "cpu");
  assert.match(recommendTier(8).warning ?? "", /slow for large code generation/);
  assert.match(recommendTier(4).warning ?? "", /swap/);
  assert.equal(recommendTier(32).tier, "mid");
  assert.equal(recommendTier(64).tier, "high");
  assert.equal(aiSettingsSchema.parse({}).model, "qwen3:4b");
});

// ── guardrails ──────────────────────────────────────────────
test("WALL 1: protected zones are unreachable for AI proposals", () => {
  for (const ok of ["builder/pages/x.json", "builder/templates/t.json", "content/products/p.json"]) {
    assert.doesNotThrow(() => assertAiWritable(ok));
  }
  for (const no of [
    "netlify/functions/_lib/trusted-products.mjs",
    "src/lib/auth.js",
    "builder/data/shipping.json",
    ".env",
    "builder/theme.json",
  ]) {
    assert.throws(() => assertAiWritable(no), AiGuardrailError, no);
  }
});

test("WALL 2: model output passes the SAME gates as human edits", () => {
  const good = JSON.stringify([
    { id: "b_aaaaaaaaaaaa", type: "button", props: { label: "Shop", href: "/shop" } },
  ]);
  assert.equal(gateAiBlocks(good, catalog).ok, true);

  const evil = JSON.stringify([
    { id: "b_aaaaaaaaaaaa", type: "button", props: { label: "x", href: "javascript:alert(1)" } },
  ]);
  const refused = gateAiBlocks(evil, catalog);
  assert.equal(refused.ok, false);
  assert.equal(refused.blocks.length, 0);

  const invented = JSON.stringify([
    { id: "b_aaaaaaaaaaaa", type: "productCard", props: { product: "bibs/imaginary" } },
  ]);
  assert.equal(gateAiBlocks(invented, catalog).ok, false);

  assert.equal(gateAiBlocks("I think the answer is probably 42.", catalog).ok, false);
});

test("extractJson survives markdown fences, prose, and nested strings", () => {
  assert.equal(extractJson('```json\n[{"a":1}]\n```'), '[{"a":1}]');
  assert.equal(extractJson('Sure! Here you go: [{"a":"tricky ] bracket"}] hope that helps'), '[{"a":"tricky ] bracket"}]');
  assert.equal(extractJson('{"blocks":[]} trailing'), '{"blocks":[]}');
});

test("gateAiBlocks unwraps a {blocks:[…]} envelope", () => {
  const enveloped = JSON.stringify({ blocks: [{ id: "b_bbbbbbbbbbbb", type: "spacer", props: { size: "spacing.md" } }] });
  const result = gateAiBlocks(enveloped, catalog);
  assert.equal(result.ok, true);
  assert.equal(result.blocks[0].type, "spacer");
});

// ── tasks ───────────────────────────────────────────────────
test("tasks: house rules in every system prompt; blocks task carries its schema", () => {
  assert.ok(AI_TASKS.length >= 5);
  for (const t of AI_TASKS) {
    const messages = t.build("input", "context");
    assert.equal(messages[0].role, "system");
    assert.match(messages[0].content, /NEVER write code, payment logic, prices/);
    if (t.kind === "blocks") assert.ok(t.schema, t.id);
  }
  assert.equal(taskById("draft-blocks")?.kind, "blocks");
  assert.equal(taskById("nope"), null);
});

test("buildSiteContext lists live products with prices, skips placeholders", () => {
  const ctx = buildSiteContext({
    bibs: [
      { name: "Bib", status: "live", priceFrom: 22 },
      { name: "Future", status: "placeholder", priceFrom: null },
    ],
  });
  assert.match(ctx, /Bib \(\$22\)/);
  assert.ok(!ctx.includes("Future"));
});
