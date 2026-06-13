# Session handoff — read this first in a new Claude Code session

*Continuity doc so work resumes cleanly if a session runs out of context.
Last updated: 2026-06-13.*

## Where everything lives

- **Branch:** `claude/codebase-review-w50a0a` (all work is here — `git checkout`
  it; building `main` gets the OLD app).
- **Open PR:** **#254** — "Baghdo's Workshop — the custom CMS + website/app
  builder" → merges everything into `main`. Awaiting Baghdo's review + the
  GitHub token to switch the live site's CMS. CI subscribed.
- **Tests:** `npm run test:builder` (274 unit, Node type-stripping) + the
  Playwright e2e (`tests/e2e/*.spec.mjs`, needs `PW_CHROME=/opt/pw-browsers/
  chromium-1194/chrome-linux/chrome`). `npm run typecheck`, `npm run
  next:build` (also runs the 210 KB bundle budget + editor-isolation gate).
- **The governing plan docs** (each a numbered section): `docs/BUILDER_PLAN.md`
  (§1–§22 the builder), `docs/GAME_MODE_PLAN.md` (§23 Godot+Retro Room),
  `docs/TAX_ASSISTANT_PLAN.md` (§25), `docs/MEDIA_STUDIO_PLAN.md` (§26, NOT
  built yet — next), `docs/INSPIRATION_ROADMAP.md`, `docs/BUILDER_ROADMAP.md`,
  `docs/SEO_OPTIMIZER.md` (§24), `docs/RETRO_GAME_ROOM.md`.

## What's the app (one paragraph)

Next.js 15 App Router on React 18, the live Lusik & Sons e-commerce site.
The big add this branch: **Baghdo's Workshop**, an offline-first visual
website + mobile-app builder under `src/builder/**` mounted at `/builder`,
plus portable thumb-drive packaging (`desktop/` Tauri shell, `node/`+`app/`
layout), an optional **Godot Game Mode + Retro Game Room**, and several
offline tools. The builder/export engine is the source of truth; `/builder`
ships zero code to public routes (enforced by the bundle-budget gate).

## Done & shipped on this branch (all tested)

- Builder: ~34 block types, generated inspector forms, media library,
  themes + Day/Night/Candlelight, offline i18n (en/hy/ar/ru/es) + bundled
  Noto fonts, device overrides + viewport presets, audit panel, SEO panel,
  starter templates, site chrome, Brand Kit, review notes, print/PDF, deck
  export, **calendar (event .ics + booking button)**, sectionJumper,
  appearanceSwitcher, spec/CSV tables, video, contact form, social/hours/map.
- Exports: static, PWA, Next, **SwiftUI (iOS)**, **Android TWA**, deck. All
  carry media + fonts; sitemap/robots/404 included.
- Phone editing layout for the editor (Pi + phone-as-screen).
- **SEO Optimizer** (§24): `src/builder/seo/` + `scripts/seo-audit.mjs`
  (separate offline program) + 🔍 SEO in-editor button.
- **Game Mode + Retro Game Room** (§23): `src/builder/portable/`,
  `desktop/game-mode/godot-project/`, sidecar emulator installer
  (`scripts/install-retro-tools.mjs`, checksum-pinned), setup wizard, LEGO
  templates, brand-neutral controllers.
- **Tax Assistant** (§25): `src/builder/tax/` — see below.
- Portable packaging: `desktop/scripts/build-windows.ps1`,
  `make-portable.mjs`, `scripts/preflight-portable.mjs`, fonts/emulator
  fetchers.

## Parked — needs Baghdo's hardware/credentials (not code)

1. **Compile the `.exe`** — Windows only. `desktop/scripts/build-windows.ps1`
   does it. Trigger phrase: "ship the program".
2. **Merge PR #254 + mint a GitHub fine-grained PAT** (Contents:RW, this repo
   only) + set `BUILDER_GITHUB_REPO`/`BUILDER_GITHUB_TOKEN` in Netlify → makes
   `/builder` live as the CMS. Trigger: "open/merge the builder PR".
3. **Verify SwiftUI on a Mac** (rent-a-Mac → Xcode/TestFlight).
4. **Godot export** (open `desktop/game-mode/godot-project` once, export
   Windows, drop in `game-mode/godot-export/`).

## Tax Assistant — current state & NEXT STEPS

**Done (Phase 1 + foundations, `src/builder/tax/`):** schemas (TaxProject/
TaxDocument/RulePack with Confidence + verified-figure contract), document
checklist + form guidance + interview questions (all cite irs.gov), engine
(std-vs-itemized only with a verified figure), validation, audit-ready
packet, AES-256-GCM at-rest encryption, and the **subsequent-year updater/
scaffolder** (`updater.ts` — one-click official IRS links + builds an empty
cited pack for any future year; never inherits or invents amounts).
**Safety contract (keep it):** no unverified/`null` figure ever becomes a
number — the engine returns "needs-review" instead. The shipped pack is a
TEMPLATE with zero amounts (a test enforces this).

**Next for tax (Phase 2–6, not built):**
- A guided-interview **UI** + a Tax section page (the data model + questions
  exist; needs the React surface). Likely `app/tax/` + `src/builder/tax/ui`.
- OCR import (OPTIONAL, local-only, always-confirm — never auto-trust). No
  dependency chosen yet; tesseract.js is the offline candidate. Design says
  every value stays manually confirmable.
- The rule-pack updater **button/route** wiring (`updater.ts` is ready).
- State module (Phase 5, same rule-pack format, per-state files).
- Export helpers for Free File Fillable Forms / print-and-mail (Phase 6) —
  never an unauthorized e-file path.

## Next module queued: Offline Media Studio (§26)

Full plan + architecture answers are in **`docs/MEDIA_STUDIO_PLAN.md`**
(written this session, NOT built). It's a new SECTION in the app (photo/
video/audio import-organize-trim-convert-export, offline, FFmpeg sidecar),
sharing a mini-OS file library with the website/app builders, tax vault kept
private. Start at its "Phase 1 — smallest safe version" section.

## How to resume (suggested first moves)

1. `git checkout claude/codebase-review-w50a0a && npm run test:builder` (expect
   274 green).
2. Read the relevant plan doc section for whatever Baghdo asks next.
3. Pattern for any new module: pure engine under `src/builder/<name>/` +
   tests in `src/builder/__tests__/<name>.test.ts` + (if it needs a backend)
   an admin-gated `app/api/builder/<name>/route.ts` + editor wiring. Commit
   in focused chunks, push to the branch, keep PR #254 green.
