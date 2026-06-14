# §30 — Creation Studio: overview, components, data model, exports, audit

*The consolidation reference (Phases 10–13) + the MVP-rollup note (Phase 14).
Everything here is offline-first, on-device, and on branch
`claude/codebase-review-w50a0a`. See `CREATION_STUDIO_PLAN.md` for the phase plan.*

## The modes (one front door: `/tools`)

| Mode | Route | Module | What it is |
| --- | --- | --- | --- |
| Hub | `/tools` | `studio/ui/StudioHub` + `studio/tools.ts` | Lists every tool; carries the Workshop token forward; cross-mode vibe box. |
| Website & App Builder | `/builder` | `builder/editor/*` | The main product (unchanged). Now links to the hub ("🎨 Studio"). |
| Immersive Builder | `/tools/immersive` | `studio/immersive` | Scroll-story 3D pages → progressive-enhanced HTML/CSS/JS. |
| Business App Builder | `/tools/business-app` | `studio/bizapp` | Blueprint generator → schema/config files. |
| Store Manager | `/tools/store` | `studio/store` | Running customer/inventory/orders app + CSV/XLSX/PDF reports. |
| Virtual Tour Builder | `/tools/tour` | `studio/tour` | 360 photo/video tours → bundled WebGL viewer. |
| Sensor Builder | `/tools/sensors` | `studio/sensors` | Opt-in tilt/shake module + fallbacks. |
| Photo Booth Builder | `/tools/photo-booth` | `studio/photobooth` | Camera booth → standalone offline booth. |
| Game Lab | `/tools/game-lab` | `gamelab` | Mini games → Godot/GDScript projects. |
| Communication Coach | `/tools/coach` | `coach` | Offline outreach + interview coaching. |
| Media Studio · Tax · Payroll | `/tools/*` | `media-studio`/`tax`/`payroll` | Earlier offline tools. |

## Phase 10 — shared component vocabulary

Each mode ships its own typed component/primitive set (kept in its `schemas.ts`),
intentionally **not** force-merged so a mode stays self-contained:

- **Immersive:** Section (hero/text-reveal/image-reveal/product-card/showcase/
  cta/spacer) + animation + quality tier.
- **Business app / Store:** Table · Field (text/longtext/number/money/date/time/
  bool/select/relation) · Screen (dashboard/list/form/detail) · Customer/Product/
  Order/OrderItem/InventoryMovement.
- **Tour:** Scene360 · Hotspot (info/link/scene) · viewer camera.
- **Sensors:** SensorProfile · MotionRule (events → actions) · fallbacks.
- **Photo Booth:** BoothProject · layout cells · overlay/filter.
- **Game Lab:** GameProject · Entity · Rule (event → action).

Shared *patterns* (not a shared widget lib): preset/template → pure engine →
codegen file-map → UI (dynamic, ssr:false, noindexed) → ZIP/file export, plus
the local "vibe" intent parser pattern reused everywhere.

## Phase 11 — data model (storage)

All local; **no server required** for any mode's core.

| Mode | Persistence | Key(s) |
| --- | --- | --- |
| Store Manager | localStorage | `lusik_store_v1` |
| Business App | localStorage | `lusik_bizapp_current` |
| Immersive | localStorage | `lusik_immersive_current` |
| Tour | localStorage | `lusik_tour_current` + `lusik_tour_assets` |
| Sensors | localStorage | `lusik_sensors_current` |
| Photo Booth | localStorage | `lusik_photobooth_current` |
| Game Lab | localStorage | `lusik_gamelab_current/_assets/_templates` |
| Coach | localStorage | `lusik_coach_*` |
| Cross-mode seed | sessionStorage | `lusik_studio_vibe` |
| Workshop token | sessionStorage | `lusik_builder_local_token` |

Every mode round-trips through a zod schema on read; exports/backups are
validated and reject foreign/newer files.

## Phase 12 — export strategy

| Mode | Exports |
| --- | --- |
| Immersive | standalone web page (ZIP), config JSON |
| Business App | blueprint ZIP (app_config + per-table JSON-Schema + SCREENS + docs), config |
| Store Manager | CSV / **XLSX** / **print-PDF** reports, JSON backup/restore |
| Tour | standalone 360 viewer (ZIP, bundled WebGL), config |
| Sensors | standalone motion module (ZIP), config |
| Photo Booth | standalone booth (ZIP), local photo download, config |
| Game Lab | Godot project (ZIP), config; "save to drive" API |

Every generated bundle ships README + (where relevant) LICENSES /
PRIVACY_NOTES / PERFORMANCE_NOTES / ACCESSIBILITY_NOTES, and **no CDN /
third-party-library dependency** — viewers/runtimes are hand-written and bundled.

## Phase 13 — privacy / security / performance / licensing audit

Confirmed across the modes:

- **No payment-card data** anywhere — Store/Business App store a payment *label*
  only; the Business App validator hard-refuses card-like field names.
- **Camera / mic / sensors:** opt-in, permission-first, visible-when-active, no
  auto-upload, no face recognition / biometrics, stopped on leave (Photo Booth,
  Sensors, Tour gyro).
- **Reduced motion** respected and **non-motion fallbacks** mandatory (Immersive,
  Sensors). Immersive content is real HTML that works with JS off.
- **Performance:** Immersive ships a mobile performance score + quality tiers;
  3D/360/animation lazy/offscreen-aware; tool routes stay ≤ ~132 KB (budget 210).
- **Licensing:** placeholders/shapes only; "use only your own or properly
  licensed media"; no copyrighted assets bundled. Godot (MIT) is the only
  external engine, used as an export target.
- **Data:** local-only; export warnings on files with personal data;
  delete/anonymize + retention (Store), backup/restore everywhere it matters.

## Phase 14 — MVP rollup

- The **hub `/tools`** is the single entry; the **main builder links to it**
  ("🎨 Studio" in the header), and the hub links back to the builder — so the
  whole platform is reachable from the normal flow.
- The **cross-mode vibe box** routes a plain-English idea to the right mode and
  pre-seeds the vibe-capable builders.
- The Workshop launcher token flows hub → every tool (same-origin sessionStorage).

## Loose ends — status

**Closed (offline, built + tested):**

- ✅ **Business App runtime** — generated blueprints now RUN (generic record
  store + screen renderer; `▶ Run app` in the builder). `bizapp/runtime.ts`.
- ✅ **Encrypted local DB** — optional AES-256-GCM + PBKDF2 per-app passphrase
  lock. `bizapp/secure.ts`.
- ✅ **Payments (official-only connector)** — stores an official hosted checkout
  link (Square/Clover/Stripe), validated host+https, **never card data**.
  `bizapp/payments.ts`. (A real OAuth/API charge flow needs the provider's keys
  + internet and is out of the offline core by design.)
- ✅ **Move data between devices** — offline answer is built: every app + the
  Store have **backup → restore** (a file you carry over). True *live* cloud
  sync needs a server and is intentionally not in the offline build.

**Genuinely needs online/hardware (deliberately deferred):**

- **Richer 3D (WebGL/GLB) in Immersive** — a from-scratch glTF loader + PBR
  renderer with **no CDN/library** isn't worth hand-rolling; the offline v1
  (scroll + CSS-3D + the dependency-free 360 viewer) is the shippable tradeoff.
- **Live multi-device cloud sync / cloud backup** — requires a backend.
- **Square/Clover/Stripe live charges** — official APIs need keys + internet.
- **Compile the Windows `.exe`, merge PR #254, SwiftUI on a Mac, Godot export**
  — hardware/credentials + a shipping decision (the owner is holding "ship").
