# Lusik & Sons: site overhaul hand-off

**Status: PLAN ONLY. Nothing in this document has been built.** Written 2026-09-09
on branch `claude/lusik-sons-brochure-gt38ja`, after the printed brochure and coupon
sheet work (see `print/`). It is meant to be handed to a fresh Claude Code session,
possibly on a different account, and executed phase by phase.

Owner's brief, in their words: make the website feature rich and optimized, nothing
can break, make it feel like a million-dollar team storyboarded the whole production
from start to finish, remove the Embroidery Studio completely, model every product in
accurate 3D with as much detail as possible, and keep the live auto-preview feeling
of the "Your design" tab (typing a name and date on the alphabet blanket page shows the
design update as you type) across all products. Be very creative. The owner is low on
usage credits, so the executing session must work in tight, verifiable increments.

---

## 0. Read this first (for the executing session)

### 0.1 Orientation

- `CLAUDE.md` is the authoritative architecture guide. Read it fully before touching
  code. This document is the plan; where they disagree about how the code works today,
  `CLAUDE.md` wins and this plan should be corrected.
- Stack: Next.js 15 App Router, React 18, Tailwind via PostCSS, Netlify Functions +
  Neon Postgres + Netlify Blobs + Identity, Stripe Checkout, Resend email. Content is
  CMS JSON under `content/` compiled by `npm run gen:data`. Photos live in
  `public/img/`.
- Hard gates that already exist and must stay green on every PR:
  - `npm run typecheck`
  - `npm run test:unit` (Node test runner, ~135 tests incl. drift tests)
  - `npm run test:e2e` (Playwright, `desktop-chromium` + `mobile-chromium`;
    `npm run test:install` first)
  - `npm run next:build` (fails if any route's first-load JS exceeds **210 KB gzip**,
    see `scripts/check-bundle-budget.mjs`)
  - Lighthouse CI on PRs (`lighthouserc.json`, currently warn-only)
- Branch protection: `main` needs a PR with an approving review and passing Tests +
  Lighthouse. Never push to `main`. One PR per phase step below.

### 0.2 The "nothing can break" protocol

Every PR in this plan follows the same rules. They are not optional.

1. **Baseline before change.** PR 1 adds a Playwright visual-regression suite
   (`tests/visual/*.spec.mjs`) that screenshots home, `/shop`, one category, three
   product pages, cart, checkout, account, and a journal post on both projects.
   Baselines are committed. Every later PR runs it; intentional changes update
   baselines in the same PR with a note in the PR body.
2. **Feature flags, not forks.** New surfaces ship behind `CONFIG` flags
   (`CONFIG.LOOM.ENABLED`, `CONFIG.HOME_V3`, `CONFIG.ORDER_TRACKER`, and so on) so a
   flag flip is the rollback. Old components are deleted only in the PR after the new
   one has been live for a deploy.
3. **Money, auth, and cart shape are frozen.** Do not change `_lib/trusted-products.mjs`
   prices, the cart-ID shape (`mapLegacyId`), `requireUser` / `requireAdmin`, the
   Identity loading path, or anything under `netlify/functions/_lib/pricing*`
   except where Phase 3 explicitly says so (and then with the drift tests updated
   in the same commit).
4. **Budget discipline.** The 3D engine is an async chunk loaded after first paint.
   It must never appear in a route's first-load JS. A second, named budget for the
   engine chunk is added in PR 2.
5. **Every new surface gets a test.** At minimum one e2e assertion per new page or
   interaction, and unit tests for pure logic (stitch planner, glyph charts, lead-time
   math).
6. **Accessibility and motion.** Every canvas has a text equivalent. Every animation
   honors `prefers-reduced-motion` (the codebase already does this; match it).
7. **PR body template.** Each PR body has three sections: What changed, How to verify
   in five minutes (exact clicks), and Rollback (the flag or the revert).
8. **Stop at phase boundaries.** Finish a PR, report, wait. Do not start the next
   phase in the same PR. The owner has limited credits; a half-built phase is worse
   than a finished smaller one.

### 0.3 Kickoff prompt for the new session

Paste this as the first message of the new Claude Code session:

> Read `CLAUDE.md`, then read `SITE_OVERHAUL_HANDOFF.md` completely. Execute the plan
> one PR at a time, starting with PR 1 (Phase 0). Before writing code, run
> `npm ci`, `npm run test:install`, `npm run typecheck`, `npm run test:unit`, and
> `npm run next:build` to confirm the baseline is green, and tell me the bundle-budget
> numbers the build prints. Follow the "nothing can break" protocol in section 0.2
> exactly. Work on a branch named `claude/overhaul-pr1-remove-studio` (then
> `claude/overhaul-pr2-loom-core`, and so on). When PR 1 is ready, open the pull
> request with the three-section body described in 0.2 and stop so I can review.

### 0.4 What is already done on this branch

- `print/`: the tri-fold delivery brochure and coupon sheet (HTML sources, fonts,
  render script, PDFs). The brochure's lead times (4 to 6 weeks for the alphabet
  blanket, 10 to 12 for the full alphabet crib blanket, 5 to 6 for the days-of-the-week
  set, 2 to 3 for the name bib and the Hye Em Yes bib, 3 to 4 for the Anushig pair and
  the Bari Akhorzhak set) are the owner's realistic numbers. **The website still says
  5 to 10 business days in several places.** Phase 3 aligns the site to the brochure.

---

## 1. The storyboard

The production idea in one line: **one woman, one kitchen table, one stitch at a
time.** Every screen should feel like being welcomed into the workshop, and the thing
the customer is about to buy should be visibly, physically real on the screen before
they pay for it. Seven scenes, in the order a customer meets them.

| Scene | Where | What the customer sees | What makes it feel produced |
| --- | --- | --- | --- |
| 1. The first stitch | Home hero | A single Armenian Ա stitches itself in real thread on real cloth, then the camera pulls back to reveal the whole blanket. | Live 3D (Phase 1) behind a pre-rendered poster so the first paint is instant. Scroll drives the camera. Reduced motion shows the finished blanket. |
| 2. The table | `/shop` and category pages | The pieces laid out on a linen tabletop. Each card is a 3D poster; hovering (or pressing on a phone) turns it slightly. | Posters are rendered at build time from the same 3D rigs, so the grid loads nothing heavy. The existing tilt-and-glare layer is kept. |
| 3. The fitting room | Product page | The piece in 3D. Type a name, it stitches in. Pick a thread, it recolors. Pose chips: Flat lay, On the crib, Folded, The back. A slider compares the model with a real photo. | Poster-first load, engine on idle or first interaction. The 2D preview remains the no-WebGL fallback. Real photos stay one tap away. |
| 4. Into Lusik's hands | Cart and checkout | Each bag row shows a small turntable thumbnail of the exact configured design. Checkout says "Lusik would start this around Oct 6 and ship it around Nov 3" from the lead-time engine. | The estimate is real (per product, plus the current queue), not a constant. Gift flow with a stitched-card preview. |
| 5. While she stitches | Account, order page, email | A milestone timeline: Received, Cloth cut, Stitching, Backing, Finished, Shipped, with photos Lusik posts from the admin page. | Guests get a signed link in the confirmation email; no login needed. |
| 6. The box | Real life | The printed brochure and coupon sheet in the box. Its QR code lands on `/welcome`. | `/welcome` says thank you, explains care, activates the coupon, asks for a photo. |
| 7. The next baby | Return visits | Saved designs, "order again for the next baby," gift reminders (exist), a public design page to share with Grandma, a "Made for" wall of customer photos. | Everything is one tap from the account page. |

Copy tone stays what the site already has: warm, specific, first person plural from
the sons. No prices in printed pieces, no em dashes in customer-facing copy (owner's
rule), and every product carries "colors vary."

---

## 2. Phase 0: remove the Embroidery Studio (PR 1)

The owner wants it gone entirely. The studio is a static SPA in `public/embroidery/`
plus a Netlify Function, plus an iframe-embedded "stage" used by every live product
page. Removing the stage would leave product pages without their hero, so PR 1 also
installs a temporary photo hero and the event bus the 3D engine will use later.

### 2.1 Exact removal inventory

Delete:

- `public/embroidery/` (about 800 KB): `index.html`, `stage.html`, `css/studio.css`,
  `js/app.js`, `js/stage3d.js`, `js/engine/engine.js`, `js/engine/pes-writer.js`,
  `js/engine/stitch-planner.js`, `presets/products.json`, `presets/household.json`,
  `vendor/three.module.min.js`.
- `netlify/functions/embroidery-order.mjs`
- `netlify/functions/_lib/__tests__/embroidery-order.test.mjs`
- `src/components/shop/StageHero.jsx`
- `src/data/stitchPreviews.js`

Edit:

- `netlify/functions/_lib/email.mjs`: remove `sendEmbroideryOrderEmail` (around lines
  1211 to 1290) and the comment at line 67 about Resend's attachment shape if nothing
  else uses it. Grep for `pesBase64` and `content:` attachments to be sure.
- `netlify.toml`: remove the `/embroidery` and `/embroidery/` redirects (around lines
  54 to 68) and the `/embroidery/stage.html` CSP header block (around lines 97 to 105).
  Add one redirect so old links do not dead-end: `from = "/embroidery/*"` to `/shop`
  with `status = 301`. (Owner decision 1 in section 9; 301 is the recommendation.)
- `next.config.mjs`: remove the `/embroidery/stage.html` entry in `headers()` (around
  lines 70 to 80).
- `src/components/shop/ShopIndexView.jsx`: delete `StudioBanner` (around lines 659 to
  700) and its render near line 951. Replace with nothing in PR 1; Phase 2 fills the
  slot with the "How ordering works" strip.
- `src/components/shop/ProductView.jsx`: `StageHero` is imported at line 37 and rendered
  five times (around lines 129, 167, 188, 241, 264). Replace each with the new
  `ProductHero` (section 2.2).
- `src/components/ProductShowcase.jsx` (lines around 217 to 242) and
  `src/components/CustomProductCard.jsx` (around 110 to 127): these dispatch and listen
  for `stitch3d:live` / `stitch3d:hero` CustomEvents. Replace with the typed design bus
  (section 2.3). Keep the configurator behavior identical.
- `src/i18n/translations.js`: remove the `stitch3d` blocks (around line 26 and line
  767) and `studioEyebrow` (line 422) in all three languages. Keep `previewOnly`
  (line 575); it belongs to the bib SVG preview, not the studio.
- `CLAUDE.md`: delete the section "The Embroidery Studio (`/embroidery`) + the Live 3D
  stitch layer (July 2026)" and the status-banner sentence that mentions it. Add a
  status-banner line pointing at this hand-off document.
- `scripts/gen-sitemap.mjs`, `public/robots.txt`: no references today; confirm with
  grep after the deletes.

Keep (they only use the word "embroidery" in prose or for a different feature):

- `src/components/ProductTemplate.jsx` (the bib name SVG preview)
- `CONFIG.UPLOAD_MAX_BYTES` / `UPLOAD_ACCEPTED_TYPES` (custom-embroidery image uploads
  on orders, used by `AdminOrderDetail.jsx`)
- `GalleryView.jsx` line 101, `HeroSlideshow.jsx` line 8, `policies.js` line 181,
  `content/pages/testimonials.json`, the Bari Akhorzhak product JSON.

### 2.2 Temporary `ProductHero`

`src/components/shop/ProductHero.jsx`: the product's cover image (`coverImage` from the
catalog, `next/image`, priority) in the same box `StageHero` occupied, with the same
eyebrow and title treatment so the page layout does not shift. In Phase 1 this
component gains a `LoomStage` child behind `CONFIG.LOOM.ENABLED`; the photo becomes the
poster it crossfades from. Keep the `aria` structure the e2e tests rely on
(`aria-label="View {name}"` cards live in `CategoryView`, not here; verify nothing in
`tests/e2e/smoke.spec.mjs` targets `StageHero`; a grep today finds nothing).

### 2.3 The design bus

`src/lib/designBus.ts`: a typed replacement for the two CustomEvents.

```ts
export type DesignChange =
  | { product: "blanket-alphabet"; letters: string[]; alphabet: "hy" | "en";
      layoutKey: string; name: string; year: string; blockHex: string;
      letterHex: string; letterHexes: string[] | null }
  | { product: "bib-single"; name: string; threadHex: string; script: boolean }
  | { product: string; [k: string]: unknown };
export function publishDesign(d: DesignChange): void   // window CustomEvent "design:change"
export function subscribeDesign(fn: (d: DesignChange) => void): () => void
```

`ProductShowcase` and `CustomProductCard` publish on every state change (they already
compute this object for the old events). Nothing subscribes until Phase 1.

### 2.4 Baseline visual-regression suite

`tests/visual/baseline.spec.mjs` using Playwright `toHaveScreenshot` with
`maxDiffPixelRatio: 0.01`, `animations: "disabled"`, and `reducedMotion: "reduce"`.
Pages: `/`, `/shop`, `/shop/blankets`, `/shop/blankets/armenian-alphabet-blanket`,
`/shop/bibs/days-of-the-week-bib-set`, `/shop/blankets/full-alphabet-crib-blanket`,
`/cart` (with one seeded item via localStorage `lusik_cart_v1`), `/checkout`,
`/journal/armenian-alphabet-gift`, `/story`. Both Playwright projects. Add
`npm run test:visual`. CI: add it to `.github/workflows/test.yml` as a separate job that
uploads diffs as artifacts.

### 2.5 Acceptance for PR 1

- `/embroidery/` returns a 301 to `/shop` on the deploy preview; `stage.html` is gone.
- All five live product pages render the photo hero with no layout shift versus
  before (visual suite passes with updated baselines only for those five pages).
- `npm run next:build` prints a first-load number per route that is equal to or lower
  than before (record both in the PR body).
- Unit, e2e, Lighthouse green. No console errors on home, shop, PDP.
- `grep -rn "embroidery\|stitch3d\|StageHero\|stitchPreviews" src app netlify
  netlify.toml next.config.mjs` returns only the "keep" list above.

---

## 3. Phase 1: the Loom, a real-time 3D product engine (PRs 2 to 5)

"Loom" is the working name for `src/loom/`. It renders every product as an accurate
3D object, restitches live as the customer types, and produces the posters the rest
of the site uses. It is the centerpiece of the overhaul, so it gets the most detail
here.

### 3.1 Non-negotiable constraints

- **Dependency:** add `three` (npm, pin the latest 0.17x) as a real dependency. Import
  only named exports from `three` inside `src/loom/**`. No `three/examples/jsm/*`
  except, if truly needed, `OrbitControls`; prefer the small custom orbit in 3.4.
- **Loading:** `LoomStage` is loaded with `next/dynamic(() => import("../loom/LoomStage"),
  { ssr: false })` from a tiny shell. The engine chunk must not be in any route's
  first-load JS. PR 2 extends `scripts/check-bundle-budget.mjs` with a named async
  chunk budget: the chunk whose path contains `loom` must be **at most 230 KB gzip**
  (three core is roughly 150 KB gzip when tree-shaken; the rest is ours). The script
  should find the chunk via `.next/build-manifest.json` plus a filename match and
  fail the build if it exceeds the budget or if it shows up in any route's first-load
  list.
- **Poster-first:** every stage renders a static poster (`<img>` from
  `public/img/loom/...webp`, generated by the script in 3.8) as the LCP element. The
  engine loads on `requestIdleCallback` after the page's load event, or immediately on
  the first pointer/keyboard interaction with the stage or the configurator, whichever
  is first. When the first frame is ready the canvas crossfades over the poster
  (250 ms; instant under reduced motion). Poster and canvas share one sized box so
  there is zero layout shift.
- **Device tiers:** decide once per session in `src/loom/tier.ts`:
  `high` (desktop class: shadows on, DPR capped at 2, full instance counts),
  `mid` (most phones: DPR 1.5, no shadow maps, contact shadow as a baked blob),
  `low` (`deviceMemory <= 2`, `hardwareConcurrency <= 2`, or a WebGL probe that fails
  or takes over 200 ms: poster only, and the existing 2D `BlanketLayoutPreview` stays
  the live preview). The tier is overridable with `?loom=high|mid|low` for testing.
- **Fallback:** WebGL unavailable or context lost twice: show the poster and the 2D
  preview, and log to Sentry with the tier. Never a blank box.
- **Color accuracy:** `renderer.outputColorSpace = SRGBColorSpace`, tone mapping off
  (`NoToneMapping`), physically based materials with neutral white lighting. Thread
  colors come from the DMC hex values already in `src/data/product.js` and
  `customProducts.js`; fabric colors are sampled from the product photos (section 3.6).
- **Frame budget:** 60 fps on `high`, 30 on `mid`. Render only while visible
  (IntersectionObserver) and only when something changed or the camera is moving
  (on-demand rendering, not a free-running loop).
- **Memory:** under 120 MB total GPU + JS for the heaviest rig (the full alphabet crib
  blanket). Dispose geometries, materials, and textures on unmount.
- **Accessibility:** the stage container is `role="img"` with an `aria-label` built
  from the design ("Armenian Alphabet Blanket, Armenian letters, name OLEN, year 2026,
  navy thread on white"), plus a visually hidden live region that announces
  "Stitched: OLEN" after typing pauses. Keyboard: arrow keys orbit, `R` resets, `1` to
  `4` jump to pose presets. Focus ring on the stage.

### 3.2 Module layout

```
src/loom/
  LoomStage.tsx          React shell: sizing, poster crossfade, tier, a11y, pointer, keys
  index.ts               public API: mountStage(), poses, poster helpers
  tier.ts                device tier probe
  core/renderer.ts       WebGLRenderer setup, color management, DPR, on-demand render loop
  core/scene.ts          lights, ground, environment (procedural, no downloads)
  core/camera.ts         pose presets + damped orbit + choreography (goTo)
  core/loop.ts           requestAnimationFrame scheduling, visibility pausing
  materials/cloth.ts     procedural weave textures (waffle, terry, knit, satin, linen)
  materials/thread.ts    thread material + per-instance color
  stitch/glyphs.ts       cross-stitch charts (Armenian, Latin, digits, motifs, cube outline)
  stitch/planner.ts      text + slot → list of stitches (grid coords, color, order)
  stitch/renderer.ts     InstancedMesh of one X-stitch; stitch-in animation via shader
  stitch/script.ts       machine satin-stitch decal (name bib): canvas text → normal/color maps
  rigs/alphabetBlanket.ts
  rigs/fullAlphabetBlanket.ts
  rigs/bib.ts            shared bib body; variants below compose it
  rigs/nameBib.ts
  rigs/hyeEmYesBib.ts
  rigs/anushigPair.ts
  rigs/bariAkhorzhakSet.ts
  rigs/daysOfWeekSet.ts
  rigs/placeholders.ts   towel, baptism towel, swaddle, bathrobe (simple, Phase 1b)
  rigs/index.ts          productKey → rig factory
  poses.ts               per-rig camera/pose presets (flat, crib, folded, back)
```

Everything under `src/loom/` is TypeScript (the repo's migration direction).

### 3.3 Fabric and materials (what "accurate" means here)

Textures are generated procedurally on an offscreen canvas at first use and cached,
so nothing is downloaded and nothing bloats the repo. Each fabric has a color map, a
normal map, and a roughness map, tiled.

| Fabric | Used by | Look to match | Reference photos |
| --- | --- | --- | --- |
| Thermal waffle weave with embossed medallions | Armenian Alphabet Blanket | The photos show a honeycomb thermal weave, with every other square carrying an embossed pomegranate medallion (a round motif) and the cross-stitch cubes sitting inside plain squares. Fringe on the edges, satin backing. | `public/img/abc-blanket/03.jpg` (OLEN 2026 layout), `07.jpg` (weave texture and medallions), `08.jpg` (macro of one Ա cube, coral thread), `12.jpg` (full navy layout), `14.jpg` (English ABC), `/img/date-detail.jpg` |
| Hand-knit stockinette with crochet picot edge | Full Alphabet Crib Blanket | Knit V-columns, a grid of 6 by 6 squares, letters knit in a contrasting color inside each square, a scalloped crochet edge in the body color, satin backing matched to the body. Six body colors. | `public/img/full-alphabet/12.jpg` (whole grid, pink), `33.jpg` and `38.jpg` (corner with satin backing), `41.jpg` to `44.jpg` (letter macros), `cover.jpg` (stack) |
| Terry cloth with satin bias trim | All bibs, burp cloth | Looped terry surface, a smooth satin binding around the edge and neck, a tie or hook closure at the back. Bari Akhorzhak bibs have a smooth white inset panel for the lettering and picot edging. | `public/img/days-bib/02.jpg`, `14.jpg`; `anushig-bib/01.jpg`; `hye-em-bib/cover.jpg`, `03.jpg`; `bari-akhorzhak-set/cover.jpg`, `07.jpg`, `24.jpg` |
| Knit baby cap | Hye Em Yes cap, Bari Akhorzhak cap | Fine rib knit, folded brim, the motif on the brim. | `public/img/hye-em-bib/cover.jpg`, `bari-akhorzhak-set/cover.jpg`, `hero/06-blue-baby-hat.jpg` |
| Satin | Backing, trim | High sheen, soft anisotropic highlight, slight quilting near seams. | `public/img/full-alphabet/33.jpg`, `38.jpg` |

Thread: a slightly twisted two-ply look. Each X-stitch is one small mesh (two crossed
arcs, about 60 triangles) with a normal map that fakes the twist. Machine satin stitch
(name bib) is a decal: render the name with the Allura font onto a canvas, derive a
stroke-aligned striped normal map, and project it on the bib as color + normal + a
little height. That is far cheaper and closer to real machine embroidery than text
geometry.

### 3.4 Camera, poses, and choreography

Poses per rig (all with a damped orbit the user can leave and return from):

- **Flat lay** (default): three-quarter top view on a linen tabletop, soft window
  light from the upper left, a faint contact shadow.
- **On the crib**: the blanket draped over a simple crib rail (a few rounded bars, no
  full crib) so the drape and the fringe read.
- **Folded**: the piece folded in thirds, the way it ships; for sets, the pieces
  stacked or fanned the way the photos show (`days-bib/02.jpg`).
- **The back**: a corner lifted to show the satin backing (blankets) or the closure
  (bibs).

`goTo(pose, ms)` eases position, target, and FOV together. While the customer types,
the camera drifts to frame the slot being edited (name or year) and returns to the
pose 1.2 s after the last keystroke. Reduced motion: cuts instead of eases, no
drift. The custom orbit is about 80 lines (spherical coordinates, damping, pinch
zoom, bounds); it avoids pulling in `OrbitControls` and its dependencies.

### 3.5 Stitch charts and the planner

`stitch/glyphs.ts` holds cross-stitch charts as arrays of strings, one character per
cell: `.` empty, `X` a full stitch, `/` and `\` half stitches, `-` and `|` backstitch
segments for outlines. Grid 13 wide by 15 tall for capitals, which is the size the
photos show inside the cube outline.

Required sets:

- Armenian capitals Ա through Ֆ (38) and lowercase where the site uses them (the day
  names and blessings on the bib sets are lowercase Armenian, so the lowercase set is
  needed for those rigs).
- Latin A to Z, a to z, digits 0 to 9, period, slash, hyphen, space.
- Motifs: heart, cross, bottle, strawberry, grape, carrot, butterfly, chick, car,
  pomegranate, and the **cube outline** (the isometric block drawn around each letter
  on the alphabet blanket; see `abc-blanket/08.jpg`, it is a backstitched 3D box with
  the letter on its front face).

Authoring guidance: start from the letterforms the 2D `BlanketLayoutPreview` draws and
the macros in `abc-blanket/08.jpg` and `full-alphabet/41.jpg` to `44.jpg`. A unit test
asserts every chart is exactly 13 by 15, uses only the allowed characters, and that
every character the configurators accept has a chart. A second test renders every
chart to a PNG contact sheet (`tests/visual/glyphs.spec.mjs`) so a human can eyeball
the alphabet once.

`stitch/planner.ts` turns a design into stitches: `{ x, y, color, order }` in grid
units for a named slot. Rules:

- Alphabet blanket: the six letter cubes sit at the 7 by 7 grid positions in
  `PRODUCT.layouts[].preview` (today `[4, 12, 20, 28, 36, 44]`, the two diagonals).
  `BlanketLayoutPreview.jsx` is the source of truth for which cell is the name slot
  and which is the year slot; read it and mirror it exactly. The name runs on a
  stepped diagonal baseline (each letter one cell lower, as in `abc-blanket/03.jpg`
  where OLEN steps down); the year runs straight.
- Name length cap and allowed characters come from the configurator
  (`ProductShowcase.jsx`); the planner never invents its own limits.
- `order` is the sequence a hand would stitch in (left to right, top to bottom per
  glyph) and drives the stitch-in animation.
- Full alphabet blanket: fixed content; the planner only recolors.
- Bibs: fixed content per product, plus the name/initial on caps, plus the name on
  the name bib (decal path, not stitches).

### 3.6 Rig-by-rig accuracy checklist

Each rig exports `build(scene, design, tier) => { update(design), setPose(pose),
dispose(), bounds }`. The executing session must open the reference photos and match
these details.

**Armenian Alphabet Blanket** (`blanket-alphabet`, `src/data/product.js`)
- 52 by 52 inches. 7 by 7 grid of quilted squares; alternate squares embossed with a
  round pomegranate medallion; edges fringed (instanced fringe strands on `high`, an
  alpha-tested fringe strip on `mid`); satin backing in the body color.
- Six letter cubes on the two diagonals, each a backstitched isometric cube with the
  letter cross-stitched on the front face. Block color and letter color are separate
  (the configurator has both). The Armenian-flag preset colors letters red, blue,
  orange in stitch order.
- Name and year slots per the 2D preview. Live restitch on every keystroke.
- Colorway sampling: fabric white `#f4f1ea` (from `abc-blanket/12.jpg`), fringe the
  same, medallion emboss depth subtle.

**Full Alphabet Crib Blanket** (`blanket-full-alphabet`, `content/products/full-alphabet-crib-blanket.json`)
- Knit body, roughly 30 by 36 inches (the JSON has a `TODO_LUSIK: confirm` on size;
  do not remove that marker). Derive the exact 6 by 6 cell contents from
  `full-alphabet/12.jpg` and `55.jpg`: the alphabet fills the grid in reading order
  with a cross in the first cell and a heart in the last (verify against the photo
  and write the sequence into the rig with a comment naming the photo).
- Body colors from `CRIB_BLANKET_BODY_COLORS` in `customProducts.js`; letters knit in
  a matching deeper shade; crochet picot edge in the body color; satin backing.
- Poses include a "corner lifted" back view because the satin backing is a selling
  point.

**Custom Name Bib** (`bib-single`, `customProducts.js`)
- Terry bib, satin trim, machine satin-stitch script name (decal path), thread color
  from `BIB_THREAD_COLORS`, Armenian or Latin script. Matches `hero-olen-bib.jpg` and
  `bib-romeo.jpg`.

**Hye Em Yes Bib** (`bib-hy-em`)
- Three lowercase Armenian words in red, blue, orange (fixed), optional cap with the
  same tricolor motif on the brim. `hye-em-bib/cover.jpg`.

**Mama and Papa's Anushig Set** (`bib-anushig-pair`)
- Two bibs side by side, two-line lowercase Armenian text each with a small motif
  between lines; thread color from the picker (pink, blue, mint, yellow).
  `anushig-bib/01.jpg`, `03.jpg`, `04.jpg`.

**Bari Akhorzhak Set** (`bib-bari-akhorzhak-set`, `-with-cap` variant)
- Bib with a white inset panel and a tie closure, burp cloth in single-color terry,
  optional cap with a name or initial; three colorways (quiet harmony, gentle
  complement, bold contrast) from the JSON `colorways`. `bari-akhorzhak-set/cover.jpg`,
  `07.jpg`, `24.jpg`, `25.jpg`.

**Days of the Week Set** (`bib-days-of-week`)
- Seven bibs, each with one lowercase Armenian day name, thread color from the picker
  (the colorways in the JSON include a rainbow variant with a color per bib). Poses:
  fanned (`days-bib/14.jpg`) and stacked (`days-bib/02.jpg`).

**Placeholders** (`towel-hand`, `towel-baptism`, `baby-swaddle`, `baby-bathrobe`)
- Simple rigs with an embroidered name so coming-soon pages have a poster. Phase 1b,
  only after the live seven are done.

### 3.7 Live typing, exactly

- Configurator input → `publishDesign` (already wired in Phase 0) → `LoomStage`
  subscribes → planner diff by slot → only changed slots re-plan → instance buffers
  updated (`instanceMatrix.needsUpdate`, `instanceColor.needsUpdate`) → new stitches
  animate in over 350 ms in stitch order via a `uProgress` uniform and a per-instance
  `aOrder` attribute injected with `material.onBeforeCompile`. Unchanged stitches do
  not flicker.
- Debounce 50 ms. Planner work stays under 4 ms on `mid` (measure with
  `performance.mark`; a unit test benchmarks the planner on the longest allowed name).
- The 2D preview keeps working underneath and is what `low` tier and no-WebGL see.
- The design object saved to the cart is unchanged (cart-ID shape is frozen); the
  stage is a view, not a source of truth.

### 3.8 Posters and turntables

`scripts/render-loom-posters.mjs` (run manually, output committed):

- Launches Playwright Chromium with `--use-gl=angle --use-angle=swiftshader
  --enable-unsafe-swiftshader` against a hidden route `/loom/poster?product=...&pose=...&design=...`
  that renders a stage at 1600 by 1200 and signals ready.
- Writes `public/img/loom/<productKey>/<pose>.webp` (quality 82) and a 12-frame
  turntable sprite `public/img/loom/<productKey>/turn.webp` (12 frames of 480 by 360)
  used by shop cards on hover/press. Also 1200 by 630 OG posters per product.
- The hidden route is excluded from the sitemap and `noindex`.
- Budget: each poster under 120 KB, each sprite under 400 KB.

### 3.9 PDP integration (behind `CONFIG.LOOM.ENABLED`)

`CONFIG.LOOM = { ENABLED: true, PRODUCTS: ["blanket-alphabet"], TIER_OVERRIDE: null,
IDLE_LOAD_MS: 1500 }`. PR 2 enables only the alphabet blanket; later PRs append keys as
rigs land. `ProductHero` renders the poster, then `LoomStage` on idle or interaction.
The classic two-tab layout ("Your design" / "Real photos") stays; "Your design" becomes
the stage with pose chips beneath, and the 2D preview moves into a small "chart" toggle
for people who like the schematic (and for the fallback).

Mobile: keep the classic page for configurator products (they are already in
`CONFIG.SHEET.EXCLUDE_KEYS`) and put the stage at the top. For photo-led products, the
immersive sheet's backdrop gains a "3D" segment next to the photos (owner decision 2).

### 3.10 Tests for the engine

- Unit: glyph charts shape and coverage; planner slot mapping matches
  `BlanketLayoutPreview` (import both and compare the cells); planner determinism;
  tier decisions for fixed inputs.
- E2E (`tests/e2e/loom.spec.mjs`, desktop project, launched with the SwiftShader
  flags via `playwright.config.mjs` `launchOptions.args`): open the alphabet blanket
  page, wait for `[data-loom-state="ready"]`, type `OLEN` and `2026`, assert
  `[data-loom-stitches]` grows and `aria-label` contains "OLEN", press `2` and assert
  the pose attribute changes. Mobile project: assert poster renders and the 2D
  preview still updates.
- Visual: one screenshot per rig at the flat-lay pose on `high`, tolerance 2 percent.

### 3.11 Sequence for Phase 1

- **PR 2, Loom core + alphabet blanket rig + PDP integration.** Engine, tier, cloth
  and thread materials, glyphs for Armenian and Latin capitals plus digits, planner,
  stitch renderer, alphabet blanket rig with all four poses, named-chunk budget,
  tests, poster script producing the alphabet blanket posters. Flag on for that
  product only.
- **PR 3, bibs.** Shared bib body, name bib (decal script), Hye Em Yes (with cap),
  lowercase Armenian charts. Posters. Flag extended.
- **PR 4, sets.** Days of the Week, Anushig pair, Bari Akhorzhak set with cap and
  colorways. Posters.
- **PR 5, full alphabet crib blanket + placeholders.** Knit material, picot edge,
  the fixed grid, six body colors. Placeholder rigs if the budget allows.

---

## 4. Phase 2: the storyboarded surfaces (PRs 6 to 8)

### PR 6, Home v3 (`CONFIG.HOME_V3`)

Scenes, top to bottom, each a `<section>` with the existing scroll-driven "theater"
effects and the DEPTH tilt layer kept:

1. **The first stitch.** Poster of the alphabet blanket with a single Ա; on idle the
   Loom stage takes over and stitches the letter in; scrolling pulls the camera back
   over the whole blanket (scroll progress drives `goTo`). Headline stays short
   ("Baby blankets and bibs, stitched by hand."). Primary CTA remains "See what Lusik
   makes" because the e2e suite clicks it.
2. **One woman, one table.** Two-column: the coral Ա macro (`abc-blanket/08.jpg`) and
   the story in four sentences with a link to `/story`.
3. **Seven pieces.** A horizontal scroller of the seven live products using the
   turntable sprites; each card is a real link to its product page.
4. **How ordering works.** Three steps with the realistic lead-time promise from the
   lead-time engine ("Order today, Lusik starts around ..., ships around ...").
5. **Notes from the families.** The CMS testimonials, already in `content/pages`.
6. **From the journal.** Latest two posts.
7. Existing Explore cards remain (the e2e suite and the mobile nav depend on their
   `aria-label` values). If a card is removed or renamed, update
   `tests/e2e/smoke.spec.mjs` in the same PR.

### PR 7, shop and category pages

- Category and shop cards show the Loom poster with the turntable sprite on hover
  (desktop) or while pressed (mobile). No engine load on grids.
- "Try a name" inline field on the alphabet blanket and name bib cards: typing swaps
  the poster for the live stage on that card only, then carries the name into the
  product page via the existing design URL helper (`src/lib/designUrl.ts`).
- The slot left by the removed studio banner becomes the "How ordering works" strip.
- `HelpDecidingSection` gains a three-question chooser (Who is it for, When do you
  need it, Armenian or English) that recommends a product and pre-fills the design.

### PR 8, the fitting room (PDP) and cart thumbnails

- Pose chips, the compare slider (stage versus the closest real photo, using the
  existing `ProductImageGallery` photos), the "About colors" honesty block kept and
  moved directly under the stage.
- Bag rows and checkout summary show a small poster of the configured design. At
  add-to-cart time the stage exports a 320 by 240 WebP via `toDataURL` (cap 40 KB);
  it is stored on the cart item under `thumb`. `SiteProvider`'s localStorage
  shape-validator must accept the optional field, and `mapLegacyId` must ignore it
  (verify the e2e test "Pay with Stripe POSTs to create-checkout-session" still
  passes; the server ignores unknown fields).
- `/welcome`: the landing page for the brochure QR (thank you, care, coupon
  activation link to `/shop`, "send us a photo" mailto with a prefilled subject,
  follow on Instagram). Static, no engine.
- `app/not-found.tsx`: a stitched "Ա?" poster and links back.

---

## 5. Phase 3: commerce, trust, and retention (PRs 9 to 13)

### PR 9, the lead-time engine and copy alignment

- Replace the constants in `src/lib/deliveryEstimate.ts` with `CONFIG.LEAD_TIMES`, in
  weeks, keyed by product group, matching the brochure:
  `blanket-alphabet: [4, 6]`, `blanket-full-alphabet: [10, 12]`,
  `bib-days-of-week: [5, 6]`, `bib-single: [2, 3]`, `bib-hy-em: [2, 3]`,
  `bib-anushig-pair: [3, 4]`, `bib-bari-akhorzhak-set: [3, 4]`.
- New Function `lead-time.mjs` (GET, public, cached 10 minutes): counts open orders
  (`fulfillment_status` not shipped or cancelled) per product group and returns a
  buffer in days (`ceil(openCount * perItemDays)`), capped. The PDP, cart, and
  checkout show "Lusik would start around {date} and ship around {date range}". No
  explanation of why (owner's rule). The confirmation email repeats the range.
- Update every place the site currently promises 5 to 10 business days or "about 2
  weeks": `content/pages/faq.json`, `src/data/policies.js` (shipping section),
  `CONFIG.DELIVERY_NOTE`, `src/i18n/translations.js` FAQ entries, the product JSON
  `details` "Made" rows. Keep the brochure and the site saying the same thing.
- A "Need it by a date?" button opens the existing Text Us / email path with the date
  and product in the message.

### PR 10, order milestones ("While she stitches")

- `netlify/schema.sql`: add
  ```sql
  CREATE TABLE IF NOT EXISTS order_milestones (
    id          bigserial PRIMARY KEY,
    order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    milestone   text NOT NULL CHECK (milestone IN
                ('received','cloth_cut','stitching','backing','finished','shipped')),
    note        text,
    photo_key   text,
    created_at  timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS order_milestones_order_idx ON order_milestones(order_id, created_at);
  ```
- Functions: `admin-order-milestone.mjs` (POST, `requireAdmin`, optional photo via the
  existing `admin-order-photo` blob flow), `order-milestones.mjs` (GET for the
  signed-in owner of the order, or for a signed guest token).
- Guest access: the confirmation email gets a link `/order/{token}` where the token is
  an HMAC of the order id with a new `ORDER_LINK_SECRET` (same pattern as the gift
  reminder unsubscribe). No login, read-only.
- UI: `AdminOrderDetail` gets one-tap milestone buttons with an optional photo; the
  account `OrderCard` and the guest page show a vertical timeline with photos.
  "Received" is inserted automatically by `stripe-webhook.mjs` when the order row is
  created; "shipped" is inserted when `shipped_at` is stamped.
- Email: an optional "Lusik started on your piece" email at the `stitching`
  milestone, sent once (stamp `orders.stitching_emailed_at`), reusing the
  finished-photo email pattern.

### PR 11, gifts, saved designs, sharing

- Gift flow at checkout: message (previewed as a small stitched card), ship to the
  recipient, hide prices on the packing note (a checkbox stored on the order and
  shown in admin), gift receipt page reached from the recipient's tracking link.
- Public design page `/design/[id]` for saved designs (they already exist under
  `saved-designs`): the poster of the design, "Made by Lusik for ...", an
  `opengraph-image.tsx` route that composes the pre-rendered poster and the name with
  `next/og` (no WebGL at request time). Share sheet with copy link.
- "Add to your baby registry": a copy-link button with guidance for universal
  registries. No third-party script.

### PR 12, reviews and the "Made for" wall

- Post-delivery email 14 days after `shipped_at` (a scheduled Function like
  `gift-reminder.mjs`) with a signed link to `/review/{token}`: stars, a sentence,
  an optional photo, and a consent checkbox for showing the photo publicly (the site
  already models `social_consent`).
- `reviews` table (order_id, product_key, rating, body, photo_key, consent, status,
  created_at); `admin-reviews.mjs` to approve; the PDP shows approved, verified
  reviews under the CMS testimonials; `/gallery` gains a "Made for" wall of consented
  photos.

### PR 13, coupons that always work

- Today the checkout attaches the automatic bundle coupon when the bag has two or
  more units, and Stripe then hides the promotion-code field (documented in
  `_lib/bundle-discount.mjs`). The printed coupon sheet needs codes to work on any
  order. Recommended fix: keep `allow_promotion_codes: true` always, and apply the
  bundle savings server-side as a per-unit price reduction on the line items instead
  of a Stripe coupon (the webhook already records `amount_total`). Update
  `CONFIG.BUNDLE_DISCOUNT`, `_lib/bundle-discount.mjs`, the drift test, and the bag's
  savings row in the same PR. Owner decision 5.
- Document in `print/README.md` how to create the three coupon codes in Stripe and
  flip `CODES_CONFIRMED` in `print/coupons/coupons.html`.

---

## 6. Phase 4: performance and the quality bar (PR 14)

- Product photos through `next/image` with the Netlify image CDN (AVIF and WebP,
  responsive `sizes`), `priority` on the hero and first card only. Target LCP under
  2.0 s on the mobile Lighthouse run for `/`, `/shop`, and one PDP.
- Fonts via `next/font` (Fraunces, DM Sans, Allura, and a Noto Serif Armenian subset
  for Armenian glyphs) with `display: swap`; remove the Google Fonts `<link>`.
- `lighthouserc.json`: add `/shop`, `/shop/blankets/armenian-alphabet-blanket`, and
  `/cart`; raise assertions to `error` at performance 0.90, accessibility 0.95,
  best-practices 0.95, SEO 0.95 (owner decision 6). Three runs per URL.
- Axe: add `@axe-core/playwright` and run it on every page in the visual suite;
  fail on serious and critical violations.
- INP: audit the configurator and the stage for long tasks; keep planner work off the
  input handler with `scheduler.postTask` or a microtask.
- Sentry: tag releases with the git SHA so Loom errors are traceable by tier.
- Re-verify the 210 KB per-route budget and the Loom chunk budget; print both in the
  PR body.

---

## 7. Phase 5: admin, content, and documentation (PR 15)

- `content/pages/home.json` gains the Home v3 scene copy so Lusik can edit it in the
  Studio (`public/studio/config.yml` updated accordingly; the generator validates).
- Armenian keyboard helper on every name input: a small on-screen Armenian letter
  picker for parents typing on English keyboards, with `hy` strings marked
  `TODO_LUSIK_REVIEW`.
- `CLAUDE.md`: new sections for the Loom, the design bus, the lead-time engine,
  milestones, reviews, and the coupon mechanism; remove the studio section; refresh
  the status banner. Keep it accurate; it is what the next session reads.
- `print/README.md` cross-links `/welcome` and the coupon steps.

---

## 8. PR list, order, and size

| PR | Title | Phase | Depends on | Size | Risk | Flag / rollback |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Remove the Embroidery Studio, add ProductHero, design bus, visual baseline | 0 | none | M | Low | Revert |
| 2 | Loom core + alphabet blanket rig + PDP stage | 1 | 1 | XL | Medium | `CONFIG.LOOM.ENABLED` |
| 3 | Bib rigs (name bib, Hye Em Yes) | 1 | 2 | L | Low | `CONFIG.LOOM.PRODUCTS` |
| 4 | Set rigs (days, Anushig, Bari Akhorzhak) | 1 | 3 | L | Low | `CONFIG.LOOM.PRODUCTS` |
| 5 | Full alphabet crib blanket rig + placeholders | 1 | 2 | L | Low | `CONFIG.LOOM.PRODUCTS` |
| 6 | Home v3 | 2 | 2 | L | Medium | `CONFIG.HOME_V3` |
| 7 | Shop and category cards with posters and turntables | 2 | 2 | M | Low | `CONFIG.LOOM.CARDS` |
| 8 | Fitting room PDP, cart thumbnails, `/welcome`, 404 | 2 | 2 | M | Medium | `CONFIG.LOOM.FITTING_ROOM` |
| 9 | Lead-time engine + copy alignment | 3 | none | M | Low | `CONFIG.LEAD_TIMES.ENGINE` |
| 10 | Order milestones + guest order link | 3 | none | L | Medium | `CONFIG.ORDER_TRACKER` |
| 11 | Gifts, saved design pages, share | 3 | 2 | M | Low | `CONFIG.GIFTS_V2` |
| 12 | Reviews + Made-for wall | 3 | 10 | M | Low | `CONFIG.REVIEWS` |
| 13 | Coupons always work (bundle as line-item pricing) | 3 | none | S | Medium | Revert (drift tests guard) |
| 14 | Performance pass + Lighthouse gates | 4 | 6, 7, 8 | M | Low | Per-item |
| 15 | Studio content fields, Armenian keyboard, CLAUDE.md refresh | 5 | all | M | Low | Per-item |

Sizes: S under a day, M one to two days, L two to four days, XL a week of focused
work for one session. PRs 9, 10, and 13 do not depend on the Loom and can be
interleaved when the owner wants visible commerce wins early.

---

## 9. Decisions the owner should make (short answers are fine)

1. Old `/embroidery` links: redirect to `/shop` (recommended) or plain 404.
2. Phones: put the 3D stage at the top of the classic product page (recommended
   first), or also inside the photo-led immersive sheet as a "3D" segment.
3. Confirm the brochure lead times become the website's lead times (PR 9).
4. Reviews: OK to email customers two weeks after delivery asking for a review and a
   photo, with a consent checkbox (PR 12).
5. Coupons: OK to change how the multi-piece discount is applied so promotion codes
   always work (PR 13).
6. Lighthouse: OK to make the scores blocking on PRs (PR 14).
7. Which product should the first 3D rig be if not the alphabet blanket. (Plan
   assumes the alphabet blanket, since it has the live name and year inputs.)

---

## 10. Appendices

### A. Definition of done, per PR

- Typecheck, unit, e2e (both projects), visual suite, build with budgets, Lighthouse:
  all green, numbers pasted into the PR body.
- No new console errors on `/`, `/shop`, a PDP, `/cart`, `/checkout`.
- Reduced motion checked once by hand (Chrome DevTools rendering panel).
- Keyboard-only walkthrough of any new interaction.
- Flag documented in `CONFIG` with a two-line comment (what it does, how to roll back).
- `CLAUDE.md` touched only if the architecture changed; otherwise leave it for PR 15.

### B. Glyph chart format and example

```ts
// stitch/glyphs.ts
export const CAPS_HY: Record<string, string[]> = {
  "Ա": [
    ".............",
    "....XXXX.....",
    "...X....X....",
    "...X....X....",
    "...X....X....",
    "...X....X....",
    "...X....X....",
    "...X....X....",
    "...X....X....",
    "...X....X....",
    "...X....X.X..",
    "...X....XX.X.",
    "...X....X..X.",
    "...X....XXXX.",
    ".............",
  ],
  // ...
};
```

Every chart is 13 columns by 15 rows. Charts are authored by hand against the
photos; do not auto-trace a font, the stitched letterforms have their own
proportions (compare `abc-blanket/08.jpg`).

### C. CONFIG additions (sketch)

```js
LOOM: {
  ENABLED: true,
  PRODUCTS: ["blanket-alphabet"],          // rigs that are switched on
  CARDS: false,                            // posters/turntables on shop cards (PR 7)
  FITTING_ROOM: false,                     // pose chips + compare slider (PR 8)
  IDLE_LOAD_MS: 1500,                      // wait after load before fetching the engine
  TIER_OVERRIDE: null,                     // "high" | "mid" | "low" | null
  CHUNK_BUDGET_KB: 230,                    // mirrored in scripts/check-bundle-budget.mjs
},
HOME_V3: false,
LEAD_TIMES: {
  ENGINE: true,
  WEEKS: { "blanket-alphabet": [4, 6], "blanket-full-alphabet": [10, 12],
           "bib-days-of-week": [5, 6], "bib-single": [2, 3], "bib-hy-em": [2, 3],
           "bib-anushig-pair": [3, 4], "bib-bari-akhorzhak-set": [3, 4] },
  QUEUE_DAYS_PER_OPEN_ORDER: 2, QUEUE_BUFFER_CAP_DAYS: 21,
},
ORDER_TRACKER: false,
GIFTS_V2: false,
REVIEWS: false,
```

### D. Data model additions

`order_milestones` (Appendix in PR 10 above), `reviews` (PR 12), and three new
`orders` columns: `stitching_emailed_at timestamptz`, `gift_hide_prices boolean
default false`, `review_emailed_at timestamptz`. All additive; `schema.sql` stays
idempotent (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).

### E. Photo reference index

| Product | Folder under `public/img/` | Best references |
| --- | --- | --- |
| Armenian Alphabet Blanket | `abc-blanket/` | `03` (name + year layout), `07` (weave), `08` (letter macro), `12` (full navy), `14` (English), root `hero-olen-bib.jpg`, `date-detail.jpg` |
| Full Alphabet Crib Blanket | `full-alphabet/` | `12`, `55` (whole grid), `33`, `38` (backing, edge), `41` to `44` (macros), `cover` (stack) |
| Days of the Week | `days-bib/` | `02` (stack), `14` (fan), `05` to `13` (cascades by color) |
| Custom Name Bib | root | `hero-olen-bib.jpg`, `bib-romeo.jpg`, `bib-examples/03`, `04` |
| Hye Em Yes | `hye-em-bib/` | `cover`, `03` |
| Anushig pair | `anushig-bib/` | `01`, `03`, `04` |
| Bari Akhorzhak | `bari-akhorzhak-set/` | `cover` (with cap), `07`, `24` (inset panel), `25`, `26` |
| Caps | `hero/06-blue-baby-hat.jpg` | brim and rib |

Many older photos carry a red or orange camera date stamp in a corner; never use those
for posters or comparisons.

### F. Things that look like problems but are intentional

- The brochure's lead times differ from the site's until PR 9 lands.
- The coupon sheet prints a DRAFT strip until real codes exist in Stripe.
- `TODO_LUSIK` and `TODO_LUSIK_REVIEW` markers stay; they are addressed to the owner.
- Placeholder products stay placeholders; do not flip a product to live.

---

## 11. The ten-million-dollar layer (added 2026-09-09)

The owner asked what a team with a ten-million-dollar budget for coding, planning,
storyboarding, and color theory would add, and how the site should degrade when
bandwidth, RAM, storage, or screen size are constrained. This section answers both.
It sits on top of Phases 0 to 5; it does not replace them. Everything here follows
the same "nothing can break" protocol and ships behind flags.

Two kinds of work appear below. **Claude work** is what the executing session can
build. **Human work** is what a budget buys that code cannot: a photo and video
shoot, physical texture capture of the actual pieces, a native Armenian linguist,
and usability sessions with real families. Human work is listed so the owner can
commission it; the code is designed so each human asset drops into a slot that
already has a fallback.

### 11.1 The capability ladder (fallbacks for slow networks, low RAM, low storage, small screens)

One decision, made once per session in `src/lib/capability.ts`, drives every asset
choice on the site. It never guesses from the user agent; it reads real signals and
re-evaluates when they change.

Signals read (each optional; missing signals default to the middle tier):

- Network: `navigator.connection.effectiveType` (`slow-2g`, `2g`, `3g`, `4g`),
  `downlink`, `rtt`, `saveData`, and the `prefers-reduced-data` media query. Also a
  live measurement: the transfer time of the first product image, which corrects the
  estimate on networks that lie.
- Memory and CPU: `navigator.deviceMemory`, `navigator.hardwareConcurrency`, and
  `performance.memory` where present.
- Storage: `navigator.storage.estimate()` for quota and usage, plus a try/catch
  around every `localStorage` write.
- Screen: viewport width and height, `devicePixelRatio`, `screen.colorDepth`,
  `prefers-contrast`, `forced-colors` (Windows high contrast), `prefers-reduced-motion`,
  `hover: none` (touch), orientation, and the visual viewport when the keyboard is up.
- GPU: the Loom probe from Phase 1 (WebGL 2 available, renderer string, a 200 ms
  timed draw).
- Power: `getBattery()` where it exists; below 15 percent and discharging, drop one
  tier for animation and 3D.

Three tiers, with an override `?tier=full|lean|core` for testing and a footer
"Lighter version" toggle that persists the choice:

| Asset class | Full (4G, 4 GB+, desktop or recent phone) | Lean (3G, save-data, 2 to 3 GB RAM, low battery) | Core (2G, under 2 GB RAM, storage nearly full, no WebGL, or JS off) |
| --- | --- | --- | --- |
| Photos | AVIF/WebP, responsive `sizes`, DPR up to 2, blur-up placeholder (a 20-byte base64 thumbhash inlined at build time) | AVIF/WebP at DPR 1, decorative photos skipped, blur-up kept | One small JPEG per product, no decorative images, hero is a color block with the poster only on demand |
| Video (Scene 1 hero, story page) | HLS adaptive stream (Mux or Cloudflare Stream; both work with Netlify), muted autoplay, poster first | No autoplay; poster with a play button; 480p rendition | Poster image only, no video element |
| 3D (Loom) | High tier: shadows, 2K procedural textures, DPR 2 | Mid tier: 1K textures, DPR 1.5, no shadows, fewer fringe strands; poster stays until interaction | Poster plus the 2D chart preview; never loads the engine |
| Fonts | Fraunces, DM Sans, Allura, Noto Serif Armenian subsets, `font-display: swap`, `size-adjust` metrics on the fallback stacks so text does not shift | Display face `font-display: optional` (used only if cached), body font swapped | System fonts with the same metrics-matched fallback stack; Armenian glyphs from the system |
| JavaScript | Full routes, engine on idle | Engine only on explicit tap ("Show it in 3D"), non-critical islands deferred until viewport | Server-rendered pages work without JS: browse, read, call, email. Configurators show a `<noscript>` note and the phone number |
| Storage | Service worker caches the shell and the current product's posters, capped at 25 MB, evicts oldest first | Cache cap 8 MB, posters not cached | No caching; cart kept only in memory plus a cookie-sized fallback (the product keys and design text, under 2 KB) |
| Motion | Full choreography | Shorter durations, no parallax, no scroll-driven camera | No motion beyond opacity |
| Screens | Container-query layouts from 320 px to 5K; 3D DPR capped at 2 even on 5K | Same layouts, fewer columns | Single column, 44 px touch targets, no hover-only affordances |

Rules that make the ladder trustworthy:

- **Measure, do not assume.** `web-vitals` reports LCP, INP, CLS, and the chosen tier
  to Umami (consent-gated, already in place) so the owner can see the real
  distribution. If more than ten percent of sessions land in Lean, that is a design
  input, not a failure.
- **Never trap a user in a tier.** The footer toggle and the `?tier=` override always
  work, and the choice is remembered per device.
- **Test every tier in CI.** Playwright projects `lean-3g` (Chrome's Slow 3G profile,
  CPU 4x slowdown, viewport 360 by 640, DPR 2) and `core-2g` (offline after first
  load, JS disabled for the browse tests). Both run the smoke suite. Lighthouse adds
  a throttled mobile run per PR.
- **Budgets per tier.** Full: 210 KB first-load JS, LCP under 2.0 s. Lean: 150 KB,
  LCP under 3.5 s on Slow 3G. Core: 60 KB, LCP under 4 s on 2G, and the page is
  usable with JS disabled. The bundle-budget script grows a per-tier section.
- **Offline.** A service worker serves an offline page with the phone number, the
  email, the Instagram handle, and the 2D design chart so a parent can finish a
  design on the train and add it to the bag when back online (queued in
  IndexedDB, flushed on `online`).
- **Screen constraints specifically.** Foldables and split-screen tablets are covered
  by container queries, not viewport queries. Landscape phones get a two-column PDP
  with the stage on the left. Very small screens (320 px) drop the second column
  everywhere and hide the compare slider. Windows high-contrast mode gets real
  borders instead of shadows (`forced-colors: active`). Large-print users
  (`prefers-contrast: more`) get the AAA palette below.

### 11.2 Color theory and the design system

Today the palette is ink `#1A1612`, cream `#F5EFE3`, a pomegranate red, gold, and the
DMC thread hexes. A funded team would turn that into a system.

- **Derive from the cloth, not from a swatch book.** Sample the real materials: the
  white waffle cloth, the terry, the six knit body colors, the satin, and the DMC
  threads in use. Build the palette in OKLCH so lightness steps are perceptually
  even: `linen-50` to `linen-900` (warm neutrals from the cloth), `ink-*` (from the
  navy thread, not black), `pomegranate-*`, `gold-*`, and one accent per thread
  family (rose, sage, delft, lavender, coral). Every token has a light and a dark
  value.
- **Two atmospheres.** "Morning at the table" (default: linen ground, ink text,
  window light) and "Evening at the table" (dark mode: ink ground, warm lamp light,
  thread colors slightly desaturated so they do not glow). Dark mode follows the
  system setting and the footer toggle. A subtle time-of-day warmth shift (two
  percent toward amber after 6 pm local time) is allowed on Full tier only and is
  off under `prefers-contrast`.
- **Contrast gates.** Body text AAA (7:1), UI text AA (4.5:1), large display AA, and
  every thread chip labeled with its DMC number and name so color is never the only
  signal. A unit test runs the whole token set through a contrast checker in both
  atmospheres and fails on any regression. Color-blind simulation (protan, deutan,
  tritan) is part of the visual suite for the thread picker.
- **Thread truth.** The picker shows each DMC color as it looks on white terry and on
  the waffle cloth (two tiny rendered chips per color, generated by the poster
  script), with a note that dye lots vary. This replaces guesswork with the honesty
  the owner already insists on in print.
- **Type system.** Fraunces for display with optical size tied to rem, DM Sans for
  UI, Allura only for signatures, Noto Serif Armenian for Armenian glyphs matched to
  Fraunces' x-height with `size-adjust`. A modular scale (1.2 on phones, 1.25 on
  desktop), a baseline grid of 4 px, and measure capped at 68 characters.
- **Motion language.** One spring for finger-driven things, one ease for content,
  durations 120/240/400 ms, and a documented "thread draw" reveal (a line draws
  across, content follows) used sparingly. All documented in `docs/design-system.md`
  with the tokens in `src/styles/tokens.css` and mirrored in `tailwind.config.mjs`.
- **Print parity.** The same tokens feed the brochure and coupon sheet in `print/`
  so the box and the site match.

### 11.3 Premium features worth the money

Each is scoped as a flag and a PR. Ordered by impact on the feeling of "a team built
this."

1. **Hands at work (human work + Claude work).** A one-day shoot: Lusik's hands
   stitching a single Ա, thread pulled through the cloth in macro, the kitchen
   table, the blankets folded, the box being packed. Deliverables: a 20-second hero
   film, six 4-second loops, and stills. Code: the hero streams via HLS with the
   capability ladder; the loops become the poster backgrounds on the story page.
   Until the shoot exists, the Loom's "first stitch" scene plays instead, so nothing
   waits on the shoot.
2. **True texture capture (human work + Claude work).** Photograph each fabric on a
   flatbed scanner or under cross-polarized light at 1200 dpi to produce real
   albedo, normal, and roughness maps for the waffle weave, terry, knit, satin, and
   fringe. Code: the Loom's `materials/cloth.ts` gains a "captured" path that
   streams 512, 1K, and 2K mip levels by tier (KTX2 with Basis compression, about
   300 KB per fabric at 1K). Procedural textures remain the fallback for Lean and
   for any fabric not yet captured.
3. **See it in your nursery (AR).** From any configured design: "View in your room."
   iPhone gets a USDZ via Quick Look, Android gets a glTF via Scene Viewer, both
   exported client-side from the live rig (`GLTFExporter`, `USDZExporter`, loaded
   on demand, roughly 60 KB extra). The exported model is the real design with the
   real name. Fallback: a "hold up your phone" poster with the blanket at true
   scale on a ruler.
4. **The certificate.** Every order ships with a signed PDF "Made for {name}": the
   stitch chart of their design, the DMC thread numbers, the date, the piece's
   number in Lusik's ledger, and her signature. A QR on it opens the design page.
   Generated by a Function with the poster and the chart (no WebGL server-side).
   Printed at home by the family or included in the box. Ties the box to the site.
5. **Name meanings and the Armenian keyboard.** As a parent types a name, the page
   offers the Armenian spelling and a one-line meaning ("Anoush means sweet") from a
   curated list of a few hundred Armenian names, reviewed by a linguist (human
   work). Western and Eastern spellings both shown. The on-screen Armenian keyboard
   from Phase 5 becomes part of this.
6. **Design together.** A shareable design link where two people edit the same
   design live (both parents, or a parent and Grandma), with presence dots and a
   one-tap "I like this one." Realtime through a small WebSocket service (PartyKit
   or Ably; Netlify Functions cannot hold sockets). Fallback: the link carries the
   design state in the URL and edits are shared by re-sending the link.
7. **The alphabet room.** An interactive page for all 38 letters: each letter stitches
   itself in, plays its pronunciation (recorded by Lusik, human work), shows a word
   that starts with it, and links to a blanket with that letter. Doubles as SEO
   content and as the thing families send each other.
8. **Gift video.** A recipient scanning the QR in the box sees a recorded message
   from the giver (uploaded at checkout, stored in Blobs, 60-second cap, expires in
   a year). Fallback: the written gift message.
9. **Concierge.** A "Talk it through with Lusik" booking (the Calendly link already
   exists) placed on the PDP for the two blankets, plus a WhatsApp and iMessage
   deep link next to the phone number.
10. **Ledger and provenance.** Each piece gets a number in a public "ledger" page
    (opt-in, first names only): number 214, a blanket for Olen, Buena Park,
    March 2027. Quiet, credible, and it makes the waiting list visible without a
    dashboard.
11. **Page transitions and the thread.** The View Transitions API for route changes
    (shared-element transition of the product poster into the PDP) with a plain
    fade fallback in browsers without it, and the "thread draw" reveal on section
    entry. Off under reduced motion.
12. **Sound, off by default.** A single soft needle-through-cloth tick when a stitch
    lands in the live preview, behind a mute toggle that starts muted. Never on Lean.
13. **Easter egg.** Typing "Lusik" or "Լուսիկ" into any name field stitches a small
    heart next to the name.

### 11.4 Team and production plan a budget buys

For the owner's planning, the roles and what each hands to the executing session:

- Creative director and art director: the storyboard signed off as frames, a
  motion reel, and the shot list for the shoot.
- Photographer and videographer: item 1 above; deliver in ProRes and 4K stills.
- Materials technician: item 2 above; deliver texture maps and physical
  measurements of every product (the JSON still has a size `TODO_LUSIK` on the crib
  blanket).
- 3D artist: reviews the rigs against the real pieces and the captured textures;
  provides the crib rail and tabletop props as small glTF files (under 200 KB each).
- Armenian linguist (Western and Eastern): the name list, the `hyw` strings staged
  in `translations.js`, and a review of every Armenian string on the site and in the
  brochure.
- Accessibility specialist: a WCAG 2.2 AA audit with AAA for text, screen reader
  walkthroughs of the configurator and the 3D stage, and the high-contrast pass.
- Performance engineer: owns the capability ladder budgets and the device lab (a
  real low-end Android on a throttled network, an older iPhone, a 4K desktop).
- Researcher: eight sessions with Armenian-American families ordering a real gift,
  before Home v3 and after; findings feed copy and the chooser in
  `HelpDecidingSection`.
- Copywriter: keeps the sons' voice; every new string reviewed against the rules
  (no em dashes, no prices in print, colors vary, honest lead times).

### 11.5 Additional PRs

| PR | Title | Depends on | Size | Flag |
| --- | --- | --- | --- | --- |
| 16 | Capability ladder: signals, tiers, override, RUM reporting, CI tier projects | 1 | L | `CONFIG.TIERS` |
| 17 | Design tokens in OKLCH, two atmospheres, contrast tests, thread-truth chips | 1 | L | `CONFIG.THEME_V2` |
| 18 | Service worker, offline page, queued cart, storage-aware caching | 16 | M | `CONFIG.PWA_V2` |
| 19 | Hero film pipeline (HLS, poster ladder) with Loom fallback | 6, 16 | M | `CONFIG.HERO_FILM` |
| 20 | Captured textures path with KTX2 streaming by tier | 2, 16 | L | `CONFIG.LOOM.CAPTURED_TEXTURES` |
| 21 | AR export (USDZ, glTF) from the live rig | 2 | M | `CONFIG.LOOM.AR` |
| 22 | Certificate PDF + design QR | 11 | M | `CONFIG.CERTIFICATE` |
| 23 | Name meanings + Armenian keyboard + linguist review markers | 15 | M | `CONFIG.NAMES` |
| 24 | Design together (realtime) with URL-state fallback | 11 | L | `CONFIG.COLLAB` |
| 25 | The alphabet room | 2 | M | `CONFIG.ALPHABET_ROOM` |
| 26 | Gift video | 11 | M | `CONFIG.GIFT_VIDEO` |
| 27 | Ledger page, concierge links, view transitions, sound toggle, easter egg | 8 | M | per item |

PR 16 should land right after PR 1; every later PR then reads the tier instead of
inventing its own checks. PR 17 can run in parallel with the Loom work.

### 11.6 What "premium" must never cost

- A slower first paint for anyone. The Full tier is a reward for capable devices,
  not the default that others fall short of.
- The owner's rules: no prices in print, no em dashes in customer copy, colors vary
  on every product, honest lead times with no explanation attached.
- Any change to pricing, auth, or the cart shape outside PR 13.
