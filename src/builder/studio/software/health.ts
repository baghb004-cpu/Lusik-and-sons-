// ============================================================
// Software Creation Mode (§31) — Feature Health Check + validation pipeline
// ============================================================
// Pure: maps a feature (+ its preset + the project) to plain-English status.
// Levels: "ok" (green), "warn" (yellow, still usable), "error" (red, fix
// before build/export). The project readiness is the worst level across all
// features. No IO.
// ============================================================

import { getPreset } from "./registry.ts";
import type { FeatureInstance, Preset, SoftwareProject } from "./schemas.ts";

export type HealthLevel = "ok" | "warn" | "error";
export interface HealthItem { level: HealthLevel; code: string; message: string; }
export interface FeatureHealth {
  instanceId: string;
  presetId: string;
  label: string;
  level: HealthLevel;       // worst item
  items: HealthItem[];
}

const RANK: Record<HealthLevel, number> = { ok: 0, warn: 1, error: 2 };
function worst(items: HealthItem[]): HealthLevel {
  return items.reduce<HealthLevel>((acc, i) => (RANK[i.level] > RANK[acc] ? i.level : acc), "ok");
}

export function checkFeature(feature: FeatureInstance, project: SoftwareProject): FeatureHealth {
  const preset = getPreset(feature.presetId);
  const items: HealthItem[] = [];

  if (!preset) {
    items.push({ level: "error", code: "broken-dependency", message: "This feature points at a preset that no longer exists." });
    return { instanceId: feature.instanceId, presetId: feature.presetId, label: feature.label, level: "error", items };
  }

  // Missing required answers.
  const missing = preset.questions.filter((q) => q.required && isBlank(feature.options[q.key]));
  if (missing.length) {
    items.push({ level: "error", code: "missing-fields", message: `Needs answers: ${missing.map((m) => m.label).join(", ")}.` });
  }

  // Broken dependency: preset needs another preset present in the project.
  for (const dep of preset.dependsOn) {
    const present = project.features.some((f) => f.presetId === dep);
    if (!present) {
      const depName = getPreset(dep)?.name ?? dep;
      items.push({ level: "error", code: "broken-dependency", message: `Add "${depName}" first — this feature builds on it.` });
    }
  }

  // Export warnings: a chosen export target this preset can't produce.
  const unsupported = project.exportTargets.filter((t) => !preset.exports.includes(t));
  if (preset.exports.length && unsupported.length) {
    items.push({ level: "warn", code: "export-warning", message: `Won't appear in these exports: ${unsupported.join(", ")}.` });
  }

  // Raspberry Pi compatibility.
  if (!preset.pi && project.exportTargets.includes("raspberry-pi")) {
    items.push({ level: "warn", code: "pi-incompatible", message: "May not work on Raspberry Pi 5 (needs a desktop/CAD environment)." });
  }

  // Needs local data to be useful.
  if (preset.needsData) {
    items.push({ level: "warn", code: "needs-data", message: "Works best after you add some local data or examples." });
  }

  // Still being built (feature-flagged).
  if (preset.status === "planned") {
    items.push({ level: "warn", code: "planned", message: "Preview only for now — full build & export land in a later update." });
  } else if (preset.status === "preview") {
    items.push({ level: "warn", code: "preview", message: "Early version — core works; some options are still coming." });
  }

  if (!items.some((i) => i.level !== "ok")) {
    items.push({ level: "ok", code: "passed", message: "Passed validation — ready to build." });
  }

  return { instanceId: feature.instanceId, presetId: feature.presetId, label: feature.label, level: worst(items), items };
}

export interface ProjectHealth {
  level: HealthLevel;
  features: FeatureHealth[];
  summary: string;
  counts: { ok: number; warn: number; error: number };
}

export function checkProject(project: SoftwareProject): ProjectHealth {
  const features = project.features.map((f) => checkFeature(f, project));
  const counts = { ok: 0, warn: 0, error: 0 };
  for (const f of features) counts[f.level] += 1;
  const level: HealthLevel = counts.error ? "error" : counts.warn ? "warn" : "ok";
  const summary = features.length === 0
    ? "Empty project — drag a feature in to get started."
    : level === "error" ? `${counts.error} feature(s) need attention before building.`
    : level === "warn" ? "Ready to build, with a few notes to read."
    : "Everything passed — ready to build and export.";
  return { level, features, summary, counts };
}

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

export function readyToBuild(project: SoftwareProject): boolean {
  return project.features.length > 0 && checkProject(project).level !== "error";
}

// Exposed so the registry can render labels for the export "where possible" copy.
export function unsupportedHint(preset: Preset): string {
  if (!preset.pi) return "Desktop/CAD only — not for Raspberry Pi.";
  if (preset.needsData) return "Add local data to get the most out of it.";
  return "";
}
