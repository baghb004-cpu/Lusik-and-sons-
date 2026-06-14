# §31 — Software Creation Mode ("visual vibe coding")

*Branch `claude/codebase-review-w50a0a`. Offline-first, on-device, thumb-drive
portable. This doc is the durable spec + architecture + phase tracker so any
future session can resume without re-deriving intent.*

> **Prime directive:** add a new mode; **do not** replace or break the existing
> website/app builder, exports, media tools, offline tools, or project
> save/load. Everything offline-first, no CDN, no cloud AI, no outside APIs for
> core features. Beginner-first; advanced is opt-in. Build in small, tested,
> reversible phases — never everything in one pass.

## What the owner asked for (captured verbatim-in-spirit)

A **Software Creation Mode** inside the offline builder where a beginner builds
real tools by **dragging big feature cards** from a side panel into a project,
answering plain-English questions, previewing, pressing build, and exporting —
"visual vibe coding." Flow a five-year-old gets:

> **Pick what you want → drag it in → choose simple options → preview it → press
> build → export it.**

Hide code/technical settings behind presets, categories, plain-English copy.
Beginner mode by default; **Advanced mode** lets power users inspect/edit code
and use a **safe, simplified Linux-style terminal** (approved local commands
only — inspect files, view logs, run tests/export-checks, trigger builds, run
repair, view health, shortcuts). Self-checking build system, **Safe Build
Preview** (sandbox before merge), **Feature Health Check**, rollback,
auto-save, local database/lookup-table system, Raspberry Pi 5 export profile.

### Preset categories (the left/right drag panel)

1. **Creative Tools** — Label Maker, Embroidery Design Maker, Recipe Card Maker,
   Recipe Book Maker, Manual Creator, 3D Design Tool.
2. **Business Tools** — Food Truck Starter, Small Business Planner, Inventory
   Tracker, Pricing Calculator, Customer Folder System, Printable Package Gen.
3. **Game Creation Tools** — Trading Card Game Maker, Board Game Maker, Rule Book
   Maker, Card Template Maker, Token/Dice Table Maker.
4. **Construction / Trade Tools** — Spec Writer, Fixture Schedule Generator,
   Equipment Schedule Generator, Cut Sheet Package Gen, Submittal Package Gen,
   AutoCAD LISP Routine Creator, Dynamo/Revit Automation Creator.
5. **Data / Local Assistant Tools** — Offline Database Builder, Lookup Table
   Builder, Q/Statement/Answer Generator, Local Knowledge Pack Builder,
   CSV/JSON Importer, Template Filler.
6. **Export Tools** — Thumb-Drive Runnable, Static Website, Web App, Desktop
   (where possible), Mobile (where possible), Raspberry Pi 5, Source Code, PDF,
   Image, 3D Model, Database.

Big preset names ("Make Pantry Labels", "Make Baby Bib Embroidery", "Make a Food
Truck Menu", "Make a Plumbing Fixture Schedule", "Make a Fire Sprinkler
Submittal Package", "Make an AutoCAD Cleanup Routine", "Make a Revit Schedule
Automation", "Make a Trading Card Game", "Make a Raspberry Pi Touchscreen App").

Dropping a preset auto-creates: UI screens, forms, local DB tables, local files,
templates, export settings, example content, docs, validation checks, preview
mode, **rollback point** — without manual wiring.

## Architecture (the safe design)

Reuses the **exact** module pattern the rest of Creation Studio uses, so it
can't destabilize anything else. Lives entirely under
`src/builder/studio/software/` + one route at `app/tools/software/`.

- **Pure engine + registry, zero React, fully unit-tested** — all logic
  (registry, project ops, health, preview sandbox, terminal interpreter) is
  pure TypeScript. React only renders it. Same split as `store`, `bizapp`, etc.
- **Preset registry = pure data** (`registry.ts`). Each preset is metadata: id,
  big name, icon, plain-English blurb, category/subcategory, `status`
  (`ready`/`preview`/`planned`), supported export targets, `pi` flag,
  `needsData`, `creates[]` (what it scaffolds, in plain English), `dependsOn[]`.
  Adding a preset = adding a data row, never touching the shell. This is the
  plugin/feature-registry boundary that "keeps features from breaking each
  other": a preset can only contribute through this typed contract.
- **Project model** (`schemas.ts`) — `SoftwareProject` = name + `features[]`
  (instances of presets with user options) + `exportTargets[]` + `history[]`
  (rollback snapshots) + `mode` (beginner/advanced). One localStorage key
  (`lusik_software_current`), zod-validated on read; backup/restore file for
  moving between devices/thumb drives. **No new global storage, no schema
  changes to the website/app builder.**
- **Validation pipeline / Feature Health Check** (`health.ts`) — pure functions
  map a feature+project to status: ready / missing fields / export warning /
  may-not-work-on-Pi / needs-more-local-data / broken-dependency / passed.
- **Safe Build Preview** (`preview.ts`) — a sandbox: `previewAdd` returns a
  *new* project + a plain-English change list + health, **without mutating** the
  committed project. UI merges only on confirm. This is the rollback-safe
  "test in a sandbox before merging" requirement.
- **Rollback** — every committing op pushes a `RollbackPoint` snapshot; `rollbackTo`
  restores. Bounded history (keeps last N).
- **Advanced terminal** (`terminal.ts`) — a pure command interpreter, **not** a
  real shell: `help, status, ls/features, presets, health, preview <id>,
  add <id>, rm <id>, rollback [id], export-check, test, repair, clear`. Returns
  text output (+ optional new project for mutating commands). No process spawn,
  no fs — safe by construction, offline by construction.
- **Local database / lookup-table system** (Phase 2) — reuses the `store`/`bizapp`
  record-store + encrypted-DB + CSV/JSON IO primitives already built, exposed as
  a "Data" preset family. No SQLite binary needed for the core; SQLite export is
  a later "where technically possible" target.
- **Export manifest** — each export target is a registry row with a `kind` and a
  `pi` capability; export codegen is added per-target in later phases (reusing
  jszip dynamic-import + the existing portable/export pipeline). No target ships
  until its codegen + tests exist (feature-flagged via `status`).
- **Bundle safety** — route is `dynamic(..., {ssr:false})`, `robots:{index:false}`,
  no `src/builder/editor/*` import (the budget sentinel enforces this), jszip is
  dynamic-imported. Native HTML5 drag-and-drop (no DnD library) to protect the
  210 KB first-load budget.
- **Beginner/advanced separation** — a single `mode` flag on the project; the
  terminal and code-inspection panels render only in advanced. Default beginner.

### Why this can't break the current builder

Additive only: a new folder, a new route, one registry row in
`studio/tools.ts`. No edits to `builder/editor/*`, the export system, the
project save/load, or shared schemas. The engine is pure and independently
tested; the route is isolated and noindexed. If the whole mode were deleted, the
rest of the app would be unchanged.

## Phase plan + status

- **Phase 1 — Foundation shell (DONE this session).** Preset registry + full
  category/subcategory taxonomy (all six categories, every listed preset as a
  typed row with status), project model + engine (create/add/remove/rename/
  options), rollback, Feature Health Check, Safe Build Preview sandbox, advanced
  terminal interpreter, the drag-and-drop UI shell with beginner/advanced
  toggle, localStorage auto-save + backup/restore, hub registration, tests.
  *All presets start as `planned`/`preview` stubs — they scaffold a feature
  instance and pass health checks, but per-preset codegen lands in later phases.*
- **Phase 2 — export manifest + codegen interface (DONE this session).**
  `codegen.ts` defines a per-preset generator contract + `buildProject()` that
  emits a real offline file map (`manifest.json` + `README.md` + per-feature
  self-contained HTML, no CDN), with honest "skipped — preview-stage" warnings.
  UI gained a **Build & Export (ZIP)** button (jszip dynamic import), gated on
  `readyToBuild`; `longtext` questions render as textareas.
- **Phase 3 — First real working presets (DONE).** Label Maker, Recipe Card,
  **Manual Creator**, and **Spec Writer** are `ready` with working codegen + ZIP
  export + tests. (Spec output is an honest CSI 3-part *draft* with a
  review-with-a-pro warning.)
- **Phase 4 — Trade automation (DONE).** All `ready` with generators + tests:
  **AutoCAD LISP Routine Creator** (emits real commented `.lsp` per trade+goal,
  freeze/purge/audit/prep, with APPLOAD instructions), **Dynamo/Revit**
  node-plan generator (honest markdown plan, not a version-locked `.dyn`),
  **Fixture + Equipment Schedule** generators (HTML table + CSV from piped
  rows), and **Cut Sheet / Submittal Package** builders (cover + ordered index +
  checklist).
- **Phase 2 data family (DONE).** `ready` with generators + tests: **Offline
  Database** + **Lookup Table** (standalone localStorage CRUD apps with search +
  CSV export, seed embedded safely against `</script>` breakout), **CSV/JSON
  Importer** (offline file→table viewer), **Template Filler** (offline
  mail-merge). *Still open in Phase 2:* deeper reuse of the `store`/`bizapp`
  encrypted-DB primitives; terminal log/artifact inspection.
- **Business + Games presets (DONE).** All `ready` with generators + tests:
  Pricing Calculator (offline calc app), Small Business Planner, Inventory
  Tracker + Customer Folders (localStorage apps), Printable Package, Food Truck
  Plan (menu table + checklist + **local-rules disclaimer**); Trading Card Game
  + Card Template (print-and-cut card sheets), Rule Book, Board Game (printable
  grid), Tokens & Dice; plus the Q&A Pack data app.
- **Export Tools (DONE).** Dropping an export card now turns on its target and
  `buildProject` emits real packaging: a **launcher `index.html`** linking every
  built tool (static-site / thumb-drive) + `START-HERE.txt`, a **web-app
  manifest**, and a **Raspberry Pi 5** `start.sh` (Chromium kiosk) + README with
  honest limits. PDF/image/source/database are available targets (print-to-PDF,
  the source ZIP, CSV from data apps). Desktop/Mobile/3D stay `preview` (need
  external tooling / the Phase-5 3D tool) — honest, not faked.
- **Phase 5 (3D) + Phase 6 (data) DONE; embroidery started.**
  - **3D Design/Export** is `ready`: box/cylinder/sphere **and extruded 3D text /
    nameplates** (reuses the 5×7 font), with a dependency-free canvas wireframe
    preview (drag to rotate) and **real `model.obj` + ASCII `model.stl`** exports
    (open in any slicer/3D app). Export: 3D Model flipped `ready` too.
  - **Advanced terminal** gained artifact inspection: `build` (build + list
    output files), `out` (list generated files), `cat <path>` (print a generated
    file) — still a pure interpreter, no shell/fs/network.
  - **Recipe Book, Knowledge Pack, Q&A Pack** are `ready` (book TOC+pages; the
    data ones are searchable localStorage apps with CSV export).
  - **Embroidery** ships a working `preview` v1: a printable **counted
    cross-stitch chart** (configurable grid, bold-every-10 lines), thread list,
    finished-size + stitch-count estimate, and **honest in-output notes** that
    it's a chart/visual design, *not* a machine embroidery file (PES/DST/etc.
    are version-specific and deferred), plus density/hoop warnings.
- **Current status: every preset is `ready`.** Export: **Desktop** (Electron
  wrapper scaffold) and **Mobile** (Capacitor scaffold) now emit real
  build-it-yourself packages — the final compile uses the user's own
  Node/Android Studio/Xcode (honest, stated in the generated README). Embroidery
  is `preview` only because its deep machine-export is a clearly-labelled
  experimental sub-project. Nothing is faked.
- **Remaining future work (next sessions):** the deep Embroidery module
  (digitizing, stitch simulation, machine formats where technically feasible),
  desktop/mobile app compilation, richer 3D (text/import/scenes), and optional
  reuse of the `bizapp` encrypted-DB for the data apps.
- **Phase 4 — Trade automation:** LISP Routine Creator, Dynamo/Revit Automation
  planner, Fixture Schedule Generator, Cut Sheet Package Generator.
- **Phase 5 — Advanced creative:** Embroidery Design module (beginner-first,
  original — no proprietary software cloned), Trading Card/Board Game Maker,
  3D Design/Export module.
- **Phase 6 — Food dataset + Food Truck planner + local Q&A generator + Raspberry
  Pi 5 export preset + deeper offline assistant.**

### Embroidery Studio — first-class tool DONE (DST export shipped)

`/tools/embroidery` is now a real interactive offline editor (registered in the
hub), backed by a pure, fully-tested engine under
`src/builder/studio/software/embroidery/`:

- **Paint** a counted design on a canvas (paint/erase, bold-every-10 grid),
  **stamp text** (names/monograms) with a built-in **5×7 font** (A–Z, 0–9),
  pick from a **brand-neutral thread palette**.
- **Live metrics + honest checks:** stitch count, color count, finished size by
  Aida count, thread-length estimate, fill density, and **hoop-fit** against
  hoop presets — with plain-English warnings.
- **Auto-digitize from artwork:** import any image → it's contained into the
  grid and each cell maps to the **nearest palette thread** (transparent and
  near-white pixels are skipped so the fabric shows through). Now with optional
  **Floyd–Steinberg dithering** (smoother photos) and a **max-colors cap**
  (reduce to the N most-used threads). Pure mappers unit-tested; live-verified.
- **Text in ANY script (Armenian solved):** besides the blocky 5×7 pixel font,
  a **"Stamp (any font)"** tool rasterizes typed text with the computer's own
  installed fonts → the grid, so **Armenian, monograms, any Unicode** stitch
  offline with no bundled font. Live-verified ("Անի" → 293 stitches).
- **True cross-stitch:** stitch generation now defaults to an authentic **X per
  cell** (two diagonal legs, needle up between); "Tatami" (single tack) stays as
  an option. Drives both the metrics and the machine files.
- **Two machine formats:** a real Tajima **DST** *and* a Melco/Bernina **EXP**
  export — both pure encoders proven byte-correct by round-trip-decode unit
  tests; live-verified (cross-stitch "Անի" → valid 4055-byte DST + 3544-byte EXP).
- **Exports:** printable **chart (PDF)**, **PNG**, **JSON** save/open, and a
  **real Tajima DST machine file** — the most openly-documented format. The DST
  encoder is proven by a round-trip decode unit test (and large jumps are split
  to ≤121 units); a live export of "LUSIK" produced a valid 737-byte DST
  (`LA:` header, `ST:70`, `0xF3` end record).
- **More deep features (Phase 5 wave 2):** a third stitch style **running**
  (outline/redwork) alongside cross + tatami; optional **underlay** + **pull
  compensation**; **resize-and-recalculate** (nearest-neighbor resample);
  **multi-hoop split** (a ZIP of one DST per hoop tile); **job costing + sew-time
  estimate** and a printable **production worksheet** (cost + thread list);
  a local **design library** (save/load named designs); and a **third machine
  format JEF** (Janome) — round-trip-tested like DST + EXP.
- **Honesty, by design:** chart + size are exact; DST/EXP/JEF are labelled
  **EXPERIMENTAL** — "test on your machine with stabilizer first." Still
  future: **PES (Brother)** — its binary PEC block needs real-hardware
  validation, so it's not shipped blind; true **vector satin/fill objects** (vs.
  the grid-based styles); and **stitch-out simulation/playback** + **arched/
  circular lettering** (planned UI polish).

The Software Creation Mode `embroidery` preset still generates its static
cross-stitch chart for project bundles; the full editor lives at the route above.

### Embroidery module note (Phase 5, large) — remaining

Owner wants a deep embroidery creator (digitizing, stitch editing, lettering,
thread/hoop, machine export "where technically possible", stitch simulation,
beginner + pro + production tooling). Build **original** workflows — inspired by
pro software, copying none. Be honest in-UI about what is *visual preview only*
vs *machine-ready*, supported formats, experimental features, hoop fit, density,
thread-jump, and cleanup warnings. Machine file formats land incrementally and
only where legally/technically feasible; everything else stays a clearly-labeled
preview. This is its own multi-phase sub-project — do not attempt in one pass.

## Constraints to keep honoring

100% offline core · no cloud AI/CDN/outside APIs · beginner-first, advanced
opt-in · privacy-first, local-only storage · **never store payment card data**
(payments only via official Square/Clover/Stripe hosted links) · licensed/own
assets only · opt-in camera/mic/sensors with consent + visible-when-active + no
auto-upload + no biometrics · reduced-motion honored with non-motion fallbacks ·
don't over-engineer v1 · feature-flag unfinished systems via preset `status` ·
don't ship to thumb drive / compile / merge until told.
