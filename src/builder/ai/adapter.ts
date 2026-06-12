// ============================================================
// Local AI — runner adapters (plan §15 / Phase 14)
// ============================================================
// One interface over the two recommended local runners:
//
//   ollama     auto-detected at localhost:11434 — best model
//              management (pull/list), JSON-schema output support
//   llamacpp   llama-server's OpenAI-compatible API (default
//              localhost:8080) — MIT, the bundleable engine the
//              desktop app will ship as a sidecar
//
// LOCAL-FIRST: these talk to loopback on the operator's machine.
// No cloud calls, no telemetry, no keys. Everything fail-soft:
// a dead runner returns a typed error, never a throw the UI
// can't render. fetch is injectable for tests.
// ============================================================

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  /** JSON schema for structured output — grammar-constrained where supported. */
  schema?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
}

export type ChatResult =
  | { ok: true; content: string; model: string; tookMs: number }
  | { ok: false; error: string };

export interface RunnerStatus {
  id: "ollama" | "llamacpp";
  available: boolean;
  models: string[];
  detail: string;
}

export interface LlmAdapter {
  id: "ollama" | "llamacpp";
  status(): Promise<RunnerStatus>;
  chat(model: string, req: ChatRequest): Promise<ChatResult>;
}

const TIMEOUT_MS = 120_000; // CPU-tier models are slow; the UI sets expectations

async function timedFetch(fetchImpl: typeof fetch, url: string, init?: RequestInit): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function createOllamaAdapter(baseUrl = "http://127.0.0.1:11434", fetchImpl: typeof fetch = fetch): LlmAdapter {
  const base = baseUrl.replace(/\/$/, "");
  return {
    id: "ollama",
    async status() {
      try {
        const res = await timedFetch(fetchImpl, `${base}/api/tags`);
        if (!res.ok) return { id: "ollama", available: false, models: [], detail: `HTTP ${res.status}` };
        const body = (await res.json()) as { models?: Array<{ name: string }> };
        return {
          id: "ollama",
          available: true,
          models: (body.models ?? []).map((m) => m.name),
          detail: base,
        };
      } catch {
        return { id: "ollama", available: false, models: [], detail: `not reachable at ${base}` };
      }
    },
    async chat(model, req) {
      const started = Date.now();
      try {
        const res = await timedFetch(fetchImpl, `${base}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: req.messages,
            stream: false,
            ...(req.schema ? { format: req.schema } : {}),
            options: {
              ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
              ...(req.maxTokens !== undefined ? { num_predict: req.maxTokens } : {}),
            },
          }),
        });
        if (!res.ok) return { ok: false, error: `Ollama HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
        const body = (await res.json()) as { message?: { content?: string } };
        const content = body.message?.content ?? "";
        if (!content) return { ok: false, error: "Ollama returned an empty reply" };
        return { ok: true, content, model, tookMs: Date.now() - started };
      } catch (err) {
        return { ok: false, error: `Ollama unreachable: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  };
}

export function createLlamaCppAdapter(baseUrl = "http://127.0.0.1:8080", fetchImpl: typeof fetch = fetch): LlmAdapter {
  const base = baseUrl.replace(/\/$/, "");
  return {
    id: "llamacpp",
    async status() {
      try {
        const res = await timedFetch(fetchImpl, `${base}/v1/models`);
        if (!res.ok) return { id: "llamacpp", available: false, models: [], detail: `HTTP ${res.status}` };
        const body = (await res.json()) as { data?: Array<{ id: string }> };
        return {
          id: "llamacpp",
          available: true,
          models: (body.data ?? []).map((m) => m.id),
          detail: base,
        };
      } catch {
        return { id: "llamacpp", available: false, models: [], detail: `not reachable at ${base}` };
      }
    },
    async chat(model, req) {
      const started = Date.now();
      try {
        const res = await timedFetch(fetchImpl, `${base}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: req.messages,
            stream: false,
            ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
            ...(req.maxTokens !== undefined ? { max_tokens: req.maxTokens } : {}),
            ...(req.schema
              ? { response_format: { type: "json_schema", json_schema: { name: "task_output", schema: req.schema, strict: true } } }
              : {}),
          }),
        });
        if (!res.ok) return { ok: false, error: `llama.cpp HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
        const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = body.choices?.[0]?.message?.content ?? "";
        if (!content) return { ok: false, error: "llama.cpp returned an empty reply" };
        return { ok: true, content, model, tookMs: Date.now() - started };
      } catch (err) {
        return { ok: false, error: `llama.cpp unreachable: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  };
}

/** Probe both runners; the settings panel renders the result. */
export async function detectRunners(
  fetchImpl: typeof fetch = fetch,
  urls: { ollama?: string; llamacpp?: string } = {}
): Promise<RunnerStatus[]> {
  return Promise.all([
    createOllamaAdapter(urls.ollama, fetchImpl).status(),
    createLlamaCppAdapter(urls.llamacpp, fetchImpl).status(),
  ]);
}

export function adapterFor(
  runner: "ollama" | "llamacpp",
  baseUrl: string | undefined,
  fetchImpl: typeof fetch = fetch
): LlmAdapter {
  return runner === "ollama" ? createOllamaAdapter(baseUrl, fetchImpl) : createLlamaCppAdapter(baseUrl, fetchImpl);
}
