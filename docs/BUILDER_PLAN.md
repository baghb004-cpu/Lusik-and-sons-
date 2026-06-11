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

**Recommended first build step (next session): Phase 2** — schemas + engine
with tests. It's the foundation everything else type-checks against, it
can't break anything, and reviewing it locks in the data model while it's
still cheap to change.

---

*Questions this plan deliberately left open (decide by Phase 4): whether the
Lusik adapter writes drafts to branches or a drafts/ directory in fs mode;
LFS adoption threshold; whether journal moves from `src/data` into
`content/` as part of collection binding (recommended: yes).*
