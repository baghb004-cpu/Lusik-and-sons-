# §29 — Game Lab (offline mini-game builder → Godot projects)

*Status: Phases 1–2 BUILT + verified. Phase 1 = the offline engine (data model,
presets, logic blocks, the local "vibe" intent parser, the Godot/GDScript code
generator, safety rails). Phase 2 = the UI at /tools/game-lab: a drag-and-drop
canvas scene editor + full per-object inspector, asset import (TextureRect),
complete controllers for every kind, a 2D/3D toggle with a minimal Node3D
generator, and save flows (template library + 'Save to drive' via the
admin-gated app/api/builder/gamelab). Remaining (Phase 4): richer 3D per kind,
.glb model import, multi-level, the optional Python sandbox, C#/C++ paths.
Offline-first, beginner-first, zero-royalty.*

## Name

**Game Lab** (subtitle "Mini Game Builder"). Chosen so it does NOT collide with
the existing **Game Mode** (the gamified launcher) or the **Retro Game Room**
(playing user-owned games). Game Lab is about *authoring* small original games
and exporting real **Godot** projects.

## What it is (and isn't)

- An OPTIONAL extra mode inside the same Workshop — the website/app builder stays
  the main product and the source of truth for saving/exporting/UI.
- It lets a beginner assemble a small playable 2D game from presets +
  drag-and-drop objects + beginner logic blocks + plain-English "vibe" prompts,
  then **export a clean, commented Godot/GDScript project** they fully own.
- It is NOT a new game engine and NOT a rewrite of the app. The heavy lifting
  (running/exporting the actual game) is Godot's job, offline, on the user's
  machine. We generate the project; Godot opens/exports it.

## Why Godot (default), and the language tiers

- **Godot 4** — free, open-source (MIT), no royalties, lightweight, great 2D.
  Maximum ownership, zero licensing drama. (Not Unreal: overkill + royalty terms;
  not Unity: licensing risk + heavier.) Godot is the export TARGET, a companion,
  not the app.
- **GDScript** — the generated game language: simple, native, readable. Every
  generated script is commented for beginners (the "learn from the code" goal).
- **C# / C++ (GDExtension)** — a LATER advanced export path; not in v1.
- **Python** — optional helper tooling ONLY (asset/JSON processing, an optional
  separate "Python Mini Game Sandbox"), never the main game runtime.

## Module architecture (`src/builder/gamelab/`)

```
schemas.ts     GameProject, Scene, Entity, Component, Rule(Event→Action),
               Difficulty, ExportProfile, GameKind — the local data model
objects.ts     the draggable object catalog (player, coin, enemy, spike, key,
               door, platform, …) with default size + placeholder color/shape
blocks.ts      the beginner logic-block catalog (When player touches coin → add
               score, …) — Event ids, Action ids, human labels
presets.ts     preset GameProjects (platformer, top-down, endless-runner, space-
               shooter, dodge, clicker, quiz, memory, puzzle, visual-novel)
difficulty.ts  easy/normal/hard/custom → tuning multipliers over settings
safety.ts      the guardrail: refuse franchise clones / named characters / maps
               / logos and harmful intent; keep games ORIGINAL + user-owned
vibe.ts        the offline intent parser: text → {kind, objects, rules,
               difficulty, style} → build or MODIFY a GameProject + plain notes
codegen.ts     pure GameProject → file map (project.godot, scenes/Main.tscn,
               scripts/*.gd commented, game_config.json, README.md, LICENSES.md)
index.ts       barrel
```

Tests: `src/builder/__tests__/gamelab.test.ts` — vibe parsing (kind/objects/
difficulty), safety refusals, difficulty math, preset integrity (schema), and
codegen (deterministic; emits the expected files; project.godot points at the
main scene; GDScript carries beginner comments; placeholder-only assets).

## Data model (zod) — kept deliberately simple

- **GameKind** = `platformer | top-down | endless-runner | space-shooter | dodge
  | clicker | quiz | memory | puzzle | visual-novel` (more added as data later).
- **Entity** `{ id, type, name, x, y, w, h, color, props? }` — placed objects;
  visuals are placeholder shapes (license-safe) until the user imports their own.
- **Rule** `{ id, when: EventId, then: ActionId, params? }` — a logic block.
- **GameProject** `{ id, name, kind, dimension:"2d", style, difficulty,
  settings: Record<string, number|string|boolean>, entities: Entity[],
  rules: Rule[], ui: {score,health,timer,winScreen,...} }`.
- **ExportProfile** `{ target: "godot-project" | "zip" | "config-json" |
  "template", … }`.

## Vibe Coding panel (offline intent/template system)

No cloud AI. `vibe.ts` is a transparent matcher:
1. **safety.ts first** — if the text names a franchise/character/logo or asks for
   something harmful, refuse with a kind "let's keep it original" message.
2. Detect **kind** (keywords → GameKind), **objects** (coin/enemy/spike/key/…),
   **rules** (collect N, avoid X, reach goal, timer), **difficulty** (easier/
   harder, "slower", "jump higher"), **style**.
3. Either **build** a new GameProject from the matching preset + detected
   objects/rules, or **modify** the current one (e.g. "make the enemy slower" →
   lower `enemySpeed`). Returns the project + a `notes[]` list explaining exactly
   what it changed (honest + teachable).

Example: "Make a platformer where the player collects coins and avoids spikes"
→ platformer preset + coins + spikes + a "collect coins / spike damage / game
over / win" rule set + score UI.

## Code generation (the heart, pure + tested)

`codegen(project)` → a `Map<path, content>` for a real Godot 4 project:

```
/game-project
  project.godot          (config_version=5, main_scene, window size, input map)
  /scenes/Main.tscn      (Node2D root + the generated script)
  /scripts/Main.gd       (COMMENTED; builds the level + entities + rules)
  /scripts/*.gd          (extra controllers where helpful)
  /assets  /audio  /ui    (placeholder shapes; user drops their own here)
  game_config.json       (the serialized GameProject — re-importable)
  README.md  LICENSES.md  .gitignore
```

v1 keeps `.tscn` minimal (root + script) and puts the readable, commented game
logic in **GDScript** — which is also exactly what the in-app **code viewer**
shows for learning. Placeholder visuals are `ColorRect`/shapes (no copyrighted
assets, ever). Per-kind commented controllers ship for the core kinds first
(platformer, dodge, clicker, quiz); the rest generate a valid project + a clear
scaffold to fill in (honest, and trivially extended by adding a controller).

## UI structure (built after the engine; light, not a full engine UI)

`/tools/game-lab` → **Dashboard** (pick a preset, or "Vibe build" a prompt) →
**Builder workspace**: scene preview (canvas), object/asset panel, object
inspector (name/type/position/size/color/speed/health/score/…), logic panel
(add/remove rules), difficulty control, the **Vibe Coding** panel, a **code
viewer** ("explain this code" offline notes + reset + diff), Preview note, and
**Export** (download Godot ZIP / save config / save as template). Mobile- and
desktop-friendly, accessible. Trackers/projects persist in localStorage; export
is a client-side ZIP (or "save to drive" when launched in the Workshop).

## Licensing screen (built in)

Explains: Godot's MIT engine license, that placeholder assets are safe/generic,
that imported content stays the user's, that the EXPORTED project is theirs, and
bundles third-party notices + required license text in `LICENSES.md`.

## Beginner tutorial (built in)

"Make your first platformer": add a player → add coins → add enemies → add a
goal → press play (in Godot) → export. Short, offline, step-by-step.

## Safety rails (enforced by safety.ts + content)

No clones of copyrighted games; no franchise names/characters/maps/music/logos;
no malware/cheats/miners. Generated games stay original, simple, user-owned. The
vibe parser refuses such requests with a friendly redirect.

## Phases (don't over-engineer)

1. **Offline engine** *(now)*: schemas, objects, blocks, presets, difficulty,
   safety, vibe, codegen + tests.
2. **UI**: dashboard, builder workspace, vibe panel, code viewer, export,
   licensing + tutorial screens, the `/tools/game-lab` route.
3. **Export wiring**: client ZIP (dynamic jszip) + optional "save to drive" API
   (fs-mode, admin-gated) writing into `portable/games/<name>/`; reuse the staged
   Godot from the Retro/Game-Mode installer for optional local export builds.
4. **More kinds + polish**: full controllers for the remaining presets, simple
   3D, asset import pipeline, the optional Python Mini Game Sandbox, C#/C++
   advanced export paths.
