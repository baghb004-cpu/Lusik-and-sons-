# Game Mode, Portable Environment & Retro Game Room — Plan (§23)

*The pre-coding answers Baghdo asked for, based on inspecting the project,
then the prototype's scope. Standing law restated: **Game Mode is optional,
the Retro Game Room is optional, the portable environment is private/
local-first, Normal Mode stays professional and fully functional, the real
builder/export engine stays in control, Godot is only the fun visual layer.***

---

## 1. What the current app is built with (inspection)

- **Normal Mode** = the Next.js 15 app in this repo. The builder lives in
  `src/builder/**` (schema/engine/renderer/storage/editor/export/media/
  i18n/viewport/ai), mounted at `/builder`, admin-gated.
- **The builder/export engine** (the source of truth) is
  `src/builder/export/exporter.ts` + the document APIs under
  `app/api/builder/*` — save/load, validation gates, static/PWA/Next/
  SwiftUI/Android-TWA exports, ZIP download, backup/restore, revisions,
  media, the GitHub storage adapter (export/push), service presets,
  shipping/Stripe protections. **None of this moves or changes.**
- **The thumb-drive shell** is Tauri (`desktop/src-tauri`): splash → spawns
  the portable Node runtime → `next start` on `127.0.0.1:4799` with a
  random `BUILDER_LOCAL_TOKEN` → opens `/builder#token=…`.

## 2. Safest recommended architecture

**Portable folder build, three cooperating pieces, one project format:**

```
Workshop/                          (the thumb-drive folder)
├── Workshop.exe                   ← Tauri launcher (splash → MODE PICKER)
├── node/  app/                    ← portable runtime + this repo (exists)
├── game-mode/
│   ├── godot-project/             ← Godot 4 SOURCE (text scenes, in repo)
│   ├── godot-export/              ← user drops Workshop-GameMode.exe here
│   └── CREDITS.md
└── portable/                      ← ALL private/local data (never in git)
    ├── settings.json  profiles/  quicksaves/  backups/
    └── retro/ (library/ user-media/isos/ vm-images/ emulator-configs/
               controller-profiles/ save-data/ screenshots/ logs/)
```

- **Bridge = the existing local HTTP API.** The launcher already owns a
  session token; it passes the same token + port to Godot via environment
  variables. Godot's built-in `HTTPRequest` calls `127.0.0.1:4799/api/...`.
  No new IPC, no second protocol, **the same auth wall** (`requireBuilderAdmin`),
  loopback-only. Game Mode is therefore physically incapable of doing
  anything Normal Mode couldn't — it calls the same gated endpoints.
- **One shared project format**: Godot reads/writes the same `builder/**`
  documents through the same validated APIs. No game-only format.
- **Game-mode-only state** (profiles, XP, quests, retro library) lives in
  `portable/` — validated by zod in the API layer, atomic writes, but NOT
  in the git document roots (saves/XP ticks shouldn't spam history, ISO
  paths are machine-specific, VM images are huge).

## 3. Files/folders created or changed

- **New, engine side** (this prototype): `src/builder/portable/`
  (schemas + store + retro launch composition, pure & unit-tested),
  `app/api/builder/portable/route.ts` (profiles/quicksave/backup),
  `app/api/builder/retro/route.ts` (library/verify/launch),
  `app/api/builder/game/route.ts` (hub status, quests/XP, mock actions).
- **New, fun side**: `desktop/game-mode/godot-project/` (project.godot +
  text scenes/scripts: hub with Website Workshop / Mobile App Workshop /
  Export Portal stations, Retro Room door, controller test screen),
  `desktop/game-mode/CREDITS.md`.
- **Changed**: `desktop/src-tauri/src/main.rs` + splash (mode picker;
  spawns Godot if present, graceful message if not),
  `desktop/scripts/make-portable.mjs` (creates the folder skeleton),
  `.gitignore` (`portable/` user data).
- **Unchanged**: everything under `src/builder/{schema,engine,renderer,
  export,storage,media,i18n,viewport}`, all existing APIs, the live site.

## 4. Dependencies / tools required

- **Godot 4.3+** — the only new tool, and only for Game Mode. Free, MIT-
  licensed, runs offline. The project here is SOURCE; Baghdo opens it in
  the Godot editor once and clicks Export (Windows) → drops the exe in
  `game-mode/godot-export/`. Nothing else new: the bridge uses what exists.
- **Retro Game Room backends are user-supplied binaries** placed in
  `portable/retro/emulators/`: DOSBox-X (GPL) for DOS/early-Windows,
  86Box (GPL) for accurate Win95/98 machines, QEMU (GPL) for Win2000/XP
  VMs. We ship *adapters and config generation only* — never the
  emulators' OSes, BIOSes, games, or keys (those are Baghdo's own media).

## 5. Risks with Godot integration — and the fallback plan

| Risk | Mitigation |
| --- | --- |
| Godot exe missing/crashes | The launcher checks for it; missing → friendly note + Normal Mode opens. Game Mode runs in its own process — it cannot take the builder down. |
| Bridge drift | Game Mode calls the same public APIs the editor uses; the existing e2e + unit suites are the contract. A `mock` mode in every Godot station works with no server at all. |
| Scope creep ("rebuild the builder in Godot") | The hub only LAUNCHES engine actions and shows status/XP. No document editing UI in Godot, by design. |
| Asset licensing | All Game Mode art is original (simple shapes/text, same hand-drawn-CSS spirit as the splash). CREDITS.md exists from day one; brand-neutral controller labels enforced by a unit test. |
| Emulator legality | We generate configs and launch commands for **user-supplied legal media only**; nothing copyrighted is bundled, downloaded, or scraped. Docs state this plainly. |

**Fallback:** delete or ignore `game-mode/` and `portable/` and the product
is exactly the professional builder that exists today — every test that
guards Normal Mode keeps running in CI untouched.

## 6. Packaging comparison

| Option | Verdict |
| --- | --- |
| **Portable folder + one launcher exe** | ✅ **Chosen.** Matches the existing make-portable layout; Godot/emulators/VM images can't sensibly live inside one exe; user data stays beside the app; copying the folder IS the backup. |
| Single .exe | ❌ Embedding a Node runtime + Godot + emulators + VM images in one binary means slow extraction at every launch, antivirus false positives, and updates that re-ship gigabytes. |
| Installer | ❌ Wrong fit for private thumb-drive use — writes to the registry/system folders, exactly what the spec forbids. Revisit only for a public launch. |

## 7–9. Source of truth, Normal-Mode verification, license safety

- **Source of truth**: Game Mode contains zero export/generation logic.
  Every station POSTs to the existing gated endpoints; the engine answers.
- **Normal Mode verification**: the full unit suite (235+), the Playwright
  e2e suite (site + builder editor), the production build and bundle-
  budget gates all run unchanged in CI — they ARE the proof, plus a live
  HTTP smoke of save/export after this prototype lands.
- **License safety**: original assets only in the Godot project;
  `CREDITS.md` tracks anything third-party (currently: none beyond the
  MIT-licensed engine itself); the Retro Room ships infrastructure, not
  media; `docs` + in-UI copy state the user-supplied-legal-media rule;
  brand-neutral controller naming is unit-tested (no console brand names
  in any UI string).

## Honest limits (the same physics as the .exe)

- I can't RUN Godot in this environment — the project ships as ready-to-
  open source; its first real run is on Baghdo's machine, like the Tauri
  compile.
- Save-states are per-backend: DOSBox-X has them; 86Box/QEMU use machine
  snapshots; some games only have their own in-game saves. The library UI
  shows which tier each profile actually supports — no universal promise.
- Controller mapping: Godot detects pads natively (SDL mappings,
  brand-neutral names); for emulators we generate DOSBox-X mapper files
  and pass-through configs for VMs. A system-wide input-injection driver
  is deliberately out of scope (over-engineering).

## Prototype steps (this PR)

1. ✅ Inspect (above). 2. `portable/` data layer + schemas + tests.
3. The three APIs (game/portable/retro), fs-mode-only, admin-gated,
   Retro Room **disabled by default** in `portable/settings.json`.
4. Godot project source: hub + three stations (each station has a Mock
   button wired first, then the real call), Retro Room door, controller
   test screen, generic-controller presets.
5. Launcher mode picker + make-portable folder skeleton.
6. Suite + build + live HTTP smoke; confirm Normal Mode untouched.
