// Software Creation Mode (§31) foundation: registry integrity, the pure
// project engine + rollback, Feature Health Check, the Safe Build Preview
// sandbox (must not mutate), and the safe terminal interpreter.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CATEGORIES, PRESETS, assertRegistry, getPreset, presetsInCategory,
} from "../studio/software/registry.ts";
import {
  createProject, addFeature, removeFeature, renameFeature, setFeatureOption,
  setExportTargets, rollbackTo, canRollback, serializeProject, parseProjectBackup,
} from "../studio/software/engine.ts";
import { checkProject, checkFeature, readyToBuild } from "../studio/software/health.ts";
import { previewAdd } from "../studio/software/preview.ts";
import { runCommand } from "../studio/software/terminal.ts";
import { buildProject, hasGenerator, generateFeature } from "../studio/software/codegen.ts";

test("registry: validates, covers all six categories, ids unique, deps resolve", () => {
  assert.equal(assertRegistry(), true);
  assert.equal(CATEGORIES.length, 6);
  const ids = PRESETS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, "preset ids must be unique");
  // every category has at least one preset
  for (const c of CATEGORIES) assert.ok(presetsInCategory(c.id).length > 0, `category ${c.id} has presets`);
  // every dependsOn points at a real preset
  for (const p of PRESETS) for (const d of p.dependsOn) assert.ok(getPreset(d), `${p.id} dep ${d} exists`);
});

test("engine: add creates a feature + a rollback point; remove + rename + options", () => {
  let proj = createProject("Test");
  assert.equal(proj.features.length, 0);
  proj = addFeature(proj, "label-maker");
  assert.equal(proj.features.length, 1);
  assert.equal(proj.history.length, 1, "add pushes a checkpoint");
  const f = proj.features[0];
  proj = renameFeature(proj, f.instanceId, "My labels");
  assert.equal(proj.features[0].label, "My labels");
  proj = setFeatureOption(proj, f.instanceId, "shape", "round");
  assert.equal(proj.features[0].options.shape, "round");
  proj = removeFeature(proj, f.instanceId);
  assert.equal(proj.features.length, 0);
  assert.equal(getPreset("nope"), undefined);
  assert.throws(() => addFeature(proj, "does-not-exist"), /Unknown preset/);
});

test("engine: rollback restores prior feature set and is itself undoable", () => {
  let proj = createProject("RB");
  proj = addFeature(proj, "label-maker");
  proj = addFeature(proj, "recipe-card");
  assert.equal(proj.features.length, 2);
  assert.ok(canRollback(proj));
  proj = rollbackTo(proj); // undo the recipe-card add
  assert.equal(proj.features.length, 1);
  assert.equal(proj.features[0].presetId, "label-maker");
  // rolling back again (the redo checkpoint) brings recipe-card back
  proj = rollbackTo(proj);
  assert.equal(proj.features.length, 2);
});

test("health: missing required field is an error; broken dependency flagged", () => {
  let proj = createProject("H");
  proj = addFeature(proj, "label-maker"); // has a required 'title' + 'shape'
  let h = checkProject(proj);
  assert.equal(h.level, "error", "required fields unanswered");
  const f = proj.features[0];
  proj = setFeatureOption(proj, f.instanceId, "title", "Flour");
  proj = setFeatureOption(proj, f.instanceId, "shape", "round");
  h = checkProject(proj);
  assert.notEqual(h.level, "error", "required answered → no error");

  // submittal-package dependsOn cut-sheet → broken dependency when alone
  let p2 = createProject("dep");
  p2 = addFeature(p2, "submittal-package");
  const fh = checkFeature(p2.features[0], p2);
  assert.ok(fh.items.some((i) => i.code === "broken-dependency"));
});

test("health: pi-incompatible warns only when raspberry-pi is a target", () => {
  let proj = createProject("pi");
  proj = addFeature(proj, "lisp-creator"); // pi:false
  let h = checkFeature(proj.features[0], proj);
  assert.ok(!h.items.some((i) => i.code === "pi-incompatible"), "no pi target → no warning");
  proj = setExportTargets(proj, ["raspberry-pi"]);
  h = checkFeature(proj.features[0], proj);
  assert.ok(h.items.some((i) => i.code === "pi-incompatible"));
});

test("preview: sandbox does not mutate the project; reports changes", () => {
  const proj = createProject("PV");
  const before = JSON.stringify(proj);
  const pv = previewAdd(proj, "label-maker");
  assert.equal(JSON.stringify(proj), before, "previewAdd must not mutate input");
  assert.equal(proj.features.length, 0, "original still empty");
  assert.equal(pv.candidate.features.length, 1, "candidate has the feature");
  assert.ok(pv.changes.some((c) => c.includes("Make Labels")));
  assert.ok(previewAdd(proj, "nope").ok === false);
});

test("readyToBuild: false when empty or has errors, true once clean", () => {
  let proj = createProject("R");
  assert.equal(readyToBuild(proj), false, "empty");
  proj = addFeature(proj, "manual-creator");
  assert.equal(readyToBuild(proj), false, "required fields unanswered");
  const f = proj.features[0];
  proj = setFeatureOption(proj, f.instanceId, "title", "How to seat a faucet");
  proj = setFeatureOption(proj, f.instanceId, "steps", "Shut off water\nRemove old faucet");
  assert.equal(readyToBuild(proj), true);
});

test("terminal: help/status/ls/add/rm/rollback are safe and update the project", () => {
  let proj = createProject("T");
  assert.match(runCommand(proj, "help").output, /Safe project console/);
  assert.match(runCommand(proj, "status").output, /Project: T/);

  const add = runCommand(proj, "add manual-creator");
  assert.ok(add.project, "add returns a new project");
  proj = add.project!;
  assert.equal(proj.features.length, 1);

  assert.match(runCommand(proj, "ls").output, /manual-creator/);
  assert.equal(runCommand(proj, "add bogus").level, "error");

  const rb = runCommand(proj, "rollback");
  proj = rb.project!;
  assert.equal(proj.features.length, 0, "rollback undid the add");

  // unknown verbs never throw, just hint
  assert.equal(runCommand(proj, "rm -rf /").level, "error"); // rm with bad id → error, no fs touched
  assert.match(runCommand(proj, "sudo reboot").output, /Unknown command/);
});

test("codegen: ready presets build self-contained offline files + manifest", () => {
  let proj = createProject("Build");
  proj = addFeature(proj, "label-maker");
  const f = proj.features[0];
  proj = setFeatureOption(proj, f.instanceId, "title", "Flour");
  proj = setFeatureOption(proj, f.instanceId, "shape", "round");
  assert.ok(hasGenerator("label-maker"));
  assert.ok(!hasGenerator("not-a-real-preset"));
  const files = generateFeature(proj.features[0]);
  const htmlPath = Object.keys(files).find((p) => p.endsWith("index.html"))!;
  assert.match(files[htmlPath], /Flour/);
  assert.ok(!files[htmlPath].includes("http://") && !files[htmlPath].includes("https://"), "no CDN/network refs");

  const out = buildProject(proj);
  assert.ok(out.files["manifest.json"] && out.files["README.md"]);
  assert.equal(out.warnings.length, 0, "all features buildable");
});

test("codegen: features without a generator are skipped with an honest warning", () => {
  const proj = createProject("Mixed");
  // simulate a future not-yet-buildable feature (no generator registered)
  const withFeat = { ...proj, features: [{ instanceId: "x1", presetId: "future-thing", label: "Future Thing", options: {}, addedAt: 0 }] };
  const out = buildProject(withFeat);
  assert.ok(out.warnings.some((w) => /preview-stage/.test(w)));
  assert.equal(out.manifest.features[0].built, false);
});

test("codegen: html output escapes user text (no injection)", () => {
  let proj = createProject("Esc");
  proj = addFeature(proj, "recipe-card");
  const f = proj.features[0];
  proj = setFeatureOption(proj, f.instanceId, "dish", "<script>x</script>");
  const files = generateFeature(proj.features[0]);
  const html = files[Object.keys(files).find((p) => p.endsWith("index.html"))!];
  assert.ok(!html.includes("<script>x"), "user text must be escaped");
  assert.match(html, /&lt;script&gt;/);
});

test("codegen: LISP creator emits a real commented routine + README", () => {
  let proj = createProject("CAD");
  proj = addFeature(proj, "lisp-creator");
  const f = proj.features[0];
  proj = setFeatureOption(proj, f.instanceId, "trade", "plumbing");
  proj = setFeatureOption(proj, f.instanceId, "goal", "freeze layers");
  proj = setFeatureOption(proj, f.instanceId, "layers", "A-WALL, A-DOOR");
  const files = generateFeature(proj.features[0]);
  const lsp = files[Object.keys(files).find((p) => p.endsWith("routine.lsp"))!];
  assert.match(lsp, /\(defun c:PLBFREEZE/);
  assert.match(lsp, /A-WALL/);
  assert.match(lsp, /APPLOAD/);
  assert.ok(Object.keys(files).some((p) => p.endsWith("README.md")));
});

test("codegen: schedules emit an HTML table + CSV from piped rows", () => {
  let proj = createProject("Sch");
  proj = addFeature(proj, "fixture-schedule");
  const f = proj.features[0];
  proj = setFeatureOption(proj, f.instanceId, "rows", "P-1 | Water closet | AS 2234\nP-2 | Lavatory | Kohler K-1");
  const files = generateFeature(proj.features[0]);
  const csv = files[Object.keys(files).find((p) => p.endsWith(".csv"))!];
  assert.match(csv, /Water closet/);
  assert.match(csv, /Tag,Description/);
  const html = files[Object.keys(files).find((p) => p.endsWith(".html"))!];
  assert.match(html, /<table>/);
});

test("codegen: data apps embed seed safely (no </script> breakout)", () => {
  let proj = createProject("Data");
  proj = addFeature(proj, "lookup-table");
  const f = proj.features[0];
  proj = setFeatureOption(proj, f.instanceId, "tableName", "Materials");
  proj = setFeatureOption(proj, f.instanceId, "pairs", "PVC | Polyvinyl </script> chloride");
  const files = generateFeature(proj.features[0]);
  const html = files[Object.keys(files).find((p) => p.endsWith("index.html"))!];
  assert.ok(!html.includes("</script> chloride"), "seed must not break out of the script tag");
  assert.ok(html.includes("localStorage"), "table app persists locally");
  assert.ok(!/src=["']https?:/.test(html), "no external scripts");
});

test("codegen: business/games generators produce expected offline output", () => {
  // Food truck must carry the local-rules disclaimer.
  let ft = createProject("FT"); ft = addFeature(ft, "food-truck");
  ft = setFeatureOption(ft, ft.features[0].instanceId, "concept", "Tacos");
  const ftHtml = generateFeature(ft.features[0])[`${"tacos"}/index.html`] ?? Object.values(generateFeature(ft.features[0]))[0];
  assert.match(ftHtml, /vary by location/i);

  // Pricing calculator is a self-contained offline calc.
  let pc = createProject("PC"); pc = addFeature(pc, "pricing-calculator");
  const pcHtml = Object.values(generateFeature(pc.features[0]))[0];
  assert.match(pcHtml, /Suggested price/);
  assert.ok(!/https?:\/\//.test(pcHtml), "no network refs");

  // Card sheet escapes user text.
  let tcg = createProject("TCG"); tcg = addFeature(tcg, "tcg-maker");
  tcg = setFeatureOption(tcg, tcg.features[0].instanceId, "cards", "<b>Hero</b> | Unit | 5/5 | Strikes first");
  const tcgHtml = Object.values(generateFeature(tcg.features[0]))[0];
  assert.ok(!tcgHtml.includes("<b>Hero</b>"), "card text escaped");
  assert.match(tcgHtml, /&lt;b&gt;Hero/);
});

test("codegen: 3D design emits valid OBJ + ASCII STL + offline preview", () => {
  let proj = createProject("3D");
  proj = addFeature(proj, "design-3d");
  const f = proj.features[0];
  proj = setFeatureOption(proj, f.instanceId, "shape", "box");
  const files = generateFeature(proj.features[0]);
  const obj = files[Object.keys(files).find((p) => p.endsWith("model.obj"))!];
  const stl = files[Object.keys(files).find((p) => p.endsWith("model.stl"))!];
  assert.equal((obj.match(/^v /gm) || []).length, 8, "box has 8 vertices");
  assert.equal((obj.match(/^f /gm) || []).length, 12, "box has 12 triangles");
  assert.match(stl, /^solid /);
  assert.match(stl, /facet normal/);
  assert.equal((stl.match(/endfacet/g) || []).length, 12);
  const html = files[Object.keys(files).find((p) => p.endsWith("index.html"))!];
  assert.ok(!/https?:\/\//.test(html), "preview has no network refs");
});

test("codegen: 3D text extrudes the font into a real multi-box mesh", () => {
  let proj = createProject("3DT");
  proj = addFeature(proj, "design-3d");
  const f = proj.features[0];
  proj = setFeatureOption(proj, f.instanceId, "shape", "text");
  proj = setFeatureOption(proj, f.instanceId, "text", "AB");
  const files = generateFeature(proj.features[0]);
  const obj = files[Object.keys(files).find((p) => p.endsWith("model.obj"))!];
  const verts = (obj.match(/^v /gm) || []).length;
  const faces = (obj.match(/^f /gm) || []).length;
  // each filled font cell = a box (8 verts, 12 tris); "AB" has many filled cells
  assert.ok(verts > 80 && verts % 8 === 0, `text mesh has whole boxes (${verts} verts)`);
  assert.equal(faces, (verts / 8) * 12, "12 tris per box");
});

test("codegen: embroidery chart is honest about machine files", () => {
  let proj = createProject("Emb");
  proj = addFeature(proj, "embroidery");
  proj = setFeatureOption(proj, proj.features[0].instanceId, "title", "Lusik");
  const html = Object.values(generateFeature(proj.features[0]))[0];
  assert.match(html, /cross-stitch/i);
  assert.match(html, /not a machine embroidery file|not.*generated yet/i);
  assert.match(html, /Finished size/);
});

test("registry: every 'ready' preset has a generator (export presets exempt)", () => {
  for (const p of PRESETS) if (p.status === "ready" && p.categoryId !== "export")
    assert.ok(hasGenerator(p.id), `${p.id} is ready but has no generator`);
});

test("export presets: adding sets the target; build emits packaging", () => {
  // Raspberry Pi card → pi target on + start.sh/README packaged.
  let proj = createProject("PiTest");
  proj = addFeature(proj, "label-maker");
  proj = setFeatureOption(proj, proj.features[0].instanceId, "title", "Flour");
  proj = setFeatureOption(proj, proj.features[0].instanceId, "shape", "round");
  proj = addFeature(proj, "export-raspberry-pi");
  assert.ok(proj.exportTargets.includes("raspberry-pi"), "adding the card sets the target");
  const out = buildProject(proj);
  assert.ok(out.files["raspberry-pi/start.sh"] && out.files["raspberry-pi/README.md"]);
  assert.match(out.files["raspberry-pi/start.sh"], /kiosk/);
  // thumb-drive default → launcher index.html linking the built feature page
  assert.ok(out.files["index.html"], "launcher page generated");
  assert.match(out.files["index.html"], /make-labels\/index\.html/);
  assert.match(out.files["make-labels/index.html"], /Flour/);
  // export-category features are NOT reported as preview-stage warnings
  assert.ok(!out.warnings.some((w) => /Raspberry Pi/.test(w)));
});

test("terminal: build/out/cat inspect generated artifacts", () => {
  let proj = createProject("Term");
  proj = addFeature(proj, "label-maker");
  proj = setFeatureOption(proj, proj.features[0].instanceId, "title", "Flour");
  proj = setFeatureOption(proj, proj.features[0].instanceId, "shape", "round");
  assert.match(runCommand(proj, "build").output, /Built \d+ file/);
  assert.match(runCommand(proj, "out").output, /index\.html|manifest\.json/);
  const cat = runCommand(proj, "cat manifest.json");
  assert.match(cat.output, /"exportTargets"/);
  assert.equal(runCommand(proj, "cat nope.txt").level, "error");
});

test("backup: round-trips and rejects foreign files", () => {
  let proj = createProject("B");
  proj = addFeature(proj, "label-maker");
  const back = parseProjectBackup(serializeProject(proj));
  assert.equal(back.features.length, 1);
  assert.throws(() => parseProjectBackup("not json"), /valid JSON/);
  assert.throws(() => parseProjectBackup(JSON.stringify({ tag: "other" })), /software-project backup/);
});
