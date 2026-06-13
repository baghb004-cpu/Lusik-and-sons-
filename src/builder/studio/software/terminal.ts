// ============================================================
// Software Creation Mode (§31) — safe advanced terminal (pure interpreter)
// ============================================================
// A simplified, friendly "dumb terminal" for Advanced Mode. It is NOT a real
// shell: no process spawn, no filesystem, no network. It only reads/writes the
// in-memory SoftwareProject and reports on the registry/health. Every command
// is an allow-listed verb; anything else returns a help hint. Mutating commands
// return a new project (the UI commits it, which keeps auto-save + rollback in
// the normal path).
// ============================================================

import { addFeature, removeFeature, rollbackTo, canRollback } from "./engine.ts";
import { checkProject } from "./health.ts";
import { previewAdd } from "./preview.ts";
import { buildProject } from "./codegen.ts";
import { PRESETS, getPreset } from "./registry.ts";
import type { SoftwareProject } from "./schemas.ts";

export interface TerminalResult {
  output: string;             // text to print
  project?: SoftwareProject;  // present only if the command changed the project
  level?: "ok" | "warn" | "error";
}

const HELP = [
  "Safe project console — type a command:",
  "  help                 show this help",
  "  status               project summary + health",
  "  ls | features        list features you've added",
  "  presets [category]   list available presets",
  "  health               full feature health check",
  "  preview <presetId>   see what adding a preset would do (no changes)",
  "  add <presetId>       add a preset (creates a rollback point)",
  "  rm <instanceId>      remove a feature (creates a rollback point)",
  "  rollback [id]        undo to the last (or a chosen) checkpoint",
  "  export-check         check the project against its export targets",
  "  build                build the project + list what it produced",
  "  out                  list the generated files (after a build)",
  "  cat <path>           print a generated file (inspect the code/artifact)",
  "  test                 run the built-in validation checks",
  "  repair               auto-remove broken/dangling features",
  "  clear                clear the console",
  "",
  "This console is local and offline. It can't touch your computer's files.",
].join("\n");

export function runCommand(project: SoftwareProject, line: string): TerminalResult {
  const trimmed = line.trim();
  if (!trimmed) return { output: "" };
  const [cmd, ...rest] = trimmed.split(/\s+/);
  const arg = rest.join(" ").trim();

  switch (cmd.toLowerCase()) {
    case "help": case "?": return { output: HELP };
    case "clear": case "cls": return { output: "\f" }; // UI treats \f as "clear"

    case "status": {
      const h = checkProject(project);
      return {
        output: [
          `Project: ${project.name}  (mode: ${project.mode})`,
          `Features: ${project.features.length}   Export targets: ${project.exportTargets.join(", ") || "none"}`,
          `Checkpoints: ${project.history.length}`,
          `Health: ${h.level.toUpperCase()} — ${h.summary}`,
        ].join("\n"),
        level: h.level,
      };
    }

    case "ls": case "features": {
      if (!project.features.length) return { output: "No features yet. Drag one in, or: add <presetId>" };
      return { output: project.features.map((f) => `  ${f.instanceId}  ${f.label}  (${f.presetId})`).join("\n") };
    }

    case "presets": {
      const rows = arg ? PRESETS.filter((p) => p.categoryId === arg) : PRESETS;
      if (!rows.length) return { output: `No presets in category "${arg}".`, level: "warn" };
      return { output: rows.map((p) => `  ${p.id}  — ${p.name} [${p.status}]`).join("\n") };
    }

    case "health": {
      const h = checkProject(project);
      if (!h.features.length) return { output: h.summary };
      const body = h.features.map((f) =>
        `  [${f.level.toUpperCase()}] ${f.label}\n${f.items.map((i) => `      - ${i.message}`).join("\n")}`,
      ).join("\n");
      return { output: `${h.summary}\n${body}`, level: h.level };
    }

    case "preview": {
      if (!arg) return { output: "Usage: preview <presetId>", level: "warn" };
      const pv = previewAdd(project, arg);
      const lines = [...pv.changes, ...(pv.warnings.length ? ["", "Heads-up:", ...pv.warnings.map((w) => `  ! ${w}`)] : [])];
      return { output: lines.join("\n"), level: pv.ok ? "ok" : "warn" };
    }

    case "add": {
      if (!arg) return { output: "Usage: add <presetId>", level: "warn" };
      if (!getPreset(arg)) return { output: `Unknown preset "${arg}". Try: presets`, level: "error" };
      const next = addFeature(project, arg);
      return { output: `Added "${getPreset(arg)!.name}". (checkpoint saved — rollback to undo)`, project: next, level: "ok" };
    }

    case "rm": case "remove": {
      if (!arg) return { output: "Usage: rm <instanceId>", level: "warn" };
      if (!project.features.some((f) => f.instanceId === arg)) return { output: `No feature with id "${arg}". Try: ls`, level: "error" };
      return { output: `Removed ${arg}. (checkpoint saved)`, project: removeFeature(project, arg), level: "ok" };
    }

    case "rollback": case "undo": {
      if (!canRollback(project)) return { output: "Nothing to roll back to yet.", level: "warn" };
      return { output: arg ? `Rolled back to ${arg}.` : "Rolled back to the last checkpoint.", project: rollbackTo(project, arg || undefined), level: "ok" };
    }

    case "export-check": {
      const h = checkProject(project);
      const exportWarns = h.features.flatMap((f) => f.items.filter((i) => i.code === "export-warning" || i.code === "pi-incompatible").map((i) => `  ! ${f.label}: ${i.message}`));
      if (!project.exportTargets.length) return { output: "No export targets selected.", level: "warn" };
      return {
        output: [`Export targets: ${project.exportTargets.join(", ")}`, exportWarns.length ? exportWarns.join("\n") : "  All features support the selected targets."].join("\n"),
        level: exportWarns.length ? "warn" : "ok",
      };
    }

    case "build": {
      const out = buildProject(project);
      const files = Object.keys(out.files);
      const lines = [`Built ${files.length} file(s):`, ...files.map((p) => `  ${p}`)];
      if (out.warnings.length) lines.push("", "Notes:", ...out.warnings.map((w) => `  ! ${w}`));
      lines.push("", "Use: cat <path> to inspect a file.");
      return { output: lines.join("\n"), level: out.warnings.length ? "warn" : "ok" };
    }

    case "out": case "ls-out": {
      const files = Object.keys(buildProject(project).files);
      return { output: files.length ? files.map((p) => `  ${p}`).join("\n") : "Nothing to build yet." };
    }

    case "cat": {
      if (!arg) return { output: "Usage: cat <path>  (try: out)", level: "warn" };
      const files = buildProject(project).files;
      const content = files[arg];
      if (content == null) return { output: `No generated file "${arg}". Try: out`, level: "error" };
      const lines = content.split("\n");
      const shown = lines.slice(0, 60).join("\n");
      return { output: shown + (lines.length > 60 ? `\n… (${lines.length - 60} more lines)` : "") };
    }

    case "test": {
      const h = checkProject(project);
      return { output: `Validation: ${h.counts.ok} passed, ${h.counts.warn} warnings, ${h.counts.error} errors.`, level: h.level };
    }

    case "repair": {
      const dangling = project.features.filter((f) => !getPreset(f.presetId));
      if (!dangling.length) return { output: "Nothing to repair — no broken features." };
      let next = project;
      for (const f of dangling) next = removeFeature(next, f.instanceId);
      return { output: `Repaired: removed ${dangling.length} broken feature(s). (checkpoint saved)`, project: next, level: "ok" };
    }

    default:
      return { output: `Unknown command "${cmd}". Type "help".`, level: "warn" };
  }
}

export const TERMINAL_HELP = HELP;
