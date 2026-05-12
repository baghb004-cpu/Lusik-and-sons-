# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page marketing + e-commerce site for **Lusik & Sons**, a Cypress, CA maker of hand cross-stitched Armenian alphabet baby blankets and related goods. The entire site is one file: `index.html` (~4.6 MB, ~6,900 lines). There is no build step.

## Architecture — the one thing to know

`index.html` is a self-contained SPA. Everything (React components, styles, product data, base64-encoded product photos) lives in this one file. The runtime stack is loaded from CDNs in `<head>`:

- **React 18** + **ReactDOM** (UMD builds)
- **Babel Standalone** — transpiles the single `<script type="text/babel" data-presets="env,react">` block at runtime, so JSX works without a bundler
- **Tailwind CDN** — utility classes via runtime JIT
- **`@supabase/supabase-js`** — auth, profiles, addresses, saved carts, order history, avatar uploads
- Google Fonts: Fraunces (display), DM Sans (body), Allura

Deploy target is **Netlify** (static hosting of this one file). There is no package.json, no node_modules, no test runner, no linter — by design.

### File layout inside `index.html`

Approximate line ranges drift as the file grows; use these as starting points, not gospel:

| Lines | Contents |
| --- | --- |
| 1–73 | `<head>`: meta tags, OpenGraph/Twitter cards, favicons, CDN script tags |
| 74–477 | `<style>`: custom CSS (animations, mega-menu, back-to-top, text-us widget, tooltips) |
| 483–502 | Loading splash + `<div id="root">` + image data placeholder script |
| 505–600 | SVG icon components (`<Icon>` wrapper + per-icon definitions) |
| ~570 | `PHOTO_*` base64 constants — comment says "When deployed, replace these data: URIs with /img/*.jpg" |
| ~602 | `PRODUCT` — the live Armenian Alphabet Blanket: gallery, specs, thread colors (DMC palette), color presets (Boys/Girls/Unisex/Purple/Armenian Flag), alphabets, layouts |
| ~973 | `CATALOG` — multi-category catalog (blankets / bibs / towels / baby). Most items are `status: "placeholder"` pending Lusik's photos and pricing |
| ~1077 | `CONFIG` — all tunable values: Supabase URL/anon key, upload caps, cart storage key, debounce timing, text-us phone, etc. |
| ~1160 | `SOCIAL_PLATFORMS` — tier1/tier2 social drawer entries |
| ~1223 | `LANGUAGES`, `TRANSLATIONS` — i18n tables |
| ~1844 | `LangContext` + `LanguageProvider` + `useT()` |
| ~2194 | `supa` — Supabase client wrapper (lazy-init, all DB calls go through this) |
| ~2380 | `BackToTopButton`, `TextUsWidget` (fixed-position UI) |
| ~2708 | `App` — root component, holds cart + view + auth state |
| ~3562 | `HeartBurst` — add-to-cart feedback animation |
| ~3609 | `PolicyModal` — Privacy / Terms / Refunds (intentionally English-only) |
| ~3814 | `AuthDrawer` — sign-in / sign-up |
| ~4053 | `AccountView`, `OrderHistory`, `OrderCard` |
| ~4530 | `HomeView`, `TrackingForm`, `NewsletterForm` |
| ~4920 | `CustomProductCard` — bibs / custom-image embroidery flow |
| ~5570 | `ProductTemplate`, `BlanketLayoutPreview` — SVG previews of the blanket layout |
| ~5955 | `ProductShowcase` — the main PDP for the Armenian Alphabet Blanket |
| ~6705 | `CheckoutView` — calls the Supabase Edge Function and hands off to Stripe |
| ~6880 | `ReactDOM.createRoot(...).render(<LanguageProvider><App/></LanguageProvider>)` |

## Backend — what is NOT in this repo

The site talks to two external systems that are **not** in this repository:

1. **Supabase project** (`gvxnvpyzgwbigpopuhis.supabase.co`)
   - Tables: `profiles`, `addresses`, `saved_carts`, `orders`, `order_items`
   - Storage buckets: `profile-photos` (avatars), and a custom-embroidery image bucket
   - RPC: `link_guest_order_to_user` — code comments reference `schema_phase3.sql` and a `handle_new_user` trigger; those SQL files live in the Supabase project, not here
   - Row-Level Security is what makes the anon key in `CONFIG.SUPABASE_ANON_KEY` safe to ship in browser code
2. **Supabase Edge Function**: `create-checkout-session` — receives the cart, validates products against a `TRUSTED_PRODUCTS` map server-side, and returns a Stripe Checkout URL. The browser does a pre-flight `mapLegacyId` translation that mirrors the Edge Function's helper (`index.html` around line 6780); if you change cart-ID shapes here, the Edge Function must change too.

Stripe webhook → `orders` / `order_items` write-back is implied by the order-history queries but happens entirely server-side.

## Conventions

- **One file, no build.** Resist the urge to split `index.html` into modules. Babel Standalone transpiles JSX in-browser; adding a bundler would defeat the deploy-by-uploading-one-file model.
- **`CONFIG` is the dial board.** Tunable numbers, feature flags, the text-us phone, upload caps, the limited-edition order count — change them in `CONFIG` (~line 1077), not inline at call sites.
- **`supa` is the only Supabase access path.** New DB or storage interactions should be added as named helpers on the `supa` object (~line 2194), not by calling `window.supabase.createClient` again.
- **i18n via `t("key.path")`.** Strings live in `TRANSLATIONS.en|hy|hyw`. Missing keys fall back to English automatically. Eastern Armenian (`hy`) is the only non-English language currently surfaced to users; `hyw` is staged for Lusik's review.
- **TODO markers are intentional and addressed to Lusik, not Claude.** Two flavors appear throughout:
  - `⚠️ TODO_LUSIK` — needs Lusik's photos, pricing, or product confirmation before going live
  - `⚠️ TODO_LUSIK_REVIEW` — auto-translated Armenian strings awaiting a native speaker's review
  Do not silently "fix" these; they are tracking real product/content gaps.
- **Placeholder products are real.** Anything in `CATALOG` with `status: "placeholder"` renders a coming-soon card. Don't promote one to `"live"` without the corresponding photos, price, and copy.
- **`CONFIG.ROTATED_GALLERY_INDEXES`** is a CSS-rotation band-aid for sideways source images. Once an image is re-uploaded correctly, remove its index from that Set; the rotation vanishes everywhere it was applied.
- **Reduced-motion is honored.** The heart-burst animation and cart pulse explicitly check `prefers-reduced-motion`. Match this pattern for any new decorative animation.
- **Cart IDs encode the variant.** A blanket cart row's `id` looks like `blanket-{alphabet}-{layout}-{blockDMC}-{letterDMC}[-multi-{dmcs}]`. Two orders with different colors must remain separate line items, not stack as qty=2. The Edge Function's `TRUSTED_PRODUCTS` map keys off the layout suffix, so the format is load-bearing.

## Local development

- Open `index.html` directly in a browser, **or** serve the directory (e.g. `python3 -m http.server`) — the latter is safer because Babel Standalone and Supabase OAuth callbacks behave better over `http://` than `file://`.
- Hard-reload (Cmd/Ctrl-Shift-R) is usually necessary after edits because of the Babel transpile cache and Tailwind CDN behavior.
- There are no automated tests. Verify changes by clicking through: home → product → add to cart (with each preset) → cart drawer → checkout (Stripe hand-off can be observed but actual payment requires the real Stripe keys on the Edge Function side).
- Pre-launch checklist embedded near the top of `<head>` (OpenGraph block, lines 11–35) lists external assets that must exist at deploy time: `/og-image.jpg` (1200×630), `/favicon.ico`, `/apple-touch-icon.png`.

## Working in this repo

- Active development branch for documentation changes: `claude/add-claude-documentation-Vi3zH`.
- Remote: `origin` points at `baghb004-cpu/lusik-and-sons-` (GitHub).
- No README, no Cursor rules, no Copilot instructions exist — this file is the only ambient guidance.
