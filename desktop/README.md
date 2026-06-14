# Baghdo's Workshop — desktop shell (Phase 16)

The double-click Windows app: a ~10 MB Tauri shell that plays the animated
splash, boots the builder's local server from a portable folder, and opens
the editor — no installs on the host machine, everything on the thumb drive.

## What's here

| Path | What |
| --- | --- |
| `splash/splash.html` | The §16a animated mini-story (gaming → startled jump → badminton whiff → thumbs-up + title). Pure inline CSS, zero network. **This file IS the artwork** — edit shapes/keyframes here, or swap in sprite PNGs; the shell only needs `#done` and the `app-ready`/`app-error` listeners to survive. The final pose renders with all animation off, so the static fallback exists by construction. Click = skip. `prefers-reduced-motion` = final frame only. Gohar's cameo (scene 4) is documented in the file's header as the v2 addition. |
| `src-tauri/` | The Rust shell: splash window first (~100 ms after launch), server spawn with a per-session token, port polling with a minimum splash duration (the story finishes), fade hand-off, error display instead of hangs, and server teardown when the window closes. |
| `scripts/make-portable.mjs` | Assembles the USB layout below. |

## Building the .exe (on Windows — this cannot be cross-compiled from the repo's CI sandbox)

One-time prerequisites:
1. **Rust** — https://rustup.rs (stable toolchain)
2. **Microsoft C++ Build Tools** — Visual Studio Installer → "Desktop development with C++"
3. **Node 22** — https://nodejs.org
4. **WebView2** — preinstalled on Windows 10/11

Then:
```powershell
# in the repo root: production-build the app once
npm ci
npm run next:build

# build the shell
cd desktop
npm install
npm run tauri:build        # → src-tauri/target/release/baghdos-workshop.exe

# assemble the thumb-drive folder
node scripts/make-portable.mjs E:\BaghdosWorkshop
```

## The portable layout

```
E:\BaghdosWorkshop\
├── baghdos-workshop.exe      double-click this
├── node\node.exe    portable Node runtime (pinned v22)
├── app\             the builder project (production build + data)
└── README.txt
```

`baghdos-workshop.exe` generates a fresh session token, starts `node app … next
start` on port 4799 with it, plays the splash until the server answers
(minimum 3.4 s so the story lands), then opens the editor at
`/builder#token=…` — the editor reads the hash and logs itself in. Closing
the editor window kills the server. If the server fails, the splash shows
the error instead of hanging.

Dev loop without the portable layout: run `npm run next:dev` in the repo
with `BUILDER_LOCAL_TOKEN` set, then `BUILDER_EXTERNAL=1 npm run tauri:dev`
here — the shell skips spawning and connects to your dev server.

## Icons

`src-tauri/icons/icon.ico` is required by the bundler. Generate the set
from any 1024×1024 PNG with `npx @tauri-apps/cli icon path/to/icon.png`
(placeholder note in `icons/`).

## Honest notes

- The exe itself is tiny; the `app\` folder (with `node_modules`) is the
  bulk. Trimming that is a later optimization (Node SEA / pruned deps).
- Local AI: install Ollama on the host and the ✨ AI panel detects it.
  Optionally ship `llama.cpp` + GGUF models in a `models\` folder later —
  the Phase 14 adapter already speaks llama-server.
- The splash's `app-ready` fade and minimum-duration logic mean the app
  never feels slower because of the animation: fast boots skip to the
  thumbs-up; slow boots idle on it.
