// Game Lab (§29): the offline engine — presets, the vibe parser, safety rails,
// difficulty math, and the Godot code generator. All pure + local.
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import { gameProjectSchema, GAME_KINDS } from "../gamelab/schemas.ts";
import { makePreset, PRESET_LIST } from "../gamelab/presets.ts";
import { vibe, detectKind } from "../gamelab/vibe.ts";
import { checkRequest } from "../gamelab/safety.ts";
import { applyDifficulty } from "../gamelab/difficulty.ts";
import { generateProject } from "../gamelab/codegen.ts";

test("every kind has a schema-valid preset", () => {
  for (const kind of GAME_KINDS) {
    const p = makePreset(kind, `t-${kind}`);
    assert.ok(p, `preset for ${kind}`);
    gameProjectSchema.parse(p);
    assert.ok(p!.entities.length >= 1, `${kind} has entities`);
  }
  assert.equal(PRESET_LIST.length, GAME_KINDS.length);
});

test("vibe detects kind, objects, and the collect-N goal", () => {
  const r = vibe("Make a platformer where the player collects 10 coins and avoids spikes");
  assert.ok(r.ok && r.project);
  assert.equal(r.project!.kind, "platformer");
  assert.equal(r.project!.settings.scoreGoal, 10);
  assert.ok(r.project!.entities.some((e) => e.type === "coin"));
  assert.ok(r.project!.entities.some((e) => e.type === "spike"));
  assert.ok(r.notes.length > 0);
  assert.equal(detectKind("make a memory card matching game"), "memory");
  assert.equal(detectKind("a dodge game where objects fall from the sky"), "dodge");
});

test("vibe modifies an existing project (tweaks, not a rebuild)", () => {
  const base = makePreset("platformer", "g1")!;
  const before = Number(base.settings.enemySpeed);
  const r = vibe("make the enemy slower and let the player jump higher", base);
  assert.ok(r.ok && r.project);
  assert.equal(r.project!.id, "g1"); // same project, modified
  assert.ok(Number(r.project!.settings.enemySpeed) < before);
  assert.ok(Number(r.project!.settings.jumpForce) > Number(base.settings.jumpForce));
});

test("safety refuses franchise clones and harmful intent, with a redirect", () => {
  const mario = vibe("make a mario clone with the same levels");
  assert.equal(mario.ok, false);
  assert.ok(mario.safety && mario.safety.flagged === "mario");
  assert.ok(mario.notes.join(" ").toLowerCase().includes("own"));
  assert.equal(checkRequest("build a crypto miner game").ok, false);
  assert.equal(checkRequest("a platformer with a jumping robot").ok, true);
});

test("difficulty scales tunables both ways without mutating input", () => {
  const base = makePreset("dodge", "d1")!;
  const baseEnemy = Number(base.settings.enemySpeed ?? 80);
  const baseSettings = { ...base.settings };
  const hard = applyDifficulty(base, "hard");
  const easy = applyDifficulty(base, "easy");
  // dodge has spawnRate; hard raises it, easy lowers it
  assert.ok(Number(hard.settings.spawnRate) > Number(base.settings.spawnRate));
  assert.ok(Number(easy.settings.spawnRate) < Number(base.settings.spawnRate));
  assert.ok(Number(hard.settings.playerHealth) <= Number(base.settings.playerHealth));
  assert.deepEqual(base.settings, baseSettings); // input untouched
  assert.equal(applyDifficulty(base, "custom").difficulty, "custom");
  void baseEnemy;
});

test("codegen emits a runnable-shaped Godot project (placeholders only, commented)", () => {
  const p = vibe("Make a platformer where the player collects coins and avoids spikes").project!;
  const { files, mainScene } = generateProject(p);
  // required files exist
  for (const f of ["game-project/project.godot", "game-project/scenes/Main.tscn", "game-project/scripts/Main.gd", "game-project/game_config.json", "game-project/README.md", "game-project/LICENSES.md"]) {
    assert.ok(files[f] !== undefined, `has ${f}`);
  }
  assert.equal(mainScene, "game-project/scenes/Main.tscn");
  // project points at the main scene
  assert.ok(files["game-project/project.godot"].includes('run/main_scene="res://scenes/Main.tscn"'));
  // the scene references the script
  assert.ok(files["game-project/scenes/Main.tscn"].includes("res://scripts/Main.gd"));
  // GDScript carries beginner comments + the embedded config
  const gd = files["game-project/scripts/Main.gd"];
  assert.ok(gd.includes("# This is YOUR game"));
  assert.ok(gd.includes("const ENTITIES :="));
  assert.ok(gd.includes('"platformer"'));
  // config round-trips through the schema
  gameProjectSchema.parse(JSON.parse(files["game-project/game_config.json"]));
  // licensing is honest about Godot + originality
  assert.ok(/Godot/.test(files["game-project/LICENSES.md"]) && /original/i.test(files["game-project/LICENSES.md"]));
  // deterministic: same project → same files
  assert.deepEqual(generateProject(p).files, files);
});

test("3D dimension generates a Node3D project; sprites swap in a TextureRect", () => {
  const p3d = makePreset("top-down", "3d1")!;
  p3d.dimension = "3d";
  const gd3 = generateProject(p3d).files["game-project/scripts/Main.gd"];
  assert.ok(gd3.includes("extends Node3D"));
  assert.ok(gd3.includes("Camera3D") && gd3.includes("BoxMesh"));

  const p = makePreset("platformer", "spr1")!;
  p.entities[0].props = { ...p.entities[0].props, sprite: "hero.png" };
  const files = generateProject(p).files;
  assert.ok(files["game-project/scripts/Main.gd"].includes("TextureRect"));
  assert.ok(files["game-project/scripts/Main.gd"].includes('"hero.png"')); // referenced in embedded config
});

test("space-shooter + puzzle controllers are generated", () => {
  const shooter = generateProject(makePreset("space-shooter", "s1")!).files["game-project/scripts/Main.gd"];
  assert.ok(shooter.includes("_fire(") && shooter.includes("_update_shots("));
  const puzzle = generateProject(makePreset("puzzle", "pz1")!).files["game-project/scripts/Main.gd"];
  assert.ok(puzzle.includes("_check_buttons(") && puzzle.includes("_open_gates("));
  const runner = generateProject(makePreset("endless-runner", "r1")!).files["game-project/scripts/Main.gd"];
  assert.ok(runner.includes("_move_platformer(delta, true)")); // auto-run
});

test("click-based kinds generate input handling", () => {
  const clicker = generateProject(makePreset("clicker", "c1")!).files["game-project/scripts/Main.gd"];
  assert.ok(clicker.includes("_unhandled_input"));
  const platformer = generateProject(makePreset("platformer", "p1")!).files["game-project/scripts/Main.gd"];
  assert.ok(!platformer.includes("_unhandled_input")); // movement kinds don't
});
