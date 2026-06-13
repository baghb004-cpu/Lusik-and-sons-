// ============================================================
// Software Creation Mode (§31) — pure project engine
// ============================================================
// All committing operations return a NEW project (immutable). Every change
// that touches features pushes a bounded RollbackPoint first, so the UI can
// always "undo" to a known-good state. No IO here — persistence/backup is
// thin wrappers (io.ts) the UI calls.
// ============================================================

import {
  MAX_HISTORY, SOFTWARE_BACKUP_TAG, softwareProjectSchema,
  type ExportKind, type FeatureInstance, type RollbackPoint, type SoftwareProject,
} from "./schemas.ts";
import { getPreset } from "./registry.ts";

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function createProject(name = "My software project"): SoftwareProject {
  return softwareProjectSchema.parse({
    id: uid("proj"), name, mode: "beginner",
    features: [], exportTargets: ["thumb-drive"], history: [], updatedAt: Date.now(),
  });
}

function snapshot(project: SoftwareProject, reason: string): RollbackPoint {
  return {
    id: uid("rb"), at: Date.now(), reason,
    features: project.features.map((f) => ({ ...f, options: { ...f.options } })),
    exportTargets: [...project.exportTargets],
  };
}

// Push a rollback point + trim history to MAX_HISTORY (keep newest).
function withCheckpoint(project: SoftwareProject, reason: string): SoftwareProject {
  const history = [snapshot(project, reason), ...project.history].slice(0, MAX_HISTORY);
  return { ...project, history };
}

// Drop a preset into the project → a new feature instance (+ rollback point).
// Throws on unknown preset so the UI/terminal can surface a clear error.
export function addFeature(project: SoftwareProject, presetId: string): SoftwareProject {
  const preset = getPreset(presetId);
  if (!preset) throw new Error(`Unknown preset: ${presetId}`);
  const base = withCheckpoint(project, `add ${preset.name}`);
  const feature: FeatureInstance = {
    instanceId: uid("feat"), presetId, label: preset.name, options: {}, addedAt: Date.now(),
  };
  return { ...base, features: [...base.features, feature], updatedAt: Date.now() };
}

export function removeFeature(project: SoftwareProject, instanceId: string): SoftwareProject {
  if (!project.features.some((f) => f.instanceId === instanceId)) return project;
  const base = withCheckpoint(project, "remove feature");
  return { ...base, features: base.features.filter((f) => f.instanceId !== instanceId), updatedAt: Date.now() };
}

export function renameFeature(project: SoftwareProject, instanceId: string, label: string): SoftwareProject {
  const next = label.trim() || "Feature";
  return {
    ...project,
    features: project.features.map((f) => (f.instanceId === instanceId ? { ...f, label: next } : f)),
    updatedAt: Date.now(),
  };
}

export function setFeatureOption(project: SoftwareProject, instanceId: string, key: string, value: unknown): SoftwareProject {
  return {
    ...project,
    features: project.features.map((f) => (f.instanceId === instanceId ? { ...f, options: { ...f.options, [key]: value } } : f)),
    updatedAt: Date.now(),
  };
}

export function setExportTargets(project: SoftwareProject, targets: ExportKind[]): SoftwareProject {
  const base = withCheckpoint(project, "change export targets");
  return { ...base, exportTargets: [...new Set(targets)], updatedAt: Date.now() };
}

export function setMode(project: SoftwareProject, mode: "beginner" | "advanced"): SoftwareProject {
  return { ...project, mode, updatedAt: Date.now() };
}

export function canRollback(project: SoftwareProject): boolean {
  return project.history.length > 0;
}

// Restore a rollback point. If id omitted, restore the most recent one.
// The rolled-back-from state itself becomes a checkpoint so rollback is undoable.
export function rollbackTo(project: SoftwareProject, id?: string): SoftwareProject {
  if (project.history.length === 0) return project;
  const point = id ? project.history.find((h) => h.id === id) : project.history[0];
  if (!point) return project;
  const redo = snapshot(project, "before rollback");
  const remaining = project.history.filter((h) => h.id !== point.id);
  return {
    ...project,
    features: point.features.map((f) => ({ ...f, options: { ...f.options } })),
    exportTargets: [...point.exportTargets],
    history: [redo, ...remaining].slice(0, MAX_HISTORY),
    updatedAt: Date.now(),
  };
}

// --- backup / restore (move between devices / thumb drives) ---------------

export function serializeProject(project: SoftwareProject): string {
  return JSON.stringify({ tag: SOFTWARE_BACKUP_TAG, version: project.schemaVersion, project }, null, 2);
}

export function parseProjectBackup(text: string): SoftwareProject {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("That file isn't valid JSON."); }
  const obj = raw as { tag?: string; project?: unknown };
  if (!obj || obj.tag !== SOFTWARE_BACKUP_TAG) throw new Error("That isn't a software-project backup file.");
  return softwareProjectSchema.parse(obj.project);
}
