# Portable drive layout — Windows (primary) + Raspberry Pi 5 (secondary)

The thumb-drive build is the priority. The hierarchy below is **identical on
both targets** so a Raspberry Pi 5 (arm64 Linux) build is a drop-in later — you
don't reorganize anything, you just assemble the drive for a second target.

## The hierarchy (same on every target)

```
<DRIVE>/
├── baghdos-workshop.exe   # launcher — WINDOWS only (Tauri shell)
├── start.sh               # launcher — RASPBERRY PI / LINUX only
├── node/                  # the portable Node runtime
│   ├── node.exe           #   …on a Windows drive
│   └── bin/node           #   …on a Pi drive (plus lib/, include/, share/)
├── app/                   # the built builder project (shared, platform-agnostic*)
│   ├── .next/  node_modules*/  builder/  content/  public/  src/  netlify/ …
├── portable/              # your private data (profiles, saves, retro, settings.json)
├── game-mode/             # optional Godot project + export slot
└── README.txt
```

`node.exe` (Windows) and `bin/node` (Linux) don't collide, so one `node/`
folder can even hold both runtimes. The launchers, `app/`, `portable/`, and
`game-mode/` are otherwise the same files on both targets.

\* **The one architecture-specific piece is `app/node_modules`.** It contains
native binaries (`@next/swc-*`, etc.) compiled for one OS+CPU. So you build
each target's drive *on* that architecture — see below.

## Build a Windows drive (primary)

```
npm run next:build                       # in the repo root
cd desktop && npm run tauri:build        # on Windows → baghdos-workshop.exe
node desktop/scripts/make-portable.mjs E:\Workshop      # --target win-x64 is the default
```

Double-click `baghdos-workshop.exe`. The Tauri splash plays, the local server
boots, the editor opens at `/builder`.

## Build a Raspberry Pi 5 drive (secondary / future)

Run the assembler **on the Pi itself, or on any arm64 Linux box**, so
`app/node_modules` gets the arm64 native binaries:

```
npm ci && npm run next:build                              # on the Pi / arm64 host
node desktop/scripts/make-portable.mjs /media/USB --target linux-arm64
```

Then on the Pi: `./start.sh`. It generates a one-time token, starts the same
Next server from `node/bin/node`, and opens Chromium at `/builder#token=…`,
taking the server down when you close it — the Linux equivalent of the Tauri
shell. (No Tauri build is needed for the Pi; the script launcher is enough.)

> If you must assemble the arm64 drive on an x86 machine, `make-portable.mjs`
> warns you: copy the drive to the Pi and run `npm ci --omit=dev` inside `app/`
> there once (needs network that once) to replace the native binaries, then it
> runs offline.

## What the runtimes share vs. don't

| Piece | Windows | Raspberry Pi 5 | Notes |
| --- | --- | --- | --- |
| Launcher | `baghdos-workshop.exe` | `start.sh` | Same choreography: token → server → browser → cleanup |
| Node runtime | `node/node.exe` | `node/bin/node` | Pinned `v22.12.0`, sha256-verified at assembly |
| `app/` (built site + builder) | shared | shared | `.next` is portable; `node_modules` is per-arch |
| `portable/` data | shared | shared | Profiles, saves, settings, retro library — plain JSON |
| Builder, exports, tools | works | works | All JS — runs anywhere Node runs |
| Retro Game Room emulators | Windows sidecars (pinned) | **arm64 builds, future** | `scripts/retro-tools.lock.json` pins Windows assets; arm64 pins are a later step |
| FFmpeg sidecar (Media Studio) | win64 build | linux/arm64 build | `install-media-tools.mjs` already branches on platform |
| Godot Game Mode | Windows export | arm64 export | Same `godot-project/`; export per platform |

## Still-future Pi work (not blocking the Windows build)

- Pin arm64 emulator + FFmpeg assets (the offline Retro Game Room / Media
  Studio sidecars) in the lock files, the same fail-closed way as the Windows
  ones.
- Optionally compile a real Tauri arm64 shell instead of `start.sh` (the
  script launcher is intentionally simpler and works today).

The core builder, exports, tools, content CMS, and data layer all run on the Pi
today with just `node/bin/node` + `start.sh` — the structure is ready.
