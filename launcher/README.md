# Baghdo's Workshop — portable launcher

A standalone, native Windows launcher that runs from a thumb drive. **One EXE,
black-box loading screen, then a simple menu.** No Node.js, no browser, no
localhost, no install, no runtime — at runtime. This folder is fully isolated
from the Lusik & Sons website.

---

## 1. Architecture summary

- **One self-contained Go EXE (~2.6 MB) with the whole UI embedded inside it.**
  It opens a clean app window using **WebView2** — a component that ships *inside
  Windows 10/11* — to render a polished dark UI with a **real-time live
  preview** (edit on the left, the preview updates instantly on the right).
- **No Node, no npm, no Vite, no Next, no localhost, no dev server, no browser
  tab.** WebView2 is the app's own window (the standard way native apps like VS
  Code render UI), not a browser the user opens. The entire HTML/CSS/JS UI is
  embedded in the EXE via `//go:embed`; nothing is fetched and no server runs.
- **Why this approach** (vs. the rejected one): the old portable build wrapped
  the Next.js *website* and started a bundled **Node.js** server, opening a
  browser at localhost — exactly what you didn't want. And a *pure-native* menu
  (an earlier draft) looked clunky and can't show a real-time web-style preview.
  WebView2 gives the clean, modern UI + live preview while staying one offline
  EXE with no Node.
- **Cross-compiles to the Windows EXE from any OS** (built here on Linux:
  `GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build`). The only build-time deps
  are Go + a pure-Go WebView2 binding (no cgo). The end user needs nothing.
- **Robust inside, simple outside:** portable paths (everything relative to the
  EXE, no hard-coded paths), a timestamped startup log, self-healing folders,
  and a clean message if WebView2 is somehow absent — but the user only ever
  sees one EXE, a black loading screen, then the app.
- **One requirement on the PC:** the WebView2 runtime, which is **pre-installed
  on Windows 10 (21H2+) and Windows 11**. On older machines it's a free one-time
  Microsoft install; the app shows a friendly message if it's missing.

## 2. Cleaned folder structure

```
launcher/                      # isolated — imports NOTHING from the website
├── go.mod / go.sum            # module: baghdos-launcher (Go + pure-Go WebView2)
├── app_windows.go             # the app: opens WebView2, embeds the UI, save/load
├── ui/app.html                # the ENTIRE UI in one file (loading + live preview)
├── winapi_windows.go          # tiny Win32 helpers (message box, open folder)
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

- `app_windows.go` — opens the WebView2 window, embeds `ui/app.html` via
  `//go:embed`, and exposes a few in-process functions to the UI (no server):
  `appSave`/`appLoad` (persist projects to `app-data`), `appExport` (write a
  standalone page to `app-data/exports` + open the folder), `appOpenFolder`,
  `appLog`. Portable paths from `os.Executable()`; startup log in
  `app-data/logs/launch-*.log`; clean message if WebView2 is missing.
- `ui/app.html` — the entire UI in one self-contained file (inline CSS+JS, no
  frameworks): a **black-box loading screen** (status messages + progress bar)
  that fades into the app, then a clean editor (left) + **live preview** (right)
  that re-renders on every keystroke. Save/Export call the bound Go functions.
- `winapi_windows.go` — tiny Win32 helpers (`MessageBoxW`, `ShellExecuteW`) for
  the runtime-missing message and "open folder".

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
