# §30 — Creation Studio (the all-in-one creation platform)

*Captured from the product brief. Offline-first, privacy-first, beginner-first,
zero-royalty. The existing website/app builder stays the foundation; everything
here is an OPTIONAL mode/preset/section beside it — never a replacement.*

## Naming (recommended)

- **Overall section: Creation Studio** ✓ (clear, broad, friendly — beats "App
  Studio"/"Mini Software Studio" which are narrower).
- **3D builder: Immersive 3D Builder** (preset button: *"Add 3D Scroll
  Experience"*). "Cinematic Website Builder" is a fine alt subtitle.
- **Business software: Business App Builder** (internal: "Mini Software
  Builder"). The first shipped template is **Store Manager** (Phase 4).
- **360 media: Virtual Tour Builder** (subtitle "360 Photo & Video").
- **Photo Booth: Event Photo Booth Builder**.
- **Cross-mode prompt panel: Vibe Builder** (reuse the local intent pattern
  already shipped in Communication Coach / Game Lab — no cloud AI).

## How it maps onto THIS repo (so it's not a disconnected rewrite)

Every Creation Studio mode follows the proven module pattern already used by
Tax / Media Studio / Communication Coach / Game Lab:

- **Pure engine + bundled content + tests** under `src/builder/studio/<mode>/`.
- A **client tool route** `app/tools/<mode>/page.tsx` → `<Mode>Route` (ssr:false,
  `robots:{index:false}`, reads the launcher `#token`), offline via
  `localStorage`/IndexedDB.
- Server work only where needed via an **admin-gated, fs-mode** API
  (`app/api/builder/<mode>`), e.g. "save to drive" / generate a standalone app —
  same posture as `gamelab`/`media-studio`/`stt`.
- The **website builder stays source of truth**; modes export *blocks/screens*
  back into it or as standalone projects. Editor isolation gate still applies.

Shared foundation (Phase 1) = these conventions + the existing storage layer,
asset/byte-sniff helpers, the bundle-budget gate, and the local "vibe" intent
parser pattern. We don't rebuild a second project system.

## Progress

- ✅ **Phase 2 — Immersive Builder** (scroll-story 3D) — BUILT (`/tools/immersive`).
- ✅ **Phase 4 — Store Manager** (customer/inventory/barcode/purchase history) —
  BUILT (`/tools/store`).
- ✅ **Phase 8 — Event Photo Booth Builder** — BUILT (`/tools/photo-booth`).
- ⬜ Phases 1 (foundation hardening), 3, 5, 6, 7, 9, 10–13 (cross-cutting),
  14 (MVP rollup) — remaining.

## Build order (the brief's 14 phases, with our notes)

1. **Shared foundation** — already largely present (project/save/load, local
   storage, templates, inspector pattern, export, permissions, a11y/perf gates).
   New modes reuse it.
2. **Immersive 3D Builder** — scroll-driven 3D website/app sections. Tech:
   Three.js / React-Three-Fiber + a scroll-timeline, **bundled locally**,
   **opt-in only**. Quality presets (Lightweight/Balanced/High/Desktop), static
   + reduced-motion fallbacks, a pre-export *mobile performance score*. Reuses
   Game Lab's GLB/placeholder + codegen ideas. Presets: product reveal, brand
   story, portfolio, restaurant, app landing, mini-game landing, showroom.
3. **Business App Builder** — visual generator for small business tools
   (inventory, CRM, orders, invoices…). Local DB (IndexedDB in browser / SQLite
   for desktop export), CSV/XLSX/PDF/DOCX export where practical, barcode
   (keyboard-input first). **No card data ever**; payments only via official
   Square/Clover/Stripe APIs later.
4. **Store Manager (Customer/Inventory/Barcode/Purchase-history)** — *BUILDING
   NOW.* The first concrete, real-world template (for Gohar's store): customers,
   products/inventory, orders/purchase history, barcode-by-keyboard, low-stock
   alerts, reports + CSV export, backup/restore, anonymize/delete, retention.
5. **Reports, documents, exports** — search/CRUD/validation, CSV/XLSX/PDF/DOCX,
   print reports, PIN lock, export warnings. (Store Manager seeds this.)
6. **Virtual Tour Builder (360)** — equirectangular photo/video viewer with
   drag/touch/gyro, hotspots, labels, scene links; bundled viewer, no CDN.
7. **Sensor Interaction Builder** — opt-in gyro/accelerometer with mandatory
   non-motion fallbacks, sensitivity/smoothing/deadzone, reduced-motion respect,
   clear permission disclosure, never tracking.
8. **Event Photo Booth Builder** — camera preview, countdown, frames/stickers/
   logo/text overlays, filters, strip/grid/collage, local save/export. Camera
   permission first, visible-when-active, no auto-upload, no face recognition.
9. **Vibe Builder (all modes)** — one local intent/template parser routing to
   each mode; guided choices when unsure. (Same engine family as Coach/Game Lab.)
10. **Component system** — shared reusable components per mode (3D scene/object/
    scroll-trigger; business form/table/barcode/report; 360 viewer/hotspot;
    sensor controls; booth camera/overlay layers).
11. **Data model** — local models per mode (see each mode's `schemas.ts`).
12. **Export strategy** — website module, mobile screen, local web app, Windows
    desktop (Tauri preferred / Electron fallback), source ZIP, template, report,
    backup. Each export ships README/LICENSES/PRIVACY_NOTES/PERFORMANCE_NOTES/
    ACCESSIBILITY_NOTES + app_config.json + assets.
13. **Privacy/security/perf/safety** — no card data; ask before camera/mic/
    sensors; show-when-active; no secret record/upload; no biometric/face-rec in
    v1; retention + delete/anonymize; PIN lock; 3D opt-in + fallbacks; licensed
    assets only; never a payment processor / never bypass POS hardware.
14. **MVP v1** — the brief's 35-item list, delivered phase by phase.

## Phase 4 data model (Store Manager — building now)

Local tables (zod-validated), exportable as `*.schema.json`:

- **Customer**: id, first/last, phone, email, address?, birthday?, notes,
  preferences, favoriteProducts, tags, consent, createdAt, lastVisit,
  totalPurchases, returnsNotes, staffNotes.
- **Product**: id, name, sku, barcode, category, vendor, costCents, priceCents,
  stock, reorderThreshold, supplier, variant, notes, imageRef, createdAt,
  updatedAt.
- **Order**: id, customerId, date, items[], discountCents, taxCents,
  paymentMethodLabel (label only — NEVER card data), notes, receiptNumber,
  source (in-store/online/manual/imported).
- **OrderItem**: productId, name, qty, unitPriceCents.
- **InventoryMovement**: id, productId, delta, reason, at.
- **Note**: id, customerId, text, at.

Engine (pure, tested): search (name/phone/email/id), **barcode lookup** (product
or customer; offer-create when missing), low-stock detection, order totals,
retention filter (1/3/5yr/custom), **anonymize/delete** a customer, CSV export
of any table, and JSON **backup/restore** of the whole store.

Storage: `localStorage` for v1 (shape-validated, with a "data lives on this
device / back it up" warning + last-backup date). IndexedDB + encrypted DB are
the documented upgrades.

## Privacy / security (hard rules, enforced)

No payment card data, ever (payment method is a **label** only). Data stays on
the device unless the user exports/backs-up. Export warnings (files contain
customer data). Delete/anonymize + retention settings. Optional PIN lock.
Licensed/own assets only. Official Square/Clover/Stripe APIs only if payments
are ever added — never custom card handling, never POS reverse-engineering.

## Accessibility / performance

Beginner-friendly screens; real HTML controls; keyboard-usable tables/forms; 3D
and motion strictly opt-in with static + reduced-motion fallbacks and a
pre-export performance score; lazy-load heavy content; honest "this may be slow"
warnings.

## MVP v1 (delivered in order)

Per the brief's 35-item list. **This pass delivers the Phase-4 core**: Store
Manager (customers + inventory + barcode-keyboard + purchase history + low-stock
+ CSV export + backup/restore + privacy/retention), running fully offline. The
3D/360/sensor/photo-booth modes follow as their own phases, each standing alone.

## Future roadmap

Advanced 3D storytelling + camera/timeline editors, AR/VR where practical,
WebGPU; advanced 360 editing + multi-scene tours; advanced sensor logic;
photo-booth collage/GIF/QR; receipt/label printers; Square/Clover/Stripe
integration; multi-device sync; encrypted DB; cloud backup; user roles; advanced
reports. All additive — none change the offline-first core.
