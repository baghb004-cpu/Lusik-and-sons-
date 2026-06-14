// ============================================================
// Local AI — the license-vetted model catalog (plan §15)
// ============================================================
// The §15 research table as data: tiers, honest hardware
// expectations, and redistribution rights per model. NOTHING is
// bundled by default — models arrive download-on-first-run via
// the user's runner (Ollama pull / user-provided GGUF path), and
// the catalog records the license that allows even that. Models
// with license traps (Codestral's non-production license,
// Qwen2.5-Coder-3B's research license) are deliberately ABSENT.
// Re-verify licenses at desktop-app packaging time (§15 note).
// ============================================================

import { z } from "zod";

export const MODEL_TIERS = ["cpu", "mid", "high"] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

export interface ModelInfo {
  id: string;
  label: string;
  tier: ModelTier;
  paramsB: number;
  license: string; // SPDX-ish
  redistributable: boolean; // may an offline-install USB carry the weights?
  ollamaTag: string; // `ollama pull <tag>`
  approxDiskGB: number; // Q4-class quantization
  approxRamGB: number; // runtime, modest context
  notes: string;
}

export const MODEL_CATALOG: ModelInfo[] = [
  {
    id: "qwen3-4b",
    label: "Qwen3 4B",
    tier: "cpu",
    paramsB: 4,
    license: "Apache-2.0",
    redistributable: true,
    ollamaTag: "qwen3:4b",
    approxDiskGB: 2.5,
    approxRamGB: 5,
    notes: "The CPU-tier default: planning, copy drafts, schema/JSON tasks at ~5–10 tok/s on an older i5. Slow for big code generation — the panel says so.",
  },
  {
    id: "phi-4-mini",
    label: "Phi-4 mini (3.8B)",
    tier: "cpu",
    paramsB: 3.8,
    license: "MIT",
    redistributable: true,
    ollamaTag: "phi4-mini",
    approxDiskGB: 2.5,
    approxRamGB: 5,
    notes: "Pure-MIT alternative at the same size; decent function-calling.",
  },
  {
    id: "qwen2.5-coder-7b",
    label: "Qwen2.5-Coder 7B",
    tier: "cpu",
    paramsB: 7,
    license: "Apache-2.0",
    redistributable: true,
    ollamaTag: "qwen2.5-coder:7b",
    approxDiskGB: 4.7,
    approxRamGB: 8,
    notes: "The 16 GB-RAM step up — noticeably better code, noticeably slower on CPU. (The 3B sibling has a RESEARCH license and is deliberately not listed.)",
  },
  {
    id: "qwen3-coder-30b-a3b",
    label: "Qwen3-Coder 30B-A3B (MoE)",
    tier: "mid",
    paramsB: 30,
    license: "Apache-2.0",
    redistributable: true,
    ollamaTag: "qwen3-coder:30b",
    approxDiskGB: 18.5,
    approxRamGB: 22,
    notes: "Only ~3B active params → usable speed even RAM-offloaded on 32 GB; the mid-tier sweet spot for agentic edits.",
  },
  {
    id: "devstral-small-2",
    label: "Devstral Small 2 (24B)",
    tier: "mid",
    paramsB: 24,
    license: "Apache-2.0",
    redistributable: true,
    ollamaTag: "devstral",
    approxDiskGB: 14.5,
    approxRamGB: 18,
    notes: "Purpose-built agentic coder; strong tool-calling.",
  },
  {
    id: "qwen3-coder-next",
    label: "Qwen3-Coder-Next (80B-A3B)",
    tier: "high",
    paramsB: 80,
    license: "Apache-2.0",
    redistributable: true,
    ollamaTag: "qwen3-coder-next",
    approxDiskGB: 48,
    approxRamGB: 56,
    notes: "Near-frontier local coding; needs 64 GB RAM or serious VRAM. 256k context.",
  },
];

export function modelsForTier(tier: ModelTier): ModelInfo[] {
  return MODEL_CATALOG.filter((m) => m.tier === tier);
}

export interface TierAdvice {
  tier: ModelTier;
  reason: string;
  models: ModelInfo[];
  warning?: string;
}

/** Honest tier advice from available memory (plan §15: never overpromise). */
export function recommendTier(ramGB: number): TierAdvice {
  if (ramGB >= 48) {
    return { tier: "high", reason: `${ramGB} GB RAM fits the high tier`, models: modelsForTier("high") };
  }
  if (ramGB >= 24) {
    return { tier: "mid", reason: `${ramGB} GB RAM fits the MoE mid tier`, models: modelsForTier("mid") };
  }
  return {
    tier: "cpu",
    reason: `${ramGB} GB RAM → small-model tier`,
    models: modelsForTier("cpu"),
    warning:
      ramGB < 8
        ? "Under 8 GB RAM, even 4B models will swap — expect very slow replies, or skip local AI on this machine."
        : "CPU tier is genuinely useful for planning, copy and structured edits — but slow for large code generation. The deterministic gates do the safety work either way.",
  };
}

// The AI runner URL is fetched SERVER-SIDE, so it must be loopback only —
// otherwise an admin-authed request could point the server at an internal
// host or a cloud metadata endpoint (SSRF). The runner always runs on the
// operator's own machine, so loopback is also correct, not just safe.
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
export function isLoopbackUrl(url: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

// ── persisted settings (builder/data/ai.json) ───────────────
export const aiSettingsSchema = z
  .object({
    schemaVersion: z.number().int().min(1).default(1),
    runner: z.enum(["ollama", "llamacpp"]).default("ollama"),
    baseUrl: z.string().url().refine(isLoopbackUrl, "AI runner URL must be loopback (127.0.0.1 / localhost / ::1)").optional(),
    model: z.string().min(1).default("qwen3:4b"),
    temperature: z.number().min(0).max(2).default(0.4),
    maxTokens: z.number().int().min(64).max(8192).default(1024),
  })
  .strict();

export type AiSettings = z.infer<typeof aiSettingsSchema>;
export const AI_SETTINGS_PATH = "builder/data/ai.json";
