// Local AI — public surface.

export {
  createOllamaAdapter,
  createLlamaCppAdapter,
  detectRunners,
  adapterFor,
  type LlmAdapter,
  type ChatMessage,
  type ChatRequest,
  type ChatResult,
  type RunnerStatus,
} from "./adapter.ts";

export {
  MODEL_CATALOG,
  MODEL_TIERS,
  modelsForTier,
  recommendTier,
  aiSettingsSchema,
  AI_SETTINGS_PATH,
  type ModelInfo,
  type ModelTier,
  type TierAdvice,
  type AiSettings,
} from "./models.ts";

export {
  assertAiWritable,
  gateAiBlocks,
  extractJson,
  AiGuardrailError,
  type BlocksProposal,
} from "./guardrails.ts";

export { AI_TASKS, taskById, buildSiteContext, type AiTask } from "./tasks.ts";
