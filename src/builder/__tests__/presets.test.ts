import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ALL_PRESETS,
  STACKS,
  presetSchema,
  stackSchema,
  presetById,
  presetsByCategory,
  beginnerChoices,
  validateSelection,
  buildSetupChecklist,
  stackById,
  stackDefaults,
} from "../presets/index.ts";

test("every preset satisfies the schema; ids are unique", () => {
  const seen = new Set<string>();
  for (const p of ALL_PRESETS) {
    const result = presetSchema.safeParse(p);
    assert.equal(result.success, true, `${p.id}: ${JSON.stringify(!result.success && result.error.issues)}`);
    assert.ok(!seen.has(p.id), `duplicate preset id ${p.id}`);
    seen.add(p.id);
  }
  assert.ok(ALL_PRESETS.length >= 25, "the launch catalog covers all requested providers");
});

test("HONESTY GATE: informational presets generate nothing and configure nothing", () => {
  const informational = ALL_PRESETS.filter((p) => p.informational);
  assert.ok(informational.length >= 4, "security cards + headless-cms card exist");
  for (const p of informational) {
    assert.deepEqual(p.filesToGenerate, [], p.id);
    assert.deepEqual(p.npmPackages, [], p.id);
    assert.deepEqual(p.requiredEnvVars, [], p.id);
    assert.equal(p.canAutoConfigure, false, `${p.id} must not claim auto-configure`);
  }
});

test("HONESTY GATE: no preset claims auto-configure without honest account/secret flags", () => {
  for (const p of ALL_PRESETS) {
    // canAutoConfigure may only mean local preparation — anything needing
    // a secret key must also declare requiresUserAccount so the UI says so.
    if (p.requiresSecretKey) assert.equal(p.requiresUserAccount, true, p.id);
  }
  // Cloudflare is never required: the security category is informational-only.
  for (const p of presetsByCategory("security")) {
    assert.equal(p.informational, true, `${p.id} — DNS/security presets stay informational`);
  }
});

test("every requiresPresets reference points at a real preset", () => {
  for (const p of ALL_PRESETS) {
    for (const req of p.requiresPresets) {
      assert.ok(presetById(req), `${p.id} requires unknown preset "${req}"`);
    }
  }
});

test("beginner mode: 2–3 easy choices for the core categories", () => {
  for (const cat of ["hosting", "database", "email"] as const) {
    const easy = beginnerChoices(cat);
    assert.ok(easy.length >= 1 && easy.length <= 3, `${cat}: ${easy.length}`);
    assert.ok(easy.every((p) => p.difficulty === "easy"));
  }
  // advanced options exist but are NOT in beginner mode
  assert.ok(!beginnerChoices("hosting").some((p) => p.id === "fly-io"));
});

test("stacks: schema-valid, reference only real presets, defaults resolve", () => {
  assert.equal(STACKS.length, 4);
  for (const s of STACKS) {
    const result = stackSchema.safeParse(s);
    assert.equal(result.success, true, `${s.id}: ${JSON.stringify(!result.success && result.error.issues)}`);
    for (const ids of Object.values(s.choices)) {
      for (const id of ids) assert.ok(presetById(id), `${s.id} references unknown preset "${id}"`);
    }
    const defaults = stackDefaults(s);
    assert.ok(defaults.length > 0);
    assert.deepEqual(validateSelection(defaults).filter((i) => i.level === "error"), [], s.id);
  }
});

test("the reference Lusik stack (shop) defaults to the production-validated combo", () => {
  const shop = stackById("small-business-shop")!;
  const defaults = stackDefaults(shop);
  assert.ok(defaults.includes("netlify"));
  assert.ok(defaults.includes("stripe-checkout"));
  assert.ok(defaults.includes("resend"));
});

test("validateSelection: dependency OR-lists, exclusive categories, unknown ids", () => {
  // capability without a provider → error
  const noProvider = validateSelection(["admin-notifications"]);
  assert.ok(noProvider.some((i) => i.level === "error" && /needs one of/.test(i.message)));
  // either provider satisfies the OR-list
  assert.deepEqual(validateSelection(["resend", "admin-notifications"]).filter((i) => i.level === "error"), []);
  assert.deepEqual(validateSelection(["smtp", "admin-notifications"]).filter((i) => i.level === "error"), []);
  // two hostings → error; unknown id → error
  assert.ok(validateSelection(["netlify", "vercel"]).some((i) => /Only one hosting/.test(i.message)));
  assert.ok(validateSelection(["geocities"]).some((i) => /Unknown preset/.test(i.message)));
  // stripe-webhooks depends on stripe-checkout
  assert.ok(validateSelection(["stripe-webhooks"]).some((i) => i.level === "error"));
});

test("buildSetupChecklist unions env vars, packages, accounts and warnings", () => {
  const checklist = buildSetupChecklist(["netlify", "neon", "stripe-checkout", "stripe-webhooks", "resend"]);
  assert.ok(checklist.envVars.required.includes("DATABASE_URL"));
  assert.ok(checklist.envVars.required.includes("STRIPE_SECRET_KEY"));
  assert.ok(checklist.envVars.required.includes("STRIPE_WEBHOOK_SECRET"));
  assert.ok(checklist.envVars.required.includes("RESEND_API_KEY"));
  // STRIPE_SECRET_KEY appears in two presets but is deduplicated
  assert.equal(checklist.envVars.required.filter((v) => v === "STRIPE_SECRET_KEY").length, 1);
  assert.ok(checklist.npmPackages.includes("stripe"));
  assert.ok(checklist.accountsNeeded.includes("Stripe Checkout"));
  assert.ok(checklist.secretWarnings.includes("Resend"));
  assert.ok(checklist.warnings.some((w) => /server env vars only/.test(w.warning)));
  assert.ok(checklist.steps.length >= 4);
});
