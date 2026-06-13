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

  // recipe-book dependsOn recipe-card → broken dependency when alone
  let p2 = createProject("dep");
  p2 = addFeature(p2, "recipe-book");
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
  proj = addFeature(proj, "manual-creator"); // no required questions
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

test("backup: round-trips and rejects foreign files", () => {
  let proj = createProject("B");
  proj = addFeature(proj, "label-maker");
  const back = parseProjectBackup(serializeProject(proj));
  assert.equal(back.features.length, 1);
  assert.throws(() => parseProjectBackup("not json"), /valid JSON/);
  assert.throws(() => parseProjectBackup(JSON.stringify({ tag: "other" })), /software-project backup/);
});
