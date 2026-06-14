# Baghdo's Workshop — portable launcher

A standalone, native Windows launcher that runs from a thumb drive. **One EXE,
black-box loading screen, then a simple menu.** No Node.js, no browser, no
localhost, no install, no runtime — at runtime. This folder is fully isolated
from the Lusik & Sons website.

---

## 1. Architecture summary

- **Native Win32 GUI written in Go (pure standard library, no cgo, no
  dependencies).** It compiles to a single ~1.7 MB `Launcher.exe` that runs on
  any Windows (7→11) with **nothing installed**.
- **Why this approach** (vs. the rejected one): the old portable build wrapped
  the Next.js *website* and started a bundled **Node.js** server, opening a
  **browser at localhost**. That is exactly what you didn't want. This launcher
  uses no web stack at all — it draws its own dark UI with the OS's GDI, so
  there is no Node, no Next, no Vite, no localhost, no browser, no WebView.
- **Considered & rejected for v1:** Tauri/Rust and .NET+WebView2 are clean, but
  both still render via a browser engine (WebView2) and need a heavier Windows
  build toolchain (Rust+MSVC, or the .NET SDK). The native Go path is smaller,
  has zero runtime, and cross-compiles to the EXE from any OS.
- **Robust inside, simple outside:** portable path handling (everything relative
  to the EXE), a timestamped startup log, missing-file detection that
  self-heals, and a recovery screen — but the user only ever sees one EXE, a
  loading screen, and a menu.

## 2. Cleaned folder structure

```
launcher/                      # isolated — imports NOTHING from the website
├── go.mod                     # module: baghdos-launcher (stdlib only)
├── main_windows.go            # the launcher: loading screen → menu, paths, logs
├── winapi_windows.go          # thin Win32 bindings (user32/gdi32/kernel32/shell32)
├── main_other.go              # no-op stub so it compiles on non-Windows hosts
├── resources/                 # bundled local tools/assets (shipped on the drive)
├── templates/README_FIRST.txt # the end-user note copied into the release
├── scripts/                   # build / package / clean / test (sh + ps1)
└── dist-portable/             # RELEASE OUTPUT (git-ignored) ↓
    ├── Launcher.exe
    ├── app-data/   (your saved work + logs, created at runtime)
    ├── resources/
    ├── runtime/    (empty — self-contained)
    └── README_FIRST.txt
```

## 3. Launcher implementation

- `main_windows.go` — registers a window class, creates a fixed centered window,
  runs a message loop. A small state machine renders three phases:
  **loading** (title + status line cycling through "Checking portable files…",
  "Loading local tools…", "Preparing your workspace…", "Starting workspace…" +
  a gold progress bar), **menu** (owner-drawn dark buttons with hover), and
  **error/recovery**. Menu actions: open *my files* (app-data), open *tools*
  (resources), view *startup log*, *About*, *Quit* — all native, no web.
- `winapi_windows.go` — minimal `syscall.NewLazyDLL` bindings + structs
  (`WNDCLASSEXW`, `MSG`, `PAINTSTRUCT`, `RECT`) + helpers (fonts, brushes,
  `DrawTextW`, `RoundRect`, `ShellExecuteW`).
- Portable + robust: paths derive from `GetModuleFileNameW` (no hard-coded
  paths); the only writes are under `./app-data`; every run writes
  `app-data/logs/launch-*.log`; missing folders are recreated and logged.

## 4. Packaging / release process

Commands (run from `launcher/`):

| Goal | macOS/Linux | Windows |
| --- | --- | --- |
| **Build launcher** | `bash scripts/build-launcher.sh` | `scripts\build-launcher.ps1` |
| **Package portable release** | `bash scripts/package-portable.sh` | `scripts\package-portable.ps1` |
| **Clean release** | `bash scripts/clean.sh` | `scripts\clean.ps1` |
| **Test portable launch** | `bash scripts/test-portable.sh` | (run the .sh, or just open the EXE) |

The only build-time dependency is **Go** (https://go.dev/dl/). Node.js is never
involved. `package-portable` produces `dist-portable/` — copy that whole folder
to a thumb drive.

> You don't even have to build it yourself: a ready `Launcher.exe` was compiled
> and sent to you. Drop it into the `dist-portable/` layout (or run
> `package-portable`) and you're done.

## 5. Removed / excluded website baggage (audit)

The launcher **isolates** the website rather than copying it. None of the
following — all pulled in by the *old* `desktop/` + `make-portable.mjs` portable
path — is part of this launcher:

- the Next.js app (`app/**` routes, `.next/`, `next.config.mjs`)
- the website React UI (`src/components/**`, storefront, product/cart/checkout
  pages, blog/journal, CMS/Studio pages)
- Stripe checkout logic, Netlify functions/config (`netlify/**`, `netlify.toml`)
- website SEO files (`sitemap.xml`, `robots.txt`), analytics/ad pixels
- website CSS/themes, fonts, and storefront images
- `node_modules/` and any Node runtime

The launcher's Go module imports **only the Go standard library**. It references
zero files from `src/`, `app/`, or `netlify/`. The old `desktop/` Tauri+Next
wrapper and `make-drive.bat` are **superseded** for the launcher use-case (left
in place so the website branch stays untouched — see §7).

## 6. Test checklist — proves Node.js is NOT required at runtime

Automated (here, via `scripts/test-portable.sh`): ✅ the binary is a native
`PE32+ (GUI) x86-64` Windows exe; ✅ it contains **no** `node.exe`,
`node_modules`, `localhost`, `next/dist`, or `vite` strings; ✅ ~1.7 MB.

On a clean Windows PC (manual — your acceptance test):

- [ ] PC has **no Node.js / npm** installed
- [ ] **No internet** connection
- [ ] No dev server running
- [ ] Copy `dist-portable/` to a USB stick; run from the **USB path**
- [ ] Also run from a **different folder path** (proves no hard-coded paths)
- [ ] Double-click **`Launcher.exe`** — black loading screen appears
- [ ] **No terminal window** stays open; no npm/localhost text shown
- [ ] The **menu** opens — **no website storefront** anywhere
- [ ] `app-data/logs/launch-*.log` is written next to the EXE

## 7. Do-not-touch confirmation

This work is only in `launcher/` on the `claude/codebase-review-w50a0a` branch.
**Untouched:** `main`, the production website branch, Netlify production config,
Stripe checkout, and all live website code.

## How to run from a thumb drive

1. Copy the `dist-portable` folder onto your USB stick.
2. Plug the stick into any Windows PC.
3. Open the folder and double-click **`Launcher.exe`**.
4. A clean black loading screen appears, then the menu — done. Offline, no setup.
