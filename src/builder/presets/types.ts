// ============================================================
// Service presets — the data model (plan §17)
// ============================================================
// A Preset describes how the builder PREPARES a project for an
// external service: files to generate, packages to add, env vars
// to template, setup steps to walk through. Honesty is enforced
// by the schema itself:
//
//   - canAutoConfigure means "the builder can do this locally,
//     one-click" (write files, .env.example, schema, checklist).
//     It NEVER means creating accounts or handling secret keys —
//     requiresUserAccount/requiresSecretKey exist precisely so
//     the UI must say so out loud.
//   - informational presets (DNS/security cards) generate
//     NOTHING and configure NOTHING — they render an explainer
//     card. The registry test enforces that they stay empty.
//   - recommendations carry their reasoning (recommendedFor) so
//     the UI's "Why this recommendation?" is data, not vibes.
// ============================================================

import { z } from "zod";

export const presetCategory = z.enum(["hosting", "database", "commerce", "email", "security", "cms"]);
export type PresetCategory = z.infer<typeof presetCategory>;

export const presetDifficulty = z.enum(["easy", "standard", "advanced"]);
export type PresetDifficulty = z.infer<typeof presetDifficulty>;

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ENV_RE = /^[A-Z][A-Z0-9_]*$/;

const docsLink = z.object({ label: z.string().min(1), url: z.string().url() }).strict();

export const presetSchema = z
  .object({
    id: z.string().regex(ID_RE),
    label: z.string().min(1).max(40),
    category: presetCategory,
    difficulty: presetDifficulty,
    blurb: z.string().min(1).max(200),

    bestFor: z.array(z.string().min(1)).min(1),
    notBestFor: z.array(z.string().min(1)).default([]),
    recommendedFor: z.array(z.string().min(1)).default([]), // feeds "Why this recommendation?"

    requiredEnvVars: z.array(z.string().regex(ENV_RE)).default([]),
    optionalEnvVars: z.array(z.string().regex(ENV_RE)).default([]),
    npmPackages: z.array(z.string().min(1)).default([]),
    filesToGenerate: z.array(z.string().min(1)).default([]), // repo-relative paths the generator will write
    setupSteps: z.array(z.string().min(1)).default([]), // ordered, human, copy/paste-friendly
    validationChecks: z.array(z.string().min(1)).default([]), // what "verify setup" will test
    warnings: z.array(z.string().min(1)).default([]), // paid tiers, lock-in, secret handling
    docsLinks: z.array(docsLink).default([]),

    /** One-click LOCAL preparation only — never external account/API actions. */
    canAutoConfigure: z.boolean(),
    requiresUserAccount: z.boolean(),
    requiresSecretKey: z.boolean(),

    /** Render-only explainer card: generates nothing, configures nothing. */
    informational: z.boolean().default(false),
    /** Plain-language free-tier note, e.g. "Free tier: 100 emails/day". */
    freeTier: z.string().optional(),
    /** Capability presets that need a provider preset selected first. */
    requiresPresets: z.array(z.string().regex(ID_RE)).default([]),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.informational) {
      const mustBeEmpty: Array<[string, unknown[]]> = [
        ["filesToGenerate", p.filesToGenerate],
        ["npmPackages", p.npmPackages],
        ["requiredEnvVars", p.requiredEnvVars],
      ];
      for (const [name, arr] of mustBeEmpty) {
        if (arr.length > 0) {
          ctx.addIssue({ code: "custom", path: [name], message: `informational presets must not generate/configure anything (${name})` });
        }
      }
      if (p.canAutoConfigure) {
        ctx.addIssue({ code: "custom", path: ["canAutoConfigure"], message: "informational presets cannot auto-configure" });
      }
    }
    // Secret keys imply an account somewhere to issue them.
    if (p.requiresSecretKey && !p.requiresUserAccount) {
      ctx.addIssue({ code: "custom", path: ["requiresSecretKey"], message: "a secret key implies a user account" });
    }
  });

export type Preset = z.infer<typeof presetSchema>;

// ── Recommended stacks ──────────────────────────────────────
export const stackSchema = z
  .object({
    id: z.string().regex(ID_RE),
    label: z.string().min(1).max(60),
    blurb: z.string().min(1).max(240),
    /** Per category: ordered preset-id choices; first = the suggested
     *  default. Empty array = the stack doesn't offer that category. */
    choices: z.record(presetCategory, z.array(z.string().regex(ID_RE))),
    optional: z.array(presetCategory).default([]), // categories the user may skip entirely
  })
  .strict();

export type Stack = z.infer<typeof stackSchema>;
