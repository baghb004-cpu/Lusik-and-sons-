# Baghdo's Workshop — portable visual builder

A standalone, portable Windows program. **One EXE → black loading screen →
visual drag-and-drop builder.** No Node, no npm, no Vite, no Next, no localhost,
no install, no internet — at runtime. A clean, standalone builder that contains
**none** of any other project's content, branding, templates, or product names.

---

## 1. Audit report (what the previous build had)

- **Solid & kept:** the one-EXE shell — Go + an embedded **WebView2** window
  (an OS component on Win10/11, *not* a browser the user opens, no localhost),
  with the whole UI embedded in the EXE, portable paths, save/load/export
  bindings, and a startup log. This architecture was right.
- **Replaced:** the UI itself. It had gone from a native menu → a 5-tab "tools"
  page; neither was the **visual drag-and-drop builder** you wanted. Rewritten.
- **Removed/avoided:** all website baggage — the old `desktop/` Tauri+Next
  wrapper that booted Node to serve the storefront, plus `make-drive.bat`. The
  launcher imports **nothing** from `src/`, `app/`, or `netlify/`.

## 2. Keep / remove / rewrite plan

| Action | Item |
| --- | --- |
| **Kept** | `winapi_windows.go` (message box + open folder), `main_other.go`, `go.mod/go.sum` (pure-Go WebView2), build/clean/test scripts |
| **Rewrote** | `app_windows.go` — portable folders (`projects/ logs/ exports/ resources/ app-data/`) + project/settings/export bindings; `ui/app.html` — the visual builder |
| **Removed** | the old 5-tab tools UI; the `runtime/` placeholder folder |
| **Isolated** | the entire website (untouched on its branch; not referenced) |

## 3. Architecture summary

One Go EXE (~2.6 MB) embeds the **entire UI** (`//go:embed ui/app.html`) and
opens it in a **WebView2** window. WebView2 renders the app's own UI (the
standard way native apps like VS Code do it) — there is no Node, no server, no
localhost, no browser tab. The UI talks to the EXE through a handful of bound
in-process Go functions (save/load/list/delete projects, settings, export, open
folder, log) — never a network. Cross-compiles to the Windows EXE from any OS.

## 4. Clean folder structure (the portable release)

```
dist-portable/                 # copy this whole folder to a thumb drive
├── Launcher.exe               # the program — double-click this
├── projects/                  # your saved projects (project.json + backups/ + assets/)
├── exports/                   # finished files you export
├── logs/                      # startup.log · app.log · export.log
├── app-data/                  # settings (remembers your last project) + webview cache
├── resources/                 # bundled assets
└── README_FIRST.txt
```
(The program itself is embedded in the EXE, so there is no separate `app/` to
ship.) Source lives in `launcher/` (`app_windows.go`, `ui/app.html`,
`winapi_windows.go`, `scripts/`), isolated from the website.

## 5. One-EXE launcher flow

Double-click `Launcher.exe` → it derives all paths from its own location (no
hard-coded paths), creates the portable folders if missing, writes
`logs/startup.log`, opens the WebView2 window (or shows a friendly message if
the WebView2 runtime is somehow absent), and loads the builder. No terminal
window, no internet, no install.

## 6. Black loading screen

A dark full-screen loader: pulsing logo, app name, a progress bar, and friendly
status messages — "Starting portable workspace…", "Checking local files…",
"Loading visual builder…", "Preparing canvas…", "Opening your workspace…" — then
it fades into the builder. No console/developer look.

## 7. Visual builder shell

- **Left:** big friendly component categories (see §8). Drag an item onto the
  canvas, or click it to add.
- **Center:** a device canvas (Phone / Desktop toggle) with a grid. Items can be
  **selected, moved (drag), resized (corner handle), duplicated (Ctrl+D),
  deleted (Del), layered, snapped** — and previewed.
- **Right:** a beginner-friendly inspector (Name, Move X/Y, Width/Height, Change
  Color, Change Text, Text size, Rounded corners, Opacity, Bring forward / Send
  back, Show on phone / desktop, Add Action) + Duplicate / Delete.
- **Developer mode** (hidden by default, the ⌘ Developer button): a bottom panel
  with three tabs — **Code** (the live generated HTML/CSS/JS of your design,
  with Copy), **Data** (the live project JSON), and **Console** (a safe command
  console: `add`, `list`, `select`, `delete`, `export`, `save`, `clear` — pure,
  no shell/network) — plus a per-item custom-code field in the inspector.

## 8. Component categories (left panel)

Basic Shapes · Text · Buttons · Images · Icons (Apple, Star, Heart, Home, Pin,
Camera) · Layout Blocks · Forms · **Maps** (with presets) · Media & More (Video,
360 Photo, Photo Booth, Gallery, 3D Object, Game Object) · Business & Data
(Business Tool, Database Block, App Component). Map presets carry honest labels:
**Offline Placeholder (Fully offline)**, **Open Source Simple (needs internet)**,
**Vector**, **Advanced GIS**, **Google Maps (needs internet + API key, may
cost)** — and nothing breaks offline.

## 9. Visual logic — WHEN → DO → THEN

Per item: **WHEN** (clicked / hovered / screen opens / timer finishes) → **DO**
(bounce / show message / change color / make bigger / hide / move / open another
screen / play sound) → **THEN** (an optional message). Example, with no code:
*WHEN the apple is clicked → DO bounce → THEN show "You clicked the apple."* —
it runs in Preview.

## 10. Portable storage

Projects autosave to `projects/<name>/project.json` (with timestamped
`backups/`); the last-open project is remembered in `app-data/settings.json` and
restored on launch; exports go to `exports/`; logs to `logs/`. New / open /
rename(save-as) / delete / duplicate / export — all local, all inside the folder.

## 11. Packaging process

From `launcher/`:

| Goal | macOS/Linux | Windows |
| --- | --- | --- |
| Build the EXE | `bash scripts/build-launcher.sh` | `scripts\build-launcher.ps1` |
| Package the release | `bash scripts/package-portable.sh` | `scripts\package-portable.ps1` |
| Clean | `bash scripts/clean.sh` | `scripts\clean.ps1` |
| Test the package | `bash scripts/test-portable.sh` | — |

Only build-time dependency: **Go** (no Node). Output: `dist-portable/`.

## 12. Runtime proof — Node is NOT required

The release is a single native `PE32+ (GUI) x86-64` Windows EXE. Static check
(`test-portable.sh`) confirms **no** `node.exe` / `node_modules` / `next` /
`vite` / `localhost` strings. It bundles no Node and starts no server.

## 13. Test checklist (verified)

UI logic verified in a real headless browser (the bound functions fall back to
local storage, so the logic is fully testable here): ✅ loads to the builder;
✅ click/drag a component onto the canvas (Apple icon → object created);
✅ select it → inspector populates; ✅ change settings (color/size); ✅ Save with
a name; ✅ reload → the saved project is recovered; ✅ Preview → clicking the
apple bounces it; ✅ zero console/page errors. Cross-compiled to a clean GUI EXE.

Your clean-PC acceptance run: no Node/npm, no internet, copy `dist-portable/` to
a USB and run from there (and from a different path), double-click `Launcher.exe`
→ black loading screen → builder; drag an item, edit it, Save, close, reopen →
it loads again; logs appear in `logs/`.
