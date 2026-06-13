# Offline Media Studio — plan & architecture (§26, NOT built yet)

*A new SECTION inside Baghdo's Workshop (not a separate product): a private,
fully offline photo / video / audio editor that shares a local file library
with the website builder, mobile app builder, mini-OS profile system, and
the tax module. Captured this session so a future session can build it.
Standing laws: offline-first, no telemetry/cloud by default, originals
preserved, don't break the existing builder/export engine, don't clone any
proprietary editor's UI.*

---

## 0. Inspection — how the existing app works (so this fits in)

- **Stack:** Next.js 15 App Router + React 18 + Tailwind; the builder is
  `src/builder/**` (pure engine + `editor/` client UI), mounted at `/builder`
  through `app/builder/`. Admin-gated APIs live at `app/api/builder/*` and go
  through `requireBuilderAdmin` (local session token in fs mode, GoTrue/
  GitHub PAT in hosted mode).
- **Storage:** `src/builder/storage/` (fs adapter for thumb-drive, GitHub
  adapter for hosted) with strict path walls + atomic writes. **Media
  library already exists**: `src/builder/media/` (sniff-by-bytes upload,
  `public/img/uploads/`, `/api/builder/media`).
- **Mini-OS / profiles:** `src/builder/portable/` (profiles, quicksaves,
  the Retro Game Room) writes under `portable/` (private data dir, gitignored,
  atomic, segment-walled in `store.ts`). **This is where Media Studio data
  belongs.**
- **Tax vault:** `src/builder/tax/` stores AES-256-GCM-encrypted projects;
  the privacy boundary is already real.
- **Desktop shell:** Tauri (`desktop/`), portable `node/`+`app/` layout, can
  spawn sidecar processes (it already spawns Godot + emulators) — this is the
  path for an FFmpeg sidecar.

## 1. Safest architecture (plain English)

A **new editor section** (`src/builder/media-studio/` pure engine +
`editor/` UI, reached from the Workshop nav), backed by **admin-gated local
APIs** that shell out to a **bundled FFmpeg/FFprobe sidecar** for the heavy
media work. The browser does light previews (Canvas/WebAudio/`<video>`);
FFmpeg does decode/encode/transcode/thumbnails/waveforms/trims. **All local,
no network.** Editing is **non-destructive**: a Media Studio *project* is
JSON describing operations + source references; rendering produces NEW files
and never overwrites originals unless the user explicitly confirms.

Mirror the patterns already proven here: pure engine + zod schemas + tests,
fs storage walls, `requireBuilderAdmin`, the bundle-budget editor-isolation
rule (no studio code on public routes).

## 2. Safest folder/file structure

Extend the existing `portable/` mini-OS data dir (per-profile), NOT the git
document roots:

```
portable/
  profiles/<id>/...                      (exists)
  media/                                 (the shared library — EXISTS as
                                          public/img/uploads today; generalize)
    photos/ videos/ audio/ voice/ thumbnails/ edited/ new-clips/
  media-studio/
    projects/  (photo/ video/ audio/ .mstudio.json — non-destructive)
    presets/   temp/  render-cache/  exports/new-clips/
  shared-exports/                        (cross-module drop zone)
  trash/
  tax/ ...                               (EXISTS, stays private/encrypted)
```

Engine code: `src/builder/media-studio/{schemas,formats,engine,ffmpeg,
project,help}.ts`. Editor: `src/builder/media-studio/editor/`. API:
`app/api/builder/media-studio/route.ts` (+ a render-queue route).

## 3. Shared file-system model

One profile owns its files; each module has a workspace; there's a **shared
media library** and a **shared export area**; tax/private files are walled
off. A small index (SQLite via `node:sqlite`, or a JSON index to start)
tracks path/type/codec/duration/resolution/owner/**privacyLevel**. Media
Studio reads `normal`/`private` media; **never** lists `tax/document-
protected` files unless the user explicitly imports one.

## 4. Dependency plan

- **FFmpeg + FFprobe** as a **sidecar binary** fetched by a checksum-pinned
  installer (reuse the `scripts/install-retro-tools.mjs` pattern: official
  source, sha256 lock, manifest + THIRD_PARTY_NOTICES). Do the work via
  `child_process` (desktop/Pi) — the engine composes argv arrays, never
  shell strings (same safety rule as the Retro launch composer).
- **Sharp/libvips** (or FFmpeg) for fast image resize/convert.
- **SQLite** (`node:sqlite`, Node 22 built-in) for the media index — no dep.
- Browser: Canvas/WebAudio for preview + waveform; **WebCodecs optional**
  acceleration, never the only path.
- No new runtime npm deps in the engine if avoidable (the bar the rest of
  the project holds).

## 5. Licensing risk notes (do this before bundling)

- **FFmpeg is LGPL or GPL depending on build.** Plan: ship the **LGPL build**
  with permissive external encoders (libvpx/VP9, libopus, AOM/AV1 — all
  BSD/permissive) so the studio's DEFAULT exports (WebM/VP9, Opus, AV1, MP4
  w/ openh264 where legal) are clean. Bundle the **license text + source
  offer** like the emulator installer does.
- **H.264/H.265/AAC carry patent licensing.** Do NOT silently bundle a GPL/
  patent-encumbered encoder. Strategy: prefer permissive formats by default;
  for H.264/HEVC, **detect** a system/user-provided codec, or export to a
  safer format with a clear label. Same honesty pattern as the emulators:
  "import but warn / convert / mark unsupported / export safer".
- Never ship anything that forces a license conflict with the rest of the
  (MIT-spirit) project. Permissive-first, always.

## 6. Build first vs delay

**First (Phase 1, smallest safe):** import photo/video/voice → media library
→ inspect (FFprobe) → preview → audio waveform → one-track timeline with
**big beginner grab-handles** → trim start/end → split at playhead → **Save
as New Media Clip** (originals preserved) → export → **Send to Website
Builder Assets / Mobile App Builder Assets** → the offline help/data pack.

**Delay:** layers/masks/healing/clone, RAW development, multi-track timeline,
keyframes, color grading, chroma key, proxies, and ALL local-AI features
(transcription/object/background removal) — Phase 4–6, only if fully offline
and realistic.

## 7. Realistic offline · 8. Unrealistic/risky

**Realistic:** format inspection, trims/cuts/splits, transcode, thumbnails,
waveforms, image resize/convert/crop/color, photo→video segments, subtitle
import/burn, render queue — all FFmpeg/Sharp, all local. **Risky/avoid for
now:** bundling patent-encumbered codecs; pretending to support pro-camera
RAW (.r3d/.braw/.ari) which need vendor SDKs — *inspect/label as
"requires optional component," don't fake decode*; cloud/online-AI anything;
loading giant videos into memory (use proxies/streaming).

## 9–11. Integrations

- **Website builder:** "Send to Website Builder Assets" copies the edited
  file into the existing media library (`src/builder/media/`) so the image
  block / gallery pick it up; offer web compression + WebP/AVIF + responsive
  sizes + a manual alt-text field. Never change live files without confirm.
- **Mobile app builder:** export presets for app icon / splash / onboarding;
  drop into the app builder's asset area; never overwrite without confirm.
- **Mini-OS / profiles:** files live under `portable/` per profile; the
  studio appears as a mini-OS section with file browser, recent files,
  trash, the shared export center, and the render queue.

## 12. Tax/private protection

Tax files stay under the encrypted `tax/` area with `privacyLevel:
"tax/document-protected"`. The media index may know they exist but the
Studio gallery **filters them out** and won't open/preview them unless the
user explicitly chooses Import. No thumbnails generated for protected files.

## 13. Phone voice-memo / recorder import

Accept `.m4a/.aac/.mp3/.wav/.caf/.aiff/.flac/.ogg/.opus/.amr/.3gp` (iPhone
Voice Memos, Google/Samsung recorders). Flow: import → FFprobe detects
codec/duration/sample-rate/channels → Canvas/WebAudio waveform → play/scrub
→ grab-handle trim → split/silence-trim (manual) → volume/fade → **Save as
New Audio Clip** (original untouched) → place on the video timeline → mix on
export. `.caf`/`.amr` may need transcode-on-import to a friendlier working
format (warn, keep original).

## 14. Timeline grab-bars & Save-as-New-Clip

Pure **timeline model** in `engine.ts`: clips with `{sourceId, inPoint,
outPoint, trackOffset}`. The UI renders each clip with **big left/right
trim handles** (drag-left trims start, drag-right trims end, drag-center
moves), a time tooltip, snapping lines, arrow-key nudge, and **undo/redo on
every drag** (reuse the builder's history engine). "Save as New Media Clip"
asks FFmpeg to cut `[inPoint, outPoint]` into a new file in
`media/new-clips/` with collision-proof naming (`name-trimmed-001.mp4`),
preserving the original — then offers Send-to-Website/App/Shared-Exports.
Simple Mode = big clips/handles/obvious buttons; Advanced Mode = multi-track,
frame-level, ripple/roll, keyframes, waveform, proxies.

## 15. Step-by-step implementation plan

1. `media-studio/schemas.ts` — MediaItem, MediaStudioProject (timeline,
   tracks, clips), ExportPreset, privacyLevel; zod + tests. **(pure, safe to
   start any time)**
2. `media-studio/formats.ts` — the offline data pack: supported photo/video/
   audio/subtitle formats with support level (full/import-only/preview-only/
   requires-component/unsupported), export presets (web/app/social/general),
   aspect ratios, DPI/compression/color-space guidance, plain-language help.
   Pure + tested. **(high value, zero risk — do this early)**
3. `scripts/install-media-tools.mjs` — checksum-pinned FFmpeg/FFprobe sidecar
   installer (mirror install-retro-tools.mjs) + THIRD_PARTY_NOTICES.
4. `media-studio/ffmpeg.ts` — pure argv composers (probe, thumbnail,
   waveform, trim, transcode) returning `{bin,args}` arrays (never shell
   strings); unit-test the composition.
5. `app/api/builder/media-studio/route.ts` — admin-gated, fs-mode: import,
   probe, thumbnail, waveform, render-clip, export; spawns the sidecar.
6. `media-studio/editor/` — library grid, preview, the one-track timeline
   with grab-handles, Simple/Advanced toggle, Save-as-New-Clip, Send-to
   buttons, render queue, offline help drawer.
7. Wire a Media Studio entry into the Workshop nav (Game-Mode-style optional
   section); keep it out of public route bundles (budget gate).
8. Tests + `next:build` + e2e smoke; commit per chunk to the branch.

**First commit target:** steps 1–2 (schemas + the offline format/help data
pack with tests) — pure, dependency-free, immediately useful, and they make
every later step concrete. Then the sidecar + trim/export.
