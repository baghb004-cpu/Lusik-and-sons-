// ============================================================
// Software Creation Mode (§31, Phase 2/3) — codegen + project build
// ============================================================
// Turns a SoftwareProject into a real file map you can export and run offline.
// Each "ready" preset has a generator that emits self-contained, CDN-free
// HTML/CSS (print-ready). Presets without a generator yet are listed honestly
// in the README as "preview — not buildable yet". Pure: no IO, no network.
// The UI ZIPs `buildProject(project).files` via a dynamic jszip import.
// ============================================================

import { getPreset } from "./registry.ts";
import type { FeatureInstance, SoftwareProject } from "./schemas.ts";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "feature";
}
const PAGE_CSS =
  "*{box-sizing:border-box}body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#f5efe3;color:#1a1612}" +
  "main{max-width:760px;margin:0 auto;padding:24px}h1{font-size:1.6rem}@media print{body{background:#fff}.no-print{display:none}}";

type Generator = (f: FeatureInstance) => Record<string, string>;

// --- per-preset generators -------------------------------------------------

const labelMaker: Generator = (f) => {
  const shape = String(f.options.shape ?? "rectangle");
  const title = esc(f.options.title ?? "Label");
  const radius = shape === "round" || shape === "oval" ? "50%" : shape === "square" ? "8px" : "10px";
  const wh = shape === "round" || shape === "square" ? "180px;height:180px" : "260px;height:150px";
  const label = `<div style="display:inline-flex;align-items:center;justify-content:center;text-align:center;border:2px solid #1a1612;border-radius:${radius};width:${wh};margin:8px;padding:10px;font-weight:600">${title}</div>`;
  const sheet = Array.from({ length: 8 }, () => label).join("");
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — labels</title><style>${PAGE_CSS}</style></head>` +
    `<body><main><h1 class="no-print">${title} — printable labels</h1><p class="no-print">Press Ctrl/Cmd+P to print or save as PDF. Edit the text in the source if you like — everything is offline.</p><div>${sheet}</div></main></body></html>`;
  return { [`${slug(f.label)}/index.html`]: html };
};

const recipeCard: Generator = (f) => {
  const dish = esc(f.options.dish ?? f.label);
  const servings = esc(f.options.servings ?? "");
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${dish} — recipe card</title><style>${PAGE_CSS}.card{background:#fff;border:1px solid #e3d9c4;border-radius:16px;padding:24px}ul,ol{padding-left:20px}</style></head>` +
    `<body><main><div class="card"><h1>${dish}</h1>${servings ? `<p><strong>Servings:</strong> ${servings}</p>` : ""}` +
    `<h2>Ingredients</h2><ul><li>Add your ingredients here</li></ul>` +
    `<h2>Steps</h2><ol><li>Add your steps here</li></ol>` +
    `<p class="no-print" style="color:#7a7367">Edit this file to fill in ingredients and steps — it works offline and prints to PDF.</p></div></main></body></html>`;
  return { [`${slug(f.label)}/index.html`]: html };
};

const GENERATORS: Record<string, Generator> = {
  "label-maker": labelMaker,
  "recipe-card": recipeCard,
};

export function hasGenerator(presetId: string): boolean {
  return presetId in GENERATORS;
}

export function generateFeature(feature: FeatureInstance): Record<string, string> {
  const gen = GENERATORS[feature.presetId];
  return gen ? gen(feature) : {};
}

// --- whole-project build (the export manifest lives here) -------------------

export interface ProjectBuild {
  files: Record<string, string>;
  manifest: { name: string; generatedAt: string; features: Array<{ id: string; preset: string; built: boolean }>; exportTargets: string[] };
  warnings: string[];
}

export function buildProject(project: SoftwareProject): ProjectBuild {
  const files: Record<string, string> = {};
  const warnings: string[] = [];
  const manifestFeatures: ProjectBuild["manifest"]["features"] = [];

  for (const f of project.features) {
    const built = hasGenerator(f.presetId);
    manifestFeatures.push({ id: f.instanceId, preset: f.presetId, built });
    if (built) Object.assign(files, generateFeature(f));
    else warnings.push(`"${f.label}" is preview-stage — it isn't buildable yet, so it was skipped.`);
  }

  const manifest = {
    name: project.name,
    generatedAt: new Date().toISOString(),
    features: manifestFeatures,
    exportTargets: project.exportTargets,
  };
  files["manifest.json"] = JSON.stringify(manifest, null, 2);
  files["README.md"] = readme(project, manifestFeatures, warnings);
  return { files, manifest, warnings };
}

function readme(project: SoftwareProject, feats: ProjectBuild["manifest"]["features"], warnings: string[]): string {
  const builtList = feats.filter((f) => f.built).map((f) => `- ${getPreset(f.preset)?.name ?? f.preset} → \`${slug(project.features.find((x) => x.instanceId === f.id)!.label)}/index.html\``);
  const skipped = feats.filter((f) => !f.built).map((f) => `- ${getPreset(f.preset)?.name ?? f.preset} (preview — not buildable yet)`);
  return [
    `# ${project.name}`,
    "",
    "Built offline with Software Creation Mode. Everything here runs locally — open the HTML files in any browser, no internet needed.",
    "",
    "## Included",
    builtList.length ? builtList.join("\n") : "_Nothing buildable yet._",
    skipped.length ? `\n## Coming later\n${skipped.join("\n")}` : "",
    warnings.length ? `\n## Notes\n${warnings.map((w) => `- ${w}`).join("\n")}` : "",
    "",
    `Export targets selected: ${project.exportTargets.join(", ") || "none"}.`,
    "",
    "_Never stores payment card data. For payments, use an official processor (Square/Clover/Stripe)._",
  ].filter(Boolean).join("\n");
}
