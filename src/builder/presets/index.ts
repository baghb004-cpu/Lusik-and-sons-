// ============================================================
// Service preset registry (plan §17)
// ============================================================
// The single lookup surface over every preset. UI cards (Phase
// 17) read byCategory + beginner filters; the export generators
// (Phase 11) read a selection's union of files/env/packages; the
// checklist screen reads buildSetupChecklist. Adding a provider
// touches exactly one category file — never this logic.
// ============================================================

import { presetSchema, stackSchema, type Preset, type PresetCategory, type Stack } from "./types.ts";
import { HOSTING_PRESETS } from "./hosting.ts";
import { DATABASE_PRESETS } from "./database.ts";
import { COMMERCE_PRESETS } from "./commerce.ts";
import { EMAIL_PRESETS } from "./email.ts";
import { SECURITY_PRESETS } from "./security.ts";
import { CMS_PRESETS } from "./cms.ts";
import { STACKS } from "./stacks.ts";

export { presetSchema, stackSchema } from "./types.ts";
export type { Preset, PresetCategory, PresetDifficulty, Stack } from "./types.ts";
export { STACKS } from "./stacks.ts";

export const ALL_PRESETS: Preset[] = [
  ...HOSTING_PRESETS,
  ...DATABASE_PRESETS,
  ...COMMERCE_PRESETS,
  ...EMAIL_PRESETS,
  ...SECURITY_PRESETS,
  ...CMS_PRESETS,
];

const BY_ID = new Map(ALL_PRESETS.map((p) => [p.id, p]));

export function presetById(id: string): Preset | null {
  return BY_ID.get(id) ?? null;
}

export function presetsByCategory(category: PresetCategory): Preset[] {
  return ALL_PRESETS.filter((p) => p.category === category);
}

/** Beginner mode: the easiest 2–3 choices per category (plan §17 UI). */
export function beginnerChoices(category: PresetCategory, max = 3): Preset[] {
  return presetsByCategory(category)
    .filter((p) => p.difficulty === "easy")
    .slice(0, max);
}

export interface SelectionIssue {
  level: "error" | "warning";
  message: string;
  presetId: string;
}

/**
 * Cross-preset checks over a chosen selection:
 *  - unknown ids
 *  - requiresPresets unsatisfied (treated as an OR-list: any one present
 *    satisfies it — e.g. admin-notifications needs resend OR smtp)
 *  - more than one pick per exclusive category (hosting/database/cms)
 */
export function validateSelection(ids: string[]): SelectionIssue[] {
  const issues: SelectionIssue[] = [];
  const chosen = new Set(ids);
  const exclusive: PresetCategory[] = ["hosting", "database", "cms"];

  const perCategory = new Map<PresetCategory, string[]>();
  for (const id of ids) {
    const preset = BY_ID.get(id);
    if (!preset) {
      issues.push({ level: "error", message: `Unknown preset "${id}"`, presetId: id });
      continue;
    }
    perCategory.set(preset.category, [...(perCategory.get(preset.category) ?? []), id]);
    if (preset.requiresPresets.length > 0 && !preset.requiresPresets.some((req) => chosen.has(req))) {
      issues.push({
        level: "error",
        message: `"${preset.label}" needs one of: ${preset.requiresPresets.join(", ")}`,
        presetId: id,
      });
    }
  }
  for (const cat of exclusive) {
    const picks = perCategory.get(cat) ?? [];
    if (picks.length > 1) {
      for (const id of picks.slice(1)) {
        issues.push({ level: "error", message: `Only one ${cat} preset can be active`, presetId: id });
      }
    }
  }
  return issues;
}

export interface SetupChecklist {
  envVars: { required: string[]; optional: string[] };
  npmPackages: string[];
  filesToGenerate: string[];
  accountsNeeded: string[]; // preset labels requiring a user account
  secretWarnings: string[]; // labels handling secret keys
  steps: Array<{ preset: string; steps: string[] }>;
  warnings: Array<{ preset: string; warning: string }>;
}

/** The pre-deploy checklist for a selection (plan §17 UI's final screen). */
export function buildSetupChecklist(ids: string[]): SetupChecklist {
  const presets = ids.map((id) => BY_ID.get(id)).filter((p): p is Preset => !!p);
  const uniq = (arr: string[]) => [...new Set(arr)];
  return {
    envVars: {
      required: uniq(presets.flatMap((p) => p.requiredEnvVars)),
      optional: uniq(presets.flatMap((p) => p.optionalEnvVars)),
    },
    npmPackages: uniq(presets.flatMap((p) => p.npmPackages)),
    filesToGenerate: uniq(presets.flatMap((p) => p.filesToGenerate)),
    accountsNeeded: presets.filter((p) => p.requiresUserAccount).map((p) => p.label),
    secretWarnings: presets.filter((p) => p.requiresSecretKey).map((p) => p.label),
    steps: presets.filter((p) => p.setupSteps.length > 0).map((p) => ({ preset: p.label, steps: p.setupSteps })),
    warnings: presets.flatMap((p) => p.warnings.map((warning) => ({ preset: p.label, warning }))),
  };
}

export function stackById(id: string): Stack | null {
  return STACKS.find((s) => s.id === id) ?? null;
}

/** A stack's suggested defaults: the first choice of every non-empty category. */
export function stackDefaults(stack: Stack): string[] {
  return Object.values(stack.choices)
    .filter((choices) => choices.length > 0)
    .map((choices) => choices[0]);
}
