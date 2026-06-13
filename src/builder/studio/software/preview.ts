// ============================================================
// Software Creation Mode (§31) — Safe Build Preview (sandbox)
// ============================================================
// "Test the change in a sandbox before merging it into the real project."
// Every preview function returns a NEW candidate project + a plain-English
// change list + a health read — and NEVER mutates the project passed in. The
// UI shows the preview, then the user confirms (which is when the engine op
// actually runs). Pure, offline.
// ============================================================

import { addFeature } from "./engine.ts";
import { checkProject, type ProjectHealth } from "./health.ts";
import { getPreset } from "./registry.ts";
import type { SoftwareProject } from "./schemas.ts";

export interface BuildPreview {
  ok: boolean;             // safe to apply (no hard errors introduced)
  changes: string[];       // plain-English "what this will create"
  warnings: string[];      // plain-English heads-ups
  candidate: SoftwareProject; // the would-be project (not committed)
  health: ProjectHealth;   // health of the candidate
}

// Preview dropping a preset into the project.
export function previewAdd(project: SoftwareProject, presetId: string): BuildPreview {
  const preset = getPreset(presetId);
  if (!preset) {
    return { ok: false, changes: [], warnings: [`Unknown preset "${presetId}".`], candidate: project, health: checkProject(project) };
  }

  // Build the candidate in isolation; addFeature returns a fresh object.
  const candidate = addFeature(project, presetId);
  const health = checkProject(candidate);

  const changes = [
    `Add "${preset.name}" to your project.`,
    ...preset.creates.map((c) => `• ${c}`),
    "• A rollback point (so you can undo this safely).",
  ];

  const warnings: string[] = [];
  for (const dep of preset.dependsOn) {
    if (!project.features.some((f) => f.presetId === dep)) {
      warnings.push(`Works best after you add "${getPreset(dep)?.name ?? dep}" too.`);
    }
  }
  if (!preset.pi && project.exportTargets.includes("raspberry-pi")) {
    warnings.push("This one may not run on Raspberry Pi 5.");
  }
  if (preset.status !== "ready") {
    warnings.push("Preview-stage feature — it scaffolds now; full build/export comes later.");
  }

  // "ok" = applying won't create a *new* hard error that didn't exist before.
  const beforeErrors = checkProject(project).counts.error;
  const ok = health.counts.error <= beforeErrors + countExpectedErrors(project, presetId);

  return { ok, changes, warnings, candidate, health };
}

// A dependency the user hasn't added yet is an expected, explainable error —
// it shouldn't make the preview itself look "unsafe".
function countExpectedErrors(project: SoftwareProject, presetId: string): number {
  const preset = getPreset(presetId);
  if (!preset) return 0;
  let n = 0;
  for (const dep of preset.dependsOn) if (!project.features.some((f) => f.presetId === dep)) n += 1;
  const missingRequired = preset.questions.some((q) => q.required);
  if (missingRequired) n += 1;
  return n;
}
