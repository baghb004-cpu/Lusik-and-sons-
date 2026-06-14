// POST /api/builder/ai — the local AI bridge (admin-gated)
//   { action: "status" }                          → detected runners + tier advice
//   { action: "run", task, input, settings }      → run a task on the LOCAL runner
//
// LOCAL-FIRST, like the §15 law: the Next server calls loopback
// (Ollama / llama-server on the operator's machine). On the hosted
// github-backend deployment there is no local runner — 501, honestly.
// Structured tasks return gated proposals; nothing here ever writes.

import { requireBuilderAdmin } from "../../../../src/builder/server/auth.ts";
import { getBuilderStorage } from "../../../../src/builder/storage/index.ts";
import {
  detectRunners,
  adapterFor,
  recommendTier,
  MODEL_CATALOG,
  aiSettingsSchema,
  taskById,
  buildSiteContext,
  gateAiBlocks,
} from "../../../../src/builder/ai/index.ts";
import { CATALOG } from "../../../../src/data/catalog.js";
import type { CatalogSnapshot } from "../../../../src/builder/engine/commerce.ts";
import { totalmem } from "node:os";

export const dynamic = "force-dynamic";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" },
  });
}

const snapshot = (): CatalogSnapshot =>
  Object.fromEntries(
    Object.entries(CATALOG as Record<string, { products: CatalogSnapshot[string] }>).map(([cat, c]) => [cat, c.products])
  ) as CatalogSnapshot;

/** Brand voice (INSPIRATION_ROADMAP P2): the AI writes like the business talks. */
async function brandContextSuffix(): Promise<string> {
  try {
    const raw = await getBuilderStorage().read("builder/brand.json");
    if (!raw) return "";
    const b = JSON.parse(raw) as { tagline?: string; voice?: string };
    const lines = [b.tagline ? `Tagline: ${b.tagline}` : "", b.voice ? `Voice & tone: ${b.voice}` : ""].filter(Boolean);
    return lines.length ? `\n${lines.join("\n")}` : "";
  } catch {
    return "";
  }
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireBuilderAdmin(req);
  if (!auth.ok) return auth.response!;

  if (getBuilderStorage().backend !== "fs") {
    return json(501, { error: "Local AI runs where the models run — on your machine (local mode). The hosted site has no local runner." });
  }

  let body: { action?: string; task?: string; input?: string; settings?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Body must be JSON" });
  }

  if (body.action === "status") {
    const ramGB = Math.round(totalmem() / 1024 ** 3);
    return json(200, {
      runners: await detectRunners(),
      advice: recommendTier(ramGB),
      ramGB,
      catalogTags: MODEL_CATALOG.map((m) => ({ id: m.id, label: m.label, tier: m.tier, license: m.license, ollamaTag: m.ollamaTag, disk: m.approxDiskGB, notes: m.notes })),
    });
  }

  if (body.action === "run") {
    const task = body.task ? taskById(body.task) : null;
    if (!task) return json(400, { error: "Unknown task" });
    const input = String(body.input ?? "").slice(0, 20_000);
    if (!input.trim()) return json(400, { error: "Input is empty" });
    const parsed = aiSettingsSchema.safeParse(body.settings ?? {});
    if (!parsed.success) return json(400, { error: "Bad settings" });
    const settings = parsed.data;

    const adapter = adapterFor(settings.runner, settings.baseUrl);
    const catalog = snapshot();
    const messages = task.build(input, buildSiteContext(catalog) + (await brandContextSuffix()));
    const result = await adapter.chat(settings.model, {
      messages,
      schema: task.schema,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
    });
    if (!result.ok) return json(502, { error: result.error });

    if (task.kind === "blocks") {
      const proposal = gateAiBlocks(result.content, catalog);
      return json(200, { kind: "blocks", proposal, model: result.model, tookMs: result.tookMs });
    }
    return json(200, { kind: "text", text: result.content.slice(0, 20_000), model: result.model, tookMs: result.tookMs });
  }

  return json(400, { error: 'Expected action "status" or "run"' });
}
