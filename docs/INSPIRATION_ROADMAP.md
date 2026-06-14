# Inspiration Roadmap — suite-grade bells & whistles, original only

*Baghdo asked: study the broad categories behind the big creative/office/
workspace suites — never their UIs, names, or workflows — and decide what
belongs in Baghdo's Workshop. Standing law: the builder/export engine
stays the source of truth; nothing here copies a proprietary product;
local-first wherever possible.*

Every feature below is scored: difficulty (S/M/L), where it lives
(local / optional-cloud), what it connects to, export/performance impact,
and the phase. **MVP = built in this pass** (see the commit), Phase 2 =
next sessions, Future = parked deliberately.

---

## 1. Worth adding NOW (MVP — implemented in this pass)

| Feature | What & why | Diff | Lives | Connects to | Exports? | Perf? |
| --- | --- | --- | --- | --- | --- | --- |
| **Spec/price table block** | Office-suite-inspired label/value tables (specs, price lists, menus, hours of operation beyond hoursTable). Beginners get structured content without layout fiddling. | S | local | block registry → generated forms, i18n, exports | yes — renders in every target | none |
| **"View code" panel** | Web-dev-inspired: one click shows the REAL exported HTML of the open page (the same renderer the export uses), copy-out. Teaches what the builder produces, helps hand-off. | S | local | exporter (in-memory single-page render) | no (read-only view) | none (on demand) |
| **AI copy presets** | Three new one-click local-AI tasks: product description writer, SEO title+description suggester, mobile-friendliness review. Same gated, loopback-only engine. | S | local (offline once models exist) | AI panel/tasks registry | no | none |

Also already shipped earlier and counting toward this list: media library
(asset library), starter templates, brand-colors-as-theme, SEO panel +
sitemap/robots, audit (accessibility + layout + contrast), per-page
search preview, version history, backup/restore, deployment presets
(service presets), forms block, video block.

## 2. Add LATER (Phase 2 — concrete file plans exist)

- **Brand Kit** (creative): `builder/brand.json` — logo, palette,
  voice/tagline, contact block — feeding theme tokens, chrome, templates
  and AI context. M · local · touches exporter (og defaults) · Phase 2
  because it deserves its own panel + template rewiring.
- **PDF/print exports** (office): print-stylesheet polish + a "Save as
  PDF" guide per export; printable invoice/flyer page templates. S-M ·
  local (browser print engine; no PDF lib needed) · export-affecting.
- **Data table block bound to a dataset** (no-code): CSV→`builder/data/
  datasets` (machinery exists from ZIP data) rendered as a sortable
  table block. M · local · exports as static HTML table.
- **Page-weight row in Audit** (performance): sum referenced media sizes
  via the media API; warn over ~1.5 MB. S · local.
- **Slide-style export** (office): pages → a scroll-snap "deck" export
  preset reusing existing blocks. M · novel and cheap — a flashy demo.
- **Comments/review mode** (collab): margin notes per block id stored in
  `portable/` (private) or a `builder/reviews/` doc (shared via git). M ·
  local-first; git IS the collaboration transport.
- **Mockup frames** (creative): wrap a screenshot/preview in original
  device-neutral frames for marketing images. S · local.

## 3. NOT worth adding

Email/calendar/chat (a different product), real-time co-editing (massive
infra; git-based handoff already works for a family), font marketplace
(OFL Noto set + system stacks cover it), stock-asset browser (license
trap; the media library is for YOUR photos), cloud storage sync (the
thumb drive + git remote are the sync).

## 4. Too big / too risky

Full vector design editor (years of work; inline SVG upload + swatches
cover the need), video editing, a hosted multi-tenant accounts system
(explicitly out while this is family-scale), plugin marketplace
(arbitrary third-party code inside the gates breaks the safety story).

## 5. Best for beginners

Generated forms (done), starter templates (done), the tour + Help
(done), **spec table** (now), Brand Kit (P2), AI copy presets (now),
audit-with-Fix-buttons pattern extended everywhere.

## 6. Best for small businesses

Contact form presets (done), hours/map/social (done), **price/spec
tables** (now), printable flyer/invoice templates (P2), SEO presets
(done + AI suggester now), order tracking — already exists for Lusik via
the real commerce stack; generic shops get it through service presets.

## 7. Best for website development

**View-code panel** (now), per-route bundle budget (done), sitemap/
robots/404 (done), deployment presets (done), dataset tables (P2),
Lighthouse-style audit rows (P2 page-weight).

## 8. Best for mobile app building

Viewport presets + grading (done), PWA/TWA/SwiftUI exports (done),
safe-area/hinge overlays (done), scroll-snap deck export (P2 — doubles
as an app onboarding flow).

## 9. Open-source library leverage

Everything stays on the existing stack: zod (validation), jszip
(archives), Tailwind (styling), Playwright (verification), Godot (MIT,
fun layer), Ollama/llama.cpp (local AI), DOSBox-X/86Box/QEMU (GPL
sidecars). No new runtime dependencies were needed for the MVP items —
that's the bar future features should meet too.

## 10. Keep as simple "inspired-by" versions, never full copies

Tables (label/value + dataset tables — not a spreadsheet engine), slides
(scroll-snap deck — not a presentation app), comments (margin notes —
not threaded review suites), Brand Kit (one JSON + panel — not an asset
management platform), AI helpers (task presets over the local engine —
not an embedded copilot brand).
