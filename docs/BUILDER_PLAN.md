# Lusik & Sons — Visual Builder & CMS: Architecture Plan

**Status: design document — Phase 1 deliverable (audit + architecture). No builder
code exists yet; nothing in this document changes the live site.**
Written 2026-06-11 against `main` @ `50f4c87`.

Two products, one engine:

- **The Builder** — a standalone visual website builder: blocks, templates,
  pages, themes, responsive/mobile-first editing, e-commerce blocks, and
  export to Next.js / static HTML / Vite.
- **Lusik CMS Mode** — the same engine mounted inside the Lusik & Sons app in
  a locked-down configuration, editing the live site's content, layout,
  theme, and mobile polish without being able to break checkout, pricing,
  SEO, or performance.

---

## 1. Verdict on the proposed architecture

The proposed direction — *store pages as structured block/template data, use
export adapters to generate Next.js / Vite / static output* — is **correct**,
with one critical refinement:

> **Renderer-first, export-second.** Build ONE React block-renderer package
> that is used by (a) the editor's preview, (b) the Lusik site itself at
> build time, and (c) the Next.js export adapter. The static-HTML exporter
> is that same renderer run through React SSG; the Vite exporter is the same
> components in a Vite shell. Export adapters emit *scaffolding + data*, not
> per-block generated code.

Why this matters: the classic way builders rot is three divergent code
generators that each render blocks slightly differently. With renderer-first
there is exactly one source of truth for what a block looks like; "export"
is mostly copying the renderer package plus your data into a project
skeleton. It also means **the Lusik site itself is the permanent integration
test for the Next export path** — if the site renders, the export works.

The 12-phase plan is endorsed with adjustments (§13): the renderer extraction
must happen earlier than implied, and the revision system can start thin
because git already provides durable history.

---

## 2. Audit — what exists today

### Already CMS-driven (data, not code) ✅
| Surface | Where | Edited via |
| --- | --- | --- |
| All 11 products (live + placeholder) | `content/products/*.json` | Decap Studio `/studio` |
| 4 shop categories | `content/categories/*.json` | Studio |
| Announcement bar, FAQ, home featured pick, Story, testimonials | `content/pages/*.json` | Studio |
| Journal posts | `src/data/journalPosts.js` (code-side data) | Studio (journal collection) |

Compiled by `npm run gen:data` into `src/data/*.generated.js` at build time,
with the **trusted-products reconciliation gate**: a `status:"live"` product
must have a `trustedKey` in `netlify/functions/_lib/trusted-products.mjs`
and a price equal to that row to the cent, or the build fails. This gate is
the design seed for the whole builder: *edits are data; a build-time
validator decides if the data is publishable.*

### Hardcoded today (the builder's future territory) 🔧
| Layer | Where | Notes |
| --- | --- | --- |
| Page layouts & section order | JSX in `src/routes/*` + `src/components/*` | Home, story, FAQ, etc. compose sections in code |
| All UI components | `src/components/**` (~60 components) | Cards, drawers, accordions, galleries, lightbox, breadcrumbs, mega-menu |
| Theme | `tailwind.config.mjs` (61 lines) + `src/styles/index.css` (2,128 lines) | Colors, fonts, radii; Liquid Glass nav is ~43 `backdrop-filter` rules |
| Mobile nav (pill bar, search orb, search overlay) | `MobileBottomNav`, `MobileSearchView` + CSS | The thing item #6/#8/#9 wants to make editable |
| Copy/i18n strings | `src/i18n/translations.js` (en/hy/hyw) | Any builder text editing must keep the hy pathway |
| Dial board | `src/data/config.js` (`CONFIG`) | Sheet detents, swipe physics, bundle-discount copy, free-shipping bar |
| Commerce UI | `ProductShowcase`, `CustomProductCard`, `CheckoutView`, cart | Bound to cart-ID shape + trusted keys |

### Existing guardrails the builder must respect (and reuse) 🛡
- **Trusted-products gate** (price integrity) — already exists, stays the
  publish-blocker for anything commerce.
- **Bundle budget**: 210 KB gzip first-load per route, enforced postbuild —
  becomes the enforcement that editor code never ships to public routes.
- **E2E suite** (Playwright, desktop+mobile projects) — regression net for
  every builder phase.
- **Browser↔server drift tests** — pricing copy can become editable only via
  the same pattern.
- **Auth**: Netlify Identity + `requireAdmin` role gating (`/admin` order
  dashboard) — the builder reuses this exact gate; on self-host it verifies
  against self-hosted GoTrue (already supported by `_lib/auth.mjs`).
- **Security headers/CSP** in `netlify.toml` + `next.config.mjs` — locked.

### Existing admin surfaces
- `/admin` — order dashboard (Next route, untouched by this project).
- `/studio` — Decap CMS (Netlify Git-Gateway-dependent). Coexists during the
  build-out; retired once Lusik CMS Mode covers its collections (it is the
  one content path that would NOT survive leaving Netlify).

---

## 3. Target architecture

```
src/builder/                     # the engine (one package, three consumers)
├── schema/                      # zod schemas: Block, Page, Template, Theme,
│   │                            #   MobileOverride, Revision + versioning/migrations
├── renderer/                    # React components for every block type.
│   │                            #   ZERO editor imports. Server-component friendly.
│   │                            #   Consumed by: editor preview, Lusik site, exports.
├── engine/                      # pure logic: tree ops (move/duplicate/delete),
│   │                            #   override cascade resolution, validation,
│   │                            #   guardrail checks (contrast, tap targets, collisions)
├── storage/                     # adapter interface + impls:
│   │                            #   fs (dev / home server / thumb drive)
│   │                            #   github (Netlify / any cloud host — commits via API)
├── editor/                      # the editing UI. Dynamically imported ONLY
│   │                            #   under /builder routes. dnd-kit, TipTap,
│   │                            #   inspector panels, device preview, overlays.
└── adapters/
    ├── lusik/                   # Lusik CMS Mode: collection bindings to content/**,
    │                            #   lock profile, i18n bridge, trusted-products binding
    └── export/                  # nextjs / static / vite / zip emitters (§10)

builder/                         # DATA (git-tracked, like content/)
├── pages/*.json                 # builder-owned page documents
├── templates/*.json             # saved templates (section/page/component/nav)
├── theme.json                   # design tokens
└── overrides/*.json             # per-breakpoint patch layers
```

**Editing pipeline:** Editor UI → engine mutations on the document →
storage adapter persists (fs write or GitHub commit) → build runs the same
generators + gates as today → deploy. Preview = the renderer fed the draft
document (in an iframe in the editor; via deploy previews / local builds for
full-fidelity checks).

**Public-site cost: zero.** Published pages are rendered at build/SSR time by
`renderer/` exactly like today's hand-written components. No editor
JavaScript, no client-side page-building, no schema parsing in the browser.
The bundle-budget script gains an assertion that no public route imports
from `src/builder/editor/`.

**Portability is inherited, not added:** the storage adapter is the same
fs/GitHub split designed for the thumb-drive plan. On Netlify, Publish
commits to GitHub (triggering the normal gated build). On a home server,
Publish writes to disk and rebuilds locally. The engine never knows which.

---

## 4. Data model (the five schemas)

All schemas carry `schemaVersion`; the engine ships migrations so old
documents always load. Validated with zod at every read AND before every
write — malformed data can't be saved, and can't crash a build.

### Block — the atom
```ts
interface Block {
  id: string;                    // stable nanoid — overrides/revisions key off it
  type: string;                  // "hero" | "richText" | "image" | "gallery" | "accordion"
                                 // | "drawer" | "tabs" | "card" | "promoCard" | "slideshow"
                                 // | "breadcrumbs" | "announcementBar" | "faqSection"
                                 // | "pillNav" | "searchLauncher" | "productCard"
                                 // | "swatchRow" | "addToCart" | "section" | "columns" | ...
  props: Record<string, unknown>;   // validated by the block type's own zod schema
  style?: StyleProps;               // token-referencing: spacing/align/width/radius/bg
  children?: Block[];               // containers only (section, columns, drawer, tabs)
  visibility?: { desktop?: boolean; tablet?: boolean; mobile?: boolean };
  locks?: { move?: boolean; delete?: boolean; edit?: boolean; reason?: string };
}
```
`StyleProps` references **theme tokens** (`"spacing.md"`, `"color.ink"`) with
escape-hatch raw values; that's what makes global restyling and the theme
panel possible. Rich text props are **TipTap/ProseMirror JSON documents,
never HTML strings** — rendered through our own React serializer, so script
injection is structurally impossible (constraint #20 "sanitize rich text" is
satisfied by construction, with a sanitizer belt-and-suspenders at render).

### Page
```ts
interface Page {
  id: string; slug: string; parentId?: string;        // nesting
  kind: "landing" | "standard" | "product" | "category" | "journal" | "policy";
  title: string; order: number;
  seo: { title?: string; description?: string; ogImage?: string };  // fields editable,
                                                       // metadata STRUCTURE locked (§5)
  sections: Block[];
  status: "draft" | "published";
  publishedHash?: string;        // content hash of last published version
}
```

### Template
```ts
interface Template {
  id: string; name: string;
  kind: "section" | "page" | "component" | "nav" | "pillNav";
  root: Block | Page;            // page templates store a full Page skeleton
  thumbnail?: string;
}
```
Save/duplicate/rename/delete/reuse = file operations on `builder/templates/`.
Export/import = the file itself (they're self-contained JSON) — free.

### Theme
```ts
interface Theme {
  tokens: {
    colors: Record<string, string>;        // ink, cream, gold, ... (seeded from tailwind.config)
    fonts: { display: FontDef; body: FontDef; accent: FontDef };
    typeScale: Record<string, ClampDef>;   // fluid sizes
    spacing: Record<string, string>;
    radii: Record<string, string>;
    shadows: Record<string, string>;
    glass: GlassPreset[];                  // §6 — named Liquid-Glass/frosted presets
  };
  components: {                            // per-component style slots
    button: ButtonStyles; card: CardStyles; drawer: DrawerStyles; ...
  };
}
```
Compiled to CSS custom properties at build time. The current Apple-style /
Liquid Glass look is captured as the **default theme** — preserved unless
deliberately changed (constraint #11).

### MobileOverride — the breakpoint patch layer
```ts
interface OverrideLayer {
  pageId: string;
  breakpoint: "tablet" | "mobile";         // cascade: base → tablet → mobile
  patches: Record<BlockId, {
    props?: Partial<...>; style?: Partial<StyleProps>;
    visibility?: boolean;
  }>;
  mobileOnlyBlocks?: { anchorBlockId: string; position: "before"|"after"; block: Block }[];
}
```
This is the load-bearing answer to requirement #5. Overrides are **sparse
patches keyed by block ID**, not separate page trees:
- A mobile edit *cannot* damage desktop — desktop never reads the mobile layer.
- A desktop edit *cannot* silently wreck mobile — the editor flags overridden
  blocks ("this block has 3 mobile overrides") when you edit the base.
- Deleting an override restores the base. "Reset to desktop" is one click.
- Mobile-only sections are explicit additions, rendered server-side inside a
  CSS visibility wrapper (no JS, no layout shift, no CLS).

### Revision
```ts
interface Revision { docPath: string; ts: string; author: string;
                     label?: string; commitSha?: string }
```
Thin by design: **git is the revision store** (every publish is a commit in
both storage modes — fs mode commits to the local repo too). The revision UI
is an index over that history with one-click rollback (`revert` commit or
file restore). Restoring deleted pages/blocks falls out for free. This keeps
Phase 3 honest instead of building a second versioning database.

---

## 5. Editability tiers (requirement #17)

| Tier | What | Examples |
| --- | --- | --- |
| **Safe to edit/move/delete** | Presentation & copy | Text, images (through the optimizer), section order on brand pages, cards, galleries, FAQ items, testimonials, journal, announcement bar, theme tokens (inside guardrails), promo sections, spacing/alignment |
| **Locked by default** (unlockable per-edit, with a warning) | Structure with blast radius | Nav structure & pill-menu composition, page slugs of linked/shared pages, product-page section composition, hero on home, breadcrumb logic, footer legal links |
| **Never editable from the visual editor** | Money, security, SEO plumbing, a11y skeleton | Stripe/checkout logic & the checkout flow's function calls; server price map (`trusted-products.mjs`) and anything that feeds Stripe; cart-ID shape; auth & admin gating; CSP/security headers; metadata/JSON-LD *structure* (the text fields feeding them are editable); robots/sitemap generation; the Functions directory; consent/ad-pixel gating |

Mechanics: tier 3 simply has no block types — checkout is reachable only as
an opaque `addToCart` / `buyBox` block that *binds* to a product key and
renders the existing battle-tested components. Tier 2 is `locks` +
role-gated unlock. Price display blocks read the generated catalog (which
the gate already reconciles against Stripe) — **a builder page physically
cannot show a price Stripe won't charge.**

---

## 6. The mobile system (requirements #5–#10)

Built as four engine capabilities + block types, not bolted-on features:

1. **Breakpoint cascade + device preview.** The override layer (§4) plus an
   iframe preview at real viewport sizes (390/768/1280 presets + drag), with
   safe-area insets simulated (notch/home-indicator). Hide/show per device =
   `visibility` (rendered as server-side classes, zero JS).

2. **Pill-menu builder (`pillNav` block + nav templates).** The existing
   Liquid Glass bottom nav becomes the first nav template. Editable: buttons
   (add/remove/rename/reorder), icon picker (existing icon set), link
   targets (page / product / search / bag / custom), position (bottom/top/
   floating + offsets), geometry (height, width, radius, padding, gap).
   Saved as `kind:"pillNav"` templates.

3. **Glass/frosted appearance panel.** A `GlassPreset` is ~14 sliders
   (opacity, blur, saturation, brightness, contrast, tint, border width/
   color, shadow, highlight, active-glow, lens/refraction intensity,
   transition ms) compiled to CSS custom properties feeding
   `backdrop-filter` etc. Ships with three presets: **Liquid Glass** (current
   look), **Frosted** (no refraction layers — cheaper & more readable),
   **Solid** (fallback). Guardrails: a live contrast meter over the panel's
   preview, automatic `@supports`/`prefers-reduced-transparency` fallback to
   Frosted, and a perf note when refraction layers are enabled. All of this
   is CSS-only at runtime — same approach as the current nav, so PageSpeed
   cost stays where it is today.

4. **Hit-box & collision engine (editor-side only, zero runtime cost).**
   - Tap-target overlay toggle: draws every interactive element's hit box.
   - Per-block tap-area padding control (invisible touch padding — visual
     size unchanged).
   - Validators (warn → block-publish): targets < 44×44 px, overlapping hit
     boxes, and **fixed-element collisions** — the engine keeps a registry of
     fixed/sticky elements (pill nav, add-to-cart bar, toasts, drawers,
     cookie/consent) and refuses a publish where the pill menu overlaps
     checkout/ATC/form fields at any preview breakpoint (constraint #20).
   - Safe-area: pill/drawer blocks get `env(safe-area-inset-*)` spacing
     controls, defaulted on.

5. **Search & drawers.** `searchLauncher` block (placement: pill button or
   standalone; opens as drawer / overlay / fullscreen — wraps the existing
   `MobileSearchView` behavior) with editable icon/label/placeholder/
   empty-state. Drawer/accordion/dropdown blocks expose: side (bottom/left/
   right), height/width, backdrop opacity + blur, chevron/arrow style,
   animation duration (honoring `prefers-reduced-motion`, like everything
   today), keyboard-safe behavior (visual-viewport listener, the one place
   a little JS is justified — shared, tiny, already needed by the current
   cart drawer).

---

## 7. E-commerce architecture (requirement #13/#14)

**Principle: commerce blocks bind, they don't own.** Product data stays in
the catalog (`content/products/` → generated, gate-checked). Builder blocks
reference a `productKey` and render from the catalog:

- `productCard`, `productGrid`, `featuredProduct`, `relatedProducts` — layout
  editable; name/price/images come from the catalog.
- `swatchRow` (requirement #14) — swatch entries (color, name, description)
  live on the product (extending the existing `colorways` field); the block
  controls layout: horizontal/vertical, size, grouping, compact mobile mode.
- `gallery` / `slideshow` / `lightbox` — bind to product images or free images.
- `inventoryBadge` / sold-out states — read the existing `inventory` Function.
- `addToCart` / `buyBox` — opaque wrappers around the existing cart actions;
  the pill-sheet PDP and configurator products (`CONFIG.SHEET.EXCLUDE_KEYS`)
  keep their specialized components, placeable but not decomposable.
- Checkout, cart math, Stripe session creation: **untouched, unreachable**
  from the editor (tier 3). The standalone Builder gets "bring your own
  Stripe keys" scaffolding at export time (env template + the same
  trusted-products pattern generated per project) — same architecture,
  later phase (10).

For Lusik specifically this means: you'll be able to redesign how products
are *presented* completely, while the path from "Add to bag" to Stripe stays
byte-for-byte the code that's processing real orders today.

---

## 8. Draft / preview / publish / rollback (requirement #18)

- **Draft**: documents save with `status:"draft"`; the storage adapter writes
  them on a branch (GitHub mode: `builder/drafts` branch or per-page branch;
  fs mode: working tree, uncommitted or local branch).
- **Preview**: instant in-editor (renderer in the iframe, draft document);
  full-fidelity via Netlify deploy previews (GitHub mode opens a draft PR —
  same flow Decap's editorial workflow uses today) or a local build (fs mode).
  Mobile preview before publish = the same device-preview iframe + the deploy
  preview on your actual phone.
- **Publish**: validation gates run first (schema, trusted-products, contrast,
  tap targets, collisions, bundle budget) → merge/commit to main → normal
  deploy. Publish is therefore *exactly as safe as today's PR flow*.
- **Rollback**: revision list per page/template/theme from git history; one
  click restores the file(s) and republishes. "Duplicate page before editing"
  is a first-class button (cheap: copy JSON, new id/slug).

---

## 9. Editor library recommendations

| Concern | Recommendation | Why / tradeoff |
| --- | --- | --- |
| Rich text | **TipTap** (ProseMirror) | Word/Docs-style UX (headings, bold/italic/underline, links, lists, alignment, images+captions); stores JSON not HTML; custom React serializer for render. The standard choice in 2026; tree-shakes well; editor-only chunk. |
| Drag & drop / reorder | **dnd-kit** | Lightweight, accessible (keyboard DnD), sensors for touch; powers move/reorder/drag-to-grid. |
| Builder framework | **None (own engine) — deliberate** | GrapesJS/Craft.js bring their own document models and lock the renderer to the editor. Our renderer must be plain React used by the live site, so the engine (tree ops + overrides) is ours; dnd-kit + TipTap + zod cover the hard generic parts. This is *the* architectural decision that keeps public pages fast. |
| Schema/validation | **zod** | Runtime validation + TS types from one definition; powers form generation too. |
| Preview isolation | **iframe + postMessage bridge** | True style isolation, honest viewport/safe-area simulation, and a hard guarantee editor CSS/JS can't leak into page rendering. |
| Resize/grid | CSS + small custom handles | Resize maps to token-stepped width/height (snap = token grid); show grid overlay while dragging. No library needed. |
| Image pipeline | **sharp** at upload (API route) | EXIF auto-rotate on ingest (kills the `ROTATED_GALLERY_INDEXES` class of bug), manual rotate, resize to a size set, AVIF/WebP, strip metadata. |
| Color/sliders/panels | Native inputs + Radix UI primitives | Accessible popovers/sliders/tabs for the inspector without a design-system dependency. |
| State | **zustand** (editor only) | Small, no boilerplate; document state is just the schema objects + an undo stack (command pattern — gives undo/redo nearly free). |

Everything in this table lives in editor chunks only; the public site gains
zero bytes (enforced, §11).

---

## 10. Export system & GitHub workflow (requirements #15/#16)

**Design the format first (agreed — no GitHub automation in step one).**

The **export package format** is the contract:
```
export/
├── builder/            # pages, templates, theme, overrides (the JSON)
├── assets/             # optimized images
├── manifest.json       # schemaVersion, block-type inventory, target, checksums
└── README-RESTORE.md
```

Adapters, in build order:
1. **Next.js adapter** (first, nearly free): scaffold = Next app + the
   renderer package + the JSON. The Lusik site itself is the reference
   implementation, so this adapter is continuously tested by production.
2. **Static HTML/CSS/JS** (second): run the renderer through React SSG per
   page; inline the compiled theme CSS; ship a few KB of vanilla JS for
   interactive blocks (drawers/accordions/lightbox) — these blocks are built
   from day one with a "progressive" mode (CSS-first, `<details>`-style
   semantics) precisely so static export stays honest.
3. **Vite adapter** (third): same React components in a Vite + react-router
   shell. Lowest value (Next adapter covers React hosting; static covers
   everything else) — keep last, cuttable.
4. **ZIP** = any adapter's output, zipped. Free.

**GitHub workflow**, phased: v1 = export + `README` with the three git
commands (init/commit/push) and Netlify/Vercel connect steps. v2 = "Connect
GitHub" button reusing the *already-built* GitHub storage adapter (create
repo, push export, open in Netlify). Nothing new to invent — the risky
automation rides on plumbing the CMS already needs.

---

## 11. Performance, SEO & security guardrails (requirement #20)

- **Editor never ships to the public site**: `/builder` route group, dynamic
  imports, and a new assertion in `scripts/check-bundle-budget.mjs` failing
  the build if any public route's chunk graph reaches `src/builder/editor/`.
- **Published pages are static-first**: renderer output is server-rendered
  exactly like today's components; interactive blocks use the same patterns
  the site already passes Lighthouse with (CSS scroll-driven effects,
  `@supports` + `prefers-reduced-motion` double-gating).
- **No raw HTML anywhere**: rich text is structured JSON → React; `href`
  values validated (no `javascript:`); image srcs constrained to `/img/` +
  the upload store.
- **SEO**: slugs validated + redirect stubs offered on slug change; metadata
  structure & JSON-LD locked (fields editable); sitemap generation extended
  to builder pages via the existing `gen:sitemap` pattern; no client-side
  page assembly, so nothing for crawlers to miss.
- **A11y**: blocks carry required alt/label fields (publish-gated), the
  existing reduced-motion convention is enforced by the renderer, tap-target
  validation per §6, focus management inherited from existing drawer/modal
  patterns.
- **Auth**: `/builder` and all its API routes behind the same admin gate as
  `/admin` (Identity role / `ADMIN_EMAILS`), GoTrue-verifiable on self-host.
- **Images**: ingest pipeline (§9) keeps weight bounded; oversized uploads
  resized, EXIF-rotated, recompressed before they ever hit git.

---

## 12. Risks & tradeoffs (read this section twice)

1. **Scope. This is a multi-month roadmap.** Webflow-class is years of work;
   the phasing below is designed so *every phase ships something Lusik uses*,
   and you can stop at any phase with a coherent product. Phases 1–5 ≈ a
   genuinely better CMS than Decap. Phases 6–9 ≈ the visual builder. 10–12 ≈
   the standalone product.
2. **The two-system trap.** While brand pages migrate to builder documents,
   hand-written pages coexist. Mitigation: strangler pattern with explicit
   convergence targets per phase (FAQ/story/testimonials first → home →
   category pages → PDP last), e2e suite green at every step, and a rule:
   a surface lives in *either* JSX or builder data, never both.
3. **Freedom vs. guardrails tension.** Real Liquid Glass + full layout
   freedom can produce unreadable, slow pages. Position taken: presets
   first, advanced sliders behind "Advanced", and publish-blocking
   validators (contrast/tap/collision/budget) rather than soft warnings.
   You asked for guardrails; they will occasionally tell you no.
4. **Mobile overrides complexity.** The patch-layer model is the simplest
   that satisfies "mobile can't hurt desktop", but stale overrides (base
   block deleted/replaced) need garbage collection + editor warnings — built
   into the engine from the start, or it rots.
5. **Decap retirement.** Two CMSes is temporary; each phase that absorbs a
   collection removes it from `config.yml` until `/studio` is deleted
   (also removes the Git-Gateway Netlify dependency — your portability win).
6. **Repo weight.** Builder JSON is tiny; images aren't. The ingest pipeline
   bounds size; if the repo gets heavy, Git LFS for `/public/img` is the
   escape hatch (thumb-drive bundles still work with LFS, documented then).
7. **i18n.** Builder text fields must carry the en/hy pair like today's
   content does (`label`/`label_hy` pattern) or Armenian rots. The Lusik
   adapter enforces bilingual fields on copy surfaces; the standalone
   builder treats i18n as single-locale v1.
8. **Honest cut lines.** If effort must shrink: Vite export (cut), refraction
   shader realism (Frosted preset covers 90%), nested-page builder for Lusik
   (the site's IA is flat), revision UI (git log covers it short-term).

---

## 13. Phased PR plan

Your 12 phases, refined — renderer extraction moved up (it's the keystone),
revisions thinned (git is the store), each phase = 1–3 reviewable PRs, e2e +
budget green at every merge. **L** = Lusik-usable value ships.

| Phase | Contents | Notes |
| --- | --- | --- |
| **1. Audit & architecture** | This document | ✅ you're reading it |
| **2. Schemas + engine core** | `src/builder/schema` (zod: block/page/template/theme/override/revision + migrations), `engine/` tree ops + override cascade, fixture documents, unit tests | Pure code, zero site impact |
| **3. Renderer + storage + shell** | `renderer/` for the first ~10 block types (section, columns, richText, image, card, accordion, drawer, gallery, faq, announcementBar); fs + GitHub storage adapters; `/builder` admin shell (auth-gated, dynamic-imported); budget-gate assertion | The keystone PR set |
| **4. Lusik CMS adapter — content parity (L)** | Bind products/categories/pages/journal collections; schema-driven forms + TipTap; draft→preview(deploy preview)→publish through existing gates; first Decap collections retired | Replaces Decap for daily editing; works on Netlify AND thumb drive |
| **5. Theme controls (L)** | `theme.json` seeded from current Tailwind/CSS; tokens → CSS vars; theme panel (colors/fonts/sizes/spacing/radius/buttons/cards) + contrast guardrails | Current look = default preset |
| **6. Templates + pages + structural blocks (L)** | Template CRUD (save/duplicate/rename/delete/import/export); page CRUD (create/duplicate/rename/delete/reorder/slug/nest); breadcrumbs/tabs/dropdown/chevron blocks; first JSX brand page (FAQ or Story) migrated to a builder document | Strangler migration begins |
| **7. Mobile editing layer (L)** | Override engine UI, device preview iframe, per-device visibility, mobile spacing controls, safe-area controls, hit-box overlay + tap validators, mobile-only sections, `searchLauncher` | The mobile polish toolkit |
| **8. Pill-menu builder (L)** | `pillNav` block + nav templates (current nav captured as default); glass panel with the full slider set + 3 presets; collision validator wired to publish | |
| **9. Visual editing** | In-place click-to-edit on the preview, dnd-kit drag/reorder, resize handles + grid snap, duplicate/delete/lock from canvas, undo/redo, image rotate (+EXIF auto on ingest from Phase 4's uploader) | Editor-UX phase; engine already supports every operation |
| **10. Commerce blocks (L)** | productCard/grid/featured/related, swatchRow builder, gallery/slideshow/lightbox binding, inventory badges, opaque buyBox; category + PDP presentation migration (checkout untouched) | The last hand-written surfaces migrate |
| **11. Export: static + Next** | Export package format + manifest; Next adapter (scaffold + renderer); static SSG adapter (progressive interactive blocks); ZIP | Builder becomes standalone-capable |
| **12. Ship & hardenings** | Vite adapter (optional), GitHub connect (reuses storage adapter), backup/restore, revision UI, perf passes, docs, the standalone builder's project-creation flow | |
| **13. Offline ZIP / address / shipping data module** | Dataset manager (licensing-safe), ZIP→city/state lookup, local-delivery + blocked lists, shipping rule editor, zone tables, trimmed per-site export (§14) | Generalizes what Lusik already ships |
| **14. Local AI engine** | llama.cpp/Ollama adapter, model manager + Local AI settings panel, assistant tasks behind the deterministic gates (§15) | Local-first; no weights bundled by default |
| **15. App Developer Mode** | Guided questionnaire → project plan, app screen templates, PWA/manifest export, App Store / Play Store checklist generators (§15) | PWA first; native export later if practical |
| **16. Portable desktop app (.exe)** | Package the builder as a double-click Windows app (§16): Tauri shell (MIT, ~10 MB) wrapping the local Next server + fs storage, portable USB layout, optional llama.cpp sidecar + offline model folder, **animated splash screen** (§16a) | The thumb-drive end-state |
| **17. Service preset system** | Modular hosting/database/commerce/email/security/CMS presets (§17): registry + UI cards + project generation; beginner/advanced modes, honest informational recommendations, recommended stacks | Data model + registry land early (Phase 9.5); cards + generation ride the export system |

**Recommended first build step (next session): Phase 2** — schemas + engine
with tests. It's the foundation everything else type-checks against, it
can't break anything, and reviewing it locks in the data model while it's
still cheap to change.

---

## 14. Offline/local ZIP, address & shipping data module (Phase 13)

**Goal:** sites built with the builder perform basic ZIP / city-state /
region / shipping-zone lookup from **local, baked-in data** — no third-party
lookup API required, working offline except for payment itself.

**This generalizes something the Lusik site already proves in production:**
`netlify/functions/zip-lookup.mjs` serves a local 42.5k-ZIP dataset
(generated by `scripts/gen-zip-places.mjs` from the BSD-licensed `zipcodes`
npm package — legally redistributable, attribution preserved), and
`_lib/shipping-zones.mjs` already separates zones from rates with
browser↔server drift tests. Phase 13 turns that proven pattern into a
builder-managed module.

### Licensing tiers (the hard rule)
| Tier | Data | Policy |
| --- | --- | --- |
| **Bundleable** | Open/BSD ZIP→city/state/region data (e.g. the `zipcodes` package already in use) | Ships with the builder and with exports, attribution preserved |
| **Import-only** | USPS-licensed products, UPS/FedEx zone charts, paid rate tables | NEVER bundled. Dataset manager imports the user's own licensed CSV/JSON; license notes recorded on the dataset |
| **API-only** | Live carrier rates, true deliverable-address verification | Optional adapters, clearly separate from the local engine |

The UI never claims "USPS-verified deliverable address" — copy says "ZIP
lookup", exactly as the Lusik checkout does today. Honest labels are a
guardrail, not a footnote.

### Versioned dataset manifest
Every dataset (bundled or imported) carries:
```ts
interface DatasetManifest {
  id: string; name: string; kind: "zip-places" | "zone-table" | "zip-list" | "rate-table";
  source: string; licenseNotes: string;           // required, shown in the manager
  version: string; importedAt: string; updatedAt: string;
  coverage: string; limitations: string;
  rows: number; sha256: string;
}
```

### Storage & format recommendation
- **Canonical store:** imported CSV/JSON normalized to JSON files under
  `builder/data/<dataset-id>/` (git-tracked → versioned, diffable,
  thumb-drive portable by construction).
- **Exports are generated lookup tables, trimmed per site:** by state, by
  ZIP list, by local-delivery area, or zones-only. The full-US JSON
  (~Lusik's case) is the no-trim reference and is already proven fine
  behind a server route.
- **Per-target output:** Next.js export → single JSON behind a server route
  (today's `zip-lookup` function pattern, CDN-cached). Static HTML export →
  **prefix-sharded JSON chunks** (`/data/zip/9.json` …) lazy-fetched on
  first keystroke, so no page carries the dataset in its bundle.
  Compression rides the host (gzip/brotli).
- **SQLite:** desktop/portable builder app only, later — not in exported
  sites (sharded JSON beats wasm-sqlite weight for this query shape).

### Engine behavior (offline-first, fail-soft)
ZIP exists? → autofill city/state (multi-city ZIPs offer the accepted
names, primary first) → local-delivery / blocked-list check → rule match.
Missing data **degrades, never blocks**: unknown ZIP shows a clear "we
couldn't confirm this ZIP" warning instead of silently wrong shipping —
the Lusik rule ("an unknown ZIP never blocks checkout") becomes engine law.

### Zones vs. rates vs. rules (kept separate)
- **Zones** = origin-ZIP + destination mapping (bundled regions, manual
  tables, or user-imported licensed carrier tables).
- **Rates** = prices, attached to zones/rules, always user-owned.
- **Rules** = ordered list evaluated locally: local-delivery ZIP list,
  pickup, blocked ZIPs, flat by ZIP/state/zone, free-shipping thresholds
  (by amount/ZIP/state/zone), product-specific rules, handmade
  lead-time display rules.

### Builder UI (Phase 13 scope)
Dataset manager (import/validate/update/remove/export-trimmed, license
notes front-and-center) · ZIP editor (add/edit entries, multi-city with
primary, region labels) · shipping-rule editor (the list above) · zone-table
editor (manual creation + licensed-CSV import) · origin-ZIP/store-region
setting.

### Lusik & Sons integration (last step of the phase)
Origin ZIP (Buena Park), the existing zone+threshold rules become the first
rule-set, lead-time display rules added. **Display/eligibility only**: the
local engine drives shipping messages and estimates in the UI; the charged
amount stays computed server-side in `_lib/pricing.mjs` + friends, and the
existing drift-test pattern extends to the rule-set so the two can never
disagree silently. Stripe checkout remains untouched.

### Later (post-Phase-13)
Carrier zone/rate import adapters (user-licensed), live-rate API adapters
(optional), SQLite for the desktop app, stronger validators, dataset
update reminders.

---

*Questions this plan deliberately left open (decide by Phase 4): whether the
Lusik adapter writes drafts to branches or a drafts/ directory in fs mode;
LFS adoption threshold; whether journal moves from `src/data` into
`content/` as part of collection binding (recommended: yes).*

---

## 15. Local LLM engine + App Developer Mode (Phases 14–15)

Researched June 2026 (web-verified; re-verify model/license specifics at
implementation time — this space moves quarterly).

### What the AI can and cannot guarantee — read first
No LLM, local or cloud, produces correct code 100% of the time. The
guarantee in this architecture comes from the **deterministic layer**: the
assistant *proposes* (documents, blocks, copy, code), and every proposal
passes the same gates as a human edit — schema validation, the
trusted-products price gate, contrast/tap/collision validators, typecheck,
tests, bundle budget. The AI is never an authority over Stripe/payment
logic, pricing, shipping math, auth, env vars, security headers, or HTML
injection surfaces (the §5 "never editable" tier applies to the assistant
exactly as it applies to the visual editor). **LLM proposes; gates dispose.**

### Runner recommendation (verified licenses)
- **Bundle `llama.cpp`** (`llama-server`) — MIT, freely redistributable,
  OpenAI-compatible local HTTP API, prebuilt Windows binaries (ship the
  AVX2 CPU build + Vulkan for iGPU/dGPU coverage without CUDA bloat).
  Grammar-constrained sampling (JSON-schema) guarantees parseable
  structured output from ANY model — worth more to a builder than native
  tool-training.
- **Auto-detect Ollama** (MIT; `localhost:11434`) and prefer it when
  installed — best programmatic model management (`pull/list/delete`).
- **Rejected:** LM Studio (proprietary, no redistribution — fine to *point
  at*, never bundle), Jan (AGPL-3.0 — contagious for a commercial bundle),
  GPT4All (effectively unmaintained since Feb 2025).

### Model tiers (license-vetted)
| Tier | Hardware | Models | License | Q4 disk |
| --- | --- | --- | --- | --- |
| **CPU / low** (the owner's 10th-gen i5, 8–16 GB RAM) | ~5–15 tok/s CPU-only | **Qwen3-4B** (or **Phi-4-mini 3.8B** for pure MIT); 16 GB → Qwen2.5-Coder-7B / Qwen3-8B | Apache-2.0 / MIT | 2–2.5 GB (7–8B: ~5 GB) |
| **Mid** (32 GB RAM or 8–12 GB VRAM) | usable agentic coding | **Qwen3-Coder-30B-A3B** (MoE, 3B active — fast even RAM-offloaded) or **Devstral Small 2 (24B)** | Apache-2.0 | 14.5–18.5 GB |
| **High** (24 GB+ VRAM / 64 GB RAM) | near-frontier local | **Qwen3-Coder-Next (80B-A3B)**, 256k ctx | Apache-2.0 | ~45–50 GB |
| **Cloud fallback** (optional, off by default) | — | provider adapter (same interface) | per provider | — |

**License traps (do NOT bundle):** Codestral-22B (Mistral Non-Production
License — no commercial use/redistribution), Qwen2.5-Coder-**3B**
specifically (research license, unlike its Apache siblings — re-check the
model card). Gemma 3 / Llama 3.x are *conditionally* redistributable
(terms passthrough, attribution/naming, use policies) — prefer the
unconditional Apache/MIT picks above.

**Honest expectation for the i5 laptop:** a 4B Q4 model at ~5–10 tok/s is
genuinely useful for planning, specs, copy drafts, schema generation, and
explain-this-error; it is *slow* for large multi-file code generation. The
settings panel must say so (speed/RAM warnings, "switch to a smaller
model" suggestion) rather than overpromise.

### Weights: bundled vs downloaded
Default = **download-on-first-run** (SHA-checksummed GGUFs, resumable)
even where bundling is legal — disk cost dominates. Apache/MIT weights
(Qwen, Phi, Devstral, nomic, bge) MAY ship on an offline-install USB for
the full thumb-drive story; the model manager records name/source/license/
version/sha per model (same manifest discipline as §14 datasets), supports
"bring your own model path," and shows license notes in the UI.

### Local AI architecture
```
src/builder/ai/
├── adapter.ts        # one interface: chat(messages, {schema?, tools?}) →
│                     #   llama.cpp | Ollama | (optional) cloud provider
├── models.ts         # model manager: detect/download/verify/remove, tier advice
├── tasks/            # prompt library: plan, spec, blocks, copy, schema,
│                     #   a11y/SEO review, explain-error, README, checklists
├── guardrails.ts     # output → validateDocument()/engine gates before ANY apply;
│                     #   protected-zone refusals; diff-preview before write
└── index.ts          # settings panel state (runner, model, ctx, temp, modes)
```
Project-aware context (local RAG): **no vector DB v1** — builder projects
are small; a structured index (page/screen/component schemas, theme,
templates, package files, README, recent build/error logs, user notes) +
BM25/keyword retrieval (e.g. minisearch) fits the context window and is
deterministic. Add a local embedding model (nomic-embed-text v1.5
Apache-2.0 / bge MIT, ~270 MB) only when multi-project libraries demand it.

**The LLM powers the editor, never the exported site.** No model, no
weights, no AI runtime in any export unless the user explicitly adds an
AI feature and acknowledges size/privacy/hosting tradeoffs.

### App Developer Mode (original workflow — inspired by the category, copying no one)
- **Project creation:** plain-English description / template / existing
  website project → the assistant asks the §23 question list (audience,
  screens, login, payments, offline, accounts, admin, store release,
  privacy, UGC/moderation…) → emits a **project plan document** (a builder
  doc, schema-validated, versioned in git) before anything is generated.
- **App types, safest-first:** PWA / app-like website (the engine already
  has manifest + service-worker patterns from the Lusik site) → installable
  PWA export → React Native/Expo **later and only if practical** → native
  store binaries last. Screens are the same Block documents with a
  `screen` page kind + app chrome blocks (tab bar, drawer nav, onboarding,
  settings, login, checkout screens) rendered in device frames.
- **Store guidance = generated checklist documents,** not promises: Apple
  (developer account, bundle ID, icons, screenshots, privacy details, age
  rating, TestFlight, common rejection risks) and Google Play (console,
  app signing, AAB, Data Safety, content rating, release tracks, common
  rejections). The compliance questionnaire (data collected, deletion,
  moderation, IAP, ads/tracking) feeds both checklists and the privacy-
  policy scaffold. **Explicitly no "guaranteed approval" claims.** The
  easy path (mobile-web/PWA first, decide native later) is presented
  before the hard path, always.

### Milestones
- **Easiest first:** Local AI settings panel + llama.cpp adapter +
  plan/spec/copy tasks behind the gates; PWA export of a builder project
  (manifest + icons + offline shell) with its README/deploy checklist.
- **Hardest (defer, may cut):** native iOS/Android project generation and
  signing flows; store-submission automation; multi-file agentic
  refactoring at CPU-tier speeds; screenshot/icon generation helpers.

---

## 16. The portable `.exe` (Phase 16) — what it is and what already exists

The thumb-drive end-state is a **double-click Windows app**: a small
desktop shell that starts the builder's local server (fs storage), opens
the editor window, and needs nothing installed on the host machine.

- **Already built toward it (Phases 2–5):** everything that matters runs
  fully offline today — fs storage, `BUILDER_LOCAL_TOKEN` auth, the save
  gates, forms, theme panel. On any machine with Node 22, the folder on a
  USB stick IS the builder (`npm ci` once, `next start`, open `/builder`).
- **What Phase 16 adds:** the no-Node-required packaging. Recommended:
  **Tauri** (MIT, ~10 MB shell, proper Windows webview) wrapping a
  Node-SEA-bundled or sidecar server binary; a portable USB layout
  (`builder.exe` + `project/` + `models/` + `data/`); first-run checks
  (disk space, RAM tier advice); optional llama.cpp sidecar + offline
  model folder per §15. Electron is the fallback if Tauri's sidecar
  ergonomics fight us (cost: ~100 MB heavier).
- **Sequencing:** packaging is orthogonal to editor features — it can be
  scheduled any time after Phase 6–7 makes the .exe worth handing to
  someone; doing it sooner is possible if the owner wants the portable
  shell before the visual editor lands.

### §16a. Animated splash screen (part of Phase 16)

**Current-structure analysis (the honest answer):** there is no desktop app
yet — Phase 16 hasn't been built — so the splash is *designed* here and
*implemented together with the Tauri shell*, which is the safest possible
path: in Tauri, the earliest displayable surface is a *second, tiny window*
the Rust shell opens immediately at launch (a built-in pattern), showing the
splash while the main window boots the builder UI. Nothing is retrofitted;
the splash is the shell's first act.

- **Format decision:** CSS/sprite-sheet animation in a static local HTML
  file — no video decoder, no Lottie runtime, ~no memory, instant start,
  scales responsively. Scene art = layered PNG/SVG sprite sheets. A single
  static PNG renders first as the base layer, so if animation ever fails
  the fallback is already on screen (requirement 8 by construction). All
  assets bundled into the EXE; zero network.
- **The mini-story (3–5 s, original art, no copyrighted styles):**
  1. A stylized original mascot of the owner sits gaming, glow on his face.
  2. He notices the app launching — startled jump, controller flies.
  3. One-beat montage gag (badminton swing, total whiff).
  4. *(v2, documented for later)* Gohar cameo: a simple background
     walk-by + wave — deferred from v1 to keep the first cut simple.
  5. He turns to camera, goofy thumbs-up, app name appears → fade.
- **Timing behavior:** app ready early → skip gracefully to scene 5's
  ending; app slow → loop a small idle (thumbs-up bob) from the final
  scene, never replay the story; splash never blocks the server boot
  (separate window, separate process concern). Fade-out handoff when the
  main window signals ready.
- **Replaceable art:** assets live in one folder
  (`desktop/splash/assets/`), scene timings in one CSS/JSON file —
  swapping artwork later means replacing files, not code. Documented in
  the Phase 16 README.

---

## 17. Service preset system (Phase 17; data model lands early)

Make hosting/database/checkout/email/DNS/CMS choices easy for a
non-technical user — **without lock-in, affiliate-style steering, or
pretending to do things the builder can't do.**

### Honesty rules (these are product law, not copy)
- Recommendations are **informational only**, clearly labeled, one tap to
  ignore ("Use another provider" is always present).
- **"One click" = one-click project PREPARATION**: generate files and
  `.env.example`, add npm packages, prepare schema files, emit a setup
  checklist and copy/paste instructions. The builder **never claims** to
  create external accounts or manage API keys — unless a real OAuth/API
  connection exists someday, in which case it's explicit and opt-in.
- DNS/security cards are **informational presets**: Cloudflare/Turnstile/
  CDN-WAF explainers that never imply Cloudflare is required and never
  touch DNS automatically.
- Paid tiers, vendor lock-in risk, and secret-key handling get visible
  warnings on the card, not fine print.

### Architecture
```
src/builder/presets/
├── types.ts        # the zod'd Preset + Stack data model (below)
├── hosting.ts      # netlify, vercel, cloudflare-pages, render, railway,
│                   #   do-app-platform, fly-io (advanced)
├── database.ts     # none-static, supabase, neon, firebase, turso,
│                   #   cloudflare-d1, render-pg, railway-pg, do-managed
├── commerce.ts     # stripe-checkout, stripe-products, stripe-webhooks
├── email.ts        # resend, smtp (advanced/later), + the two capability
│                   #   presets: admin-notifications, customer-receipts
├── security.ts     # cloudflare-info, turnstile-info, cdn-waf-explainer
│                   #   (informational: true — render-only, generate nothing)
├── cms.ts          # builtin-git-cms (this builder), external headless (later)
├── stacks.ts       # the recommended default stacks (below)
└── index.ts        # registry: byId/byCategory, beginner filter, stack
                    #   resolution, cross-preset conflict checks
```
Each preset: `id, label, category, difficulty (easy|standard|advanced),
blurb, bestFor, notBestFor, requiredEnvVars, optionalEnvVars, npmPackages,
filesToGenerate, setupSteps, validationChecks, warnings, docsLinks,
canAutoConfigure, requiresUserAccount, requiresSecretKey, recommendedFor,
informational?, freeTier?, requiresPresets?` — adding a provider = adding
one object, never rewriting the builder.

### UI (Phase 17 proper)
Beginner mode shows the 2–3 `difficulty:"easy"` choices per category;
Advanced shows all. Every recommended card carries a "Why this
recommendation?" expander (plain-language reasoning from `recommendedFor`)
and the escape hatch. Selecting a stack produces the **final pre-deploy
checklist**: env vars to set (from the presets' lists), accounts needed,
secrets warnings, generated files review, and the provider's own setup
steps in order.

### Generation (rides the Phase 11 export system)
A chosen preset set decorates the export: provider config files
(`netlify.toml`/`vercel.json`/wrangler config…), `.env.example`, schema
SQL for the chosen database, README setup section, checklists. The
**Lusik production stack (Netlify + Neon + Stripe + Resend) is the first
validated preset combination** — the generators dogfood against a real,
working site.

### Recommended default stacks (`stacks.ts`)
1. **Simple business site** — Netlify *or* Vercel · no database · optional
   Resend · Cloudflare informational card only.
2. **Small business shop** — Netlify/Vercel · Supabase *or* Neon · Stripe
   checkout (+webhooks) · Resend · Cloudflare informational only.
3. **CMS site** — Netlify · the builder's git-based CMS first · optional
   Supabase · optional Resend.
4. **App builder mode** — Vercel/Netlify/Cloudflare Pages · Supabase/
   Firebase/Neon/Turso by need · Supabase/Firebase auth option · storage:
   Supabase/Firebase/R2 or a provider-neutral placeholder.

### Sequencing
The **data model + registry** are pure data and land now (with tests:
schema validity, unique ids, stacks reference real presets, informational
presets generate nothing, no preset claims `canAutoConfigure` for account
creation). **UI cards + generation logic** are Phase 17 proper, after the
Phase 11 export format exists for them to decorate.

---

## 18. Section jumper — floating ▲/▼ scroll navigation (shipped)

Modeled on the events-site recording Baghdo shared: two circular buttons
pinned to a screen edge that hop the visitor **section-by-section** with a
smooth scroll — ▼ to the next section (or page end), ▲ back up (or page
top) — with the useful direction filled in the accent color and the dead
direction dimmed at the edges.

- **One new block type, `sectionJumper`** (`schema/block.ts`), placeable
  from "+ Add block" in both the website builder and the app builder.
  Options: edge (right/left), vertical anchor (center/lower), button size
  (44/52/60 px — the 44 px tap floor holds), what to hop between
  (sections or headings), glass preset for the idle button, accent hex,
  and translatable ▲/▼ accessibility labels (full offline-i18n support).
- **The one block that inlines JavaScript** — "scroll to the next section
  from here" has no CSS expression. `renderer/jumperScript.ts` builds the
  ~30-line vanilla script + scoped CSS as pure strings (unit-testable);
  the renderer inlines them with the block's markup so every target
  (static export, PWA, SSR'd live site) carries it with zero extra files.
  It is a **progressive enhancement**: the nav renders `hidden` and the
  script's first act is to un-hide it, so no-JS visitors never see dead
  buttons (a scoped `[hidden]{display:none !important}` guard makes that
  hold against the nav's own display classes). `prefers-reduced-motion`
  swaps the smooth scroll for an instant jump. Nothing user-typed reaches
  the script: the block id is regex-gated, stop selectors come from a
  fixed two-entry map, the accent is a schema-gated hex.
- **Publish rules** (`engine/validate.ts`): one jumper per page (error),
  top-level only (error), and a warning when the page has fewer than two
  sections to hop between.
- **Native (SwiftUI) translation**: a real mapping, not a placeholder —
  the page wraps in `ScrollViewReader`, sections get `.id()` tags, and a
  generated `SectionJumperControl` overlays the chosen edge and hops them
  with `withAnimation`. Compiles on a Mac like the rest of the SwiftUI
  export.
- **Editor preview** renders a sticky visual mock (client-rendered inline
  scripts don't execute); the live behavior is verified by a Playwright
  smoke against the real generated script.

---

*Standing constraint across every phase: the builder itself must run from a
thumb drive — fs storage adapter, no cloud dependency in the editor, local
preview/build, and all data (documents, templates, themes, datasets, and
downloaded models) as plain files inside the project.*

