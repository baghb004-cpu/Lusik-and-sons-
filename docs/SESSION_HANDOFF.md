# Session handoff — read this first in a new Claude Code session

*Continuity doc so work resumes cleanly if a session runs out of context.
Last updated: 2026-06-13.*

## Where everything lives

- **Branch:** `claude/codebase-review-w50a0a` (all work is here — `git checkout`
  it; building `main` gets the OLD app).
- **Open PR:** **#254** — "Baghdo's Workshop — the custom CMS + website/app
  builder" → merges everything into `main`. Awaiting Baghdo's review + the
  GitHub token to switch the live site's CMS. CI subscribed.
- **Tests:** `npm run test:builder` (296+ unit, Node type-stripping) + the
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
- **Personal tool UIs built** (`/tools/payroll`, `/tools/media-studio`,
  `/tools/tax`): client pages, ssr:false, noindexed, ~104 KB each, read
  `#token=` from the launcher; run their pure engines in-browser. Media
  Studio also calls /api/builder/media-studio (FFmpeg sidecar) for trims.
- **Payroll / SE-tax calculator** (§27): `src/builder/payroll/` — engine +
  updater + dataset done & tested (282 total). Needs a React UI + Payroll
  section page next (see TAX_ASSISTANT_PLAN.md §27).
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

**Done (Phase 2 polish — `src/builder/tax/ui/`):**
- The guided-interview **UI** + `/tools/tax` page (built earlier).
- **Encrypted save/load** — `sessionCrypto.ts`, a browser WebCrypto twin of
  the server `crypto.ts` (AES-256-GCM + PBKDF2, `BTAXW1` marker). Save
  downloads one `.btax`; Open restores the session. No passphrase ⇒ no
  decryption, no recovery, stated in the UI.
- **Optional OCR import** — `ocr.ts`, always-confirm. Loads an OPTIONAL local
  engine from a vendor path on the drive (no CDN, no bundler import → first-load
  JS unchanged); degrades to an honest "type it in" message when not staged.
  Extracted amounts are only ever tap-to-suggest; never written as a trusted
  figure. (Staging the vendor tesseract assets is a packaging step, not built.)
- **Next-year updater button** — wires `updater.ts`: shows official IRS steps/
  links + scaffolds & downloads an EMPTY, cited rule pack for next year.

**Next for tax (Phase 5–6, not built):**
- State module (Phase 5, same rule-pack format, per-state files).
- Export helpers for Free File Fillable Forms / print-and-mail (Phase 6) —
  never an unauthorized e-file path.

## Offline Media Studio (§26) — Phase 1 + live preview BUILT

`src/builder/media-studio/` (schemas + format/help data pack + trim/split/
save-as-new-clip logic), the FFmpeg sidecar (`ffmpeg.ts` composers +
`scripts/install-media-tools.mjs`), the admin-gated API
(`app/api/builder/media-studio/route.ts`), and the `/tools/media-studio` UI
are all built. The **live-preview polish** is in: the API has a contained,
Range-capable `GET ?file=<media-relative path>` branch (token via `?token=`
fallback since media elements can't send headers; restricted to
`portable/media/` — the tax vault is refused; web ReadableStream built by
hand because the route runtime lacks `stream.Readable.toWeb`), and the UI has
a `<img>/<video>/<audio>` preview + a visual draggable timeline (grab-handles,
click-to-seek playhead, set-start/end-to-playhead, split-at-playhead → save
either half). Originals are never overwritten. Remaining (not built): richer
multi-clip editing, image export presets via the sidecar.

## How to resume (suggested first moves)

1. `git checkout claude/codebase-review-w50a0a && npm run test:builder` (expect
   296+ green).
2. Read the relevant plan doc section for whatever Baghdo asks next.
3. Pattern for any new module: pure engine under `src/builder/<name>/` +
   tests in `src/builder/__tests__/<name>.test.ts` + (if it needs a backend)
   an admin-gated `app/api/builder/<name>/route.ts` + editor wiring. Commit
   in focused chunks, push to the branch, keep PR #254 green.
