# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Status banner — last updated 2026-06-09.** Four big things to know, all now
> reflected below:
> 1. **The Next.js (App Router) migration is COMPLETE and flipped to production.**
>    The site was a Vite-built React SPA; it is now a **Next.js App Router** app.
>    `netlify.toml` builds with `next:build`, publishes `.next`, and runs through
>    `@netlify/plugin-nextjs`. **Vite is fully retired** — no `vite.config`, no
>    `dist/`, no `src/main.jsx`, no `src/App.jsx`. (See the bottom of this doc and
>    `NEXTJS_MIGRATION_PLAN.md` for the phase-by-phase history.)
> 2. **The UI went through an Apple-Store-style redesign** (mobile bottom-nav +
>    "Liquid Glass" aesthetic, home "Explore" cards, a real `/shop/<category>/<product>`
>    route hierarchy, and a narrative copy rewrite). The e2e smoke suite was updated
>    to match in PR #147.
> 3. **Launch-readiness polish landed** after the flip: a PNG icon set + favicon +
>    maskable icon, Organization JSON-LD, branded `404`/error pages, Sentry wired
>    into the Next provider shell (DSN-gated), and a dependency-review CI gate.
> 4. **Ads are live and consent-gated (June 2026).** A Meta Pixel + Google Ads
>    tag load from `app/providers.tsx`, behind the CPRA do-not-share opt-out in
>    `src/lib/adConsent.ts` (footer "Your privacy choices" link + a live switch
>    inside the Privacy Policy; GPC browser signals honored). The Privacy Policy
>    was rewritten to disclose them — keep it in sync with the tags. The cart now
>    also persists (localStorage for everyone + debounced `saved-cart` PUT for
>    signed-in users, cleared on the `?order=success` return), and the Full
>    Alphabet Crib Blanket is **live**, no longer the priced-placeholder example.

## What this is

A marketing + e-commerce site for **Lusik & Sons**, a Cypress, CA maker of hand
cross-stitched Armenian alphabet baby blankets and related goods. The frontend is
a **Next.js (App Router) app** (routes under `app/`, components/data/libs under
`src/`); the backend is a small `netlify/` directory holding the database schema
and the serverless functions every backend interaction goes through.

## Architecture — the one thing to know

The site is a **Next.js App Router app**. File-based routes live under `app/`; the
bulk of the React code (components, data, libs, i18n, state) still lives under
`src/` and is imported by the route files. There is no more Vite, no
Babel-Standalone runtime transpile, no Tailwind CDN, no React UMD chain — all
removed across the migration described near the bottom of this doc.

The split: `app/<segment>/page.tsx` is a thin server-component shell that imports a
matching `src/routes/<Name>Route.jsx` client component (e.g. `app/page.tsx` →
`HomeRoute`, `app/shop/[category]/[product]/page.tsx` → `ProductRoute`). The whole
client tree mounts behind **one** `"use client"` boundary in `app/providers.tsx`
(language, toasts, and the `SiteProvider` that owns cart/nav/auth state — what the
old monolithic `src/App.jsx` used to own). `app/layout.tsx` is the root layout
(`<head>` metadata, fonts, the Netlify Identity script, `<Providers>`).

Runtime stack:

- **Next.js 15** (App Router) on **React 18.3** (real npm deps)
- **Tailwind** via PostCSS at build time (config in `tailwind.config.mjs` /
  `postcss.config.mjs`)
- **`netlify-identity-widget`** — auth (signup, login, password reset, JWT
  issuance), loaded from `identity.netlify.com` via a `next/script`
  (`lazyOnload`, with an `onReady` that re-runs `auth.init()`) tag because
  Netlify's confirmation redirect handler expects `window.netlifyIdentity` from
  their CDN. Loaded off the critical path since most visitors never sign in; the
  `auth.js` hash-token handler retries ~5s so the email-confirmation / recovery
  redirect still works. Driven programmatically through the `auth` wrapper.
- **Sentry** (`@sentry/react`) — error monitoring, dynamically imported and off
  until `NEXT_PUBLIC_SENTRY_DSN` is set (no bundle cost when unconfigured).
- Google Fonts: Fraunces (display), DM Sans (body), Allura

Deploy target is **Netlify**. `netlify.toml` has `command = "npm ci && npm run next:build"`,
`publish = ".next"`, and the `@netlify/plugin-nextjs` plugin (which wires SSR/ISR +
the image CDN). The `netlify/functions/` directory is its own little project (own
`package.json`) that Netlify installs and bundles at deploy time. Locally,
`npm run next:dev` runs the dev server; `netlify dev` runs the built site +
functions + Identity together.

> **Env access:** browser-visible env reads go through `process.env.NEXT_PUBLIC_*`
> (e.g. `NEXT_PUBLIC_SENTRY_DSN`). The old Vite `import.meta.env.*` reads were all
> migrated out — don't reintroduce them.

### Source layout (`app/` + `src/`)

Routes are file-based under `app/`; everything else lives under `src/`. Exact paths
drift as the tree grows; use `rg`/`grep` to locate a component. High-level shape:

| Path | Contents |
| --- | --- |
| `app/layout.tsx` | Root layout — `<head>` metadata, fonts, Netlify Identity `next/script`, wraps children in `<Providers>` |
| `app/providers.tsx` | The single `"use client"` boundary — mounts `LanguageProvider` + `ToastProvider` + `SiteProvider`, calls `auth.init()`, DSN-gated Sentry init |
| `app/page.tsx`, `app/<segment>/page.tsx` | Thin route shells (incl. dynamic `app/shop/[category]/[product]`, `app/journal/[slug]`) that render the matching `src/routes/*Route.jsx`; export `metadata` / `generateMetadata` |
| `app/globals.css` | `@import`s `src/styles/index.css` (one stylesheet, see below) |
| `app/not-found.tsx`, `app/error.tsx` | Branded 404 + error boundary pages |
| `src/routes/*.jsx` | Client route components: `HomeRoute`, `ShopIndexRoute`, `CategoryRoute`, `ProductRoute`, `JournalRoute`, `CartRoute`, `CheckoutRoute`, `AccountRoute`, `AdminRoute`, `GalleryRoute` |
| `src/state/` | `SiteProvider.jsx` (cart + nav + auth state, the old `App.jsx` core) + `useSiteNav.js` (`next/navigation` wrapper) |
| `src/data/*.{js,ts}` | Pure data: `product.js` (live Armenian Alphabet Blanket), `customProducts.js` (bib), `catalog.js` (multi-category catalog incl. priced + unpriced placeholders), `config.js` (the dial board), `socialPlatforms.js`, `shippingCarriers.ts`, `journalPosts.js` |
| `src/lib/*.{js,ts}` | Non-React wrappers: `auth` (Netlify Identity), `db` (fetch wrapper around every Function), `analytics`, `errorReporting` (Sentry), `cartId` (`mapLegacyId`), `tracking` (`getTrackingUrl`), `galleryRotation`, `designUrl`, `seo` (`organizationJsonLd()` etc.) |
| `src/i18n/` | `LangContext.jsx` (+ `LanguageProvider`, `useT()`), `translations.js` (en / hy / hyw) |
| `src/images/photos.js` | `PHOTO_*` / `IMG_*` constants → `/img/*.jpg` paths |
| `src/components/` | Leaf + widget + domain components (see below) |
| `src/components/shop/` | The `/shop` hierarchy: `ShopIndexView` (4 category cards), `CategoryView` (one category's product grid), `ProductView` (resolves live vs placeholder), `ProductPlaceholderView` (coming-soon / commission template), `Breadcrumbs`, `HelpDecidingSection` |
| `src/styles/` | `index.css` with the `@tailwind` directives + the migrated custom CSS (animations, mega-menu, print styles, the mobile "Liquid Glass" nav) |

Notable components: `HomeView` (the brand-story home + the "Explore" cards),
`MobileBottomNav`, `MobileSearchView` (the search-orb panel), `ProductShowcase`
(live blanket PDP), `CustomProductCard` (bib customizer), `BlanketLayoutPreview`,
`CheckoutView`, `AdminView` + `AdminOrderRow`, `AccountView` + `OrderHistory` /
`OrderCard`, `JournalView`, `WaitlistModal`, `PolicyModal`, `AuthDrawer`,
`ChatAssistant`, `BackToTopButton`, `TextUsWidget`.

## The May 2026 redesign (what the UI looks like now)

The site was reworked into an Apple-Store-style experience. The pieces that most
often trip up code/tests written against the old UI:

- **Mobile is a bottom-nav app, not a drawer site.** Phones get a fixed
  bottom tab bar (For You / Products / Journal / Bag) plus a floating search orb,
  rendered with a real "Liquid Glass" refraction effect. The desktop top-nav still
  exists on `lg+`. The **cart drawer is desktop-only now** — on mobile the bag is a
  full page. (The e2e cart-drawer tests are skipped on the mobile Playwright project
  for this reason.)
- **Home is a brand surface, not a catalog.** `HomeView` leads with a hero +
  a "For You" block (mobile) + an **"Explore the rest"** card section. Each Explore
  card is a `<button aria-label="{title} — {blurb}">` that routes to a real page.
  Both the mobile carousel and desktop grid render the same cards; the off-viewport
  copy is `display:none`, so `getByRole` resolves to the single visible card. The
  cards (e.g. `"Shop — Blankets, bibs & towels"`, `"Our Story — Armenia → Cypress"`)
  are how you reach `/shop` and the promoted section pages from home.
- **Real `/shop` hierarchy.** `/shop` → `ShopIndexView` (4 category cards,
  `aria-label="Browse {Category}"`) → `/shop/<category>` → `CategoryView`
  (product cards, live = `aria-label="View {name}"`, placeholder =
  `aria-label="{name} — coming soon"`) → `/shop/<category>/<product>` →
  `ProductView` (live PDP or `ProductPlaceholderView`).
- **Promoted section pages.** Our Story, Workshop, FAQ, Contact, Shipping,
  Newsletter were promoted off the home page to their own routes (`/story`, etc.),
  each rendered under a big "‹ For You" back header (`aria-label="Back to the For You page"`).
  They're reached via the Explore cards on both viewports.
- **Narrative copy rewrite.** Several strings changed and are load-bearing for
  selectors: the home hero CTA is now **"See what Lusik makes"** (navigates to
  `/shop`, not the blanket PDP); the checkout heading is **"Almost in Lusik's hands"**
  (was "Almost there"); the journal back button is **"All posts"**.
- **Priced vs unpriced placeholders.** `ProductPlaceholderView` renders one of two
  CTA paths depending on the catalog entry's `priceFrom`:
  - **Priced** placeholder (`priceFrom` set, `status: "placeholder"`) → a
    **commission path**: primary CTA is a "Write Lusik to commission this"
    **mailto link** (role=link), a phone link, and an "Add me to the list"
    waitlist button. The price is shown. (The Full Alphabet Crib Blanket was
    the canonical example until it went **live** in June 2026.)
  - **Unpriced** placeholder (`priceFrom: null`) → a **waitlist path**: a disabled
    "Currently unavailable" bar + a "Write me when it's ready" **button**, with
    "Price coming soon."

## Backend — what's in this repo, and what's not

Unlike the previous Supabase-backed setup, everything server-side now lives in this repo under `netlify/`. Two external services remain:

1. **Netlify Identity** — provides auth (email + password, OAuth, password recovery, JWT issuance). Configured in the Netlify dashboard: Site → Identity → Enable. No credentials live in code; the widget reads the site URL from `window.location.origin`.
2. **Stripe** — payment processing. Required env vars (set in Netlify dashboard → Site → Environment): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. The Stripe webhook endpoint is `https://<site>.netlify.app/api/stripe-webhook` (the `/api/...` path is a redirect to `/.netlify/functions/stripe-webhook`, configured in `netlify.toml`).

### `netlify/` directory layout

```
netlify/
├── schema.sql                       # apply once: `netlify db query --file netlify/schema.sql`
└── functions/
    ├── package.json                 # function-only deps; Netlify CI runs `npm install`
    ├── _lib/
    │   ├── db.mjs                   # @netlify/neon sql tagged-template export
    │   ├── auth.mjs                 # requireUser + requireAdmin (Identity role check)
    │   ├── json.mjs                 # JSON response helper
    │   ├── email.mjs                # Resend wrapper + admin-order email composer
    │   └── trusted-products.mjs     # server-side product price map (Stripe handoff)
    ├── profile.mjs                  # GET/PUT /profile
    ├── addresses.mjs                # GET/POST/DEL /addresses
    ├── saved-cart.mjs               # GET/PUT /saved-cart
    ├── saved-designs.mjs            # GET/POST/DEL /saved-designs
    ├── orders.mjs                   # GET /orders
    ├── link-guest-order.mjs         # POST /link-guest-order
    ├── avatar.mjs                   # POST /avatar (write to Netlify Blobs)
    ├── avatar-get.mjs               # GET /avatar-get?key=... (public read)
    ├── admin-orders.mjs             # GET/PUT /admin-orders (admin role required)
    ├── admin-order-photo.mjs        # POST /admin-order-photo (finished-piece upload, admin)
    ├── order-photo-get.mjs          # GET /order-photo-get?key=... (signed-in customer or admin)
    ├── create-checkout-session.mjs  # POST /create-checkout-session (Stripe)
    └── stripe-webhook.mjs           # POST /api/stripe-webhook (Stripe → DB, fires admin email)
```

### Database — Netlify Database (Neon-backed Postgres)

- One database per Netlify site, provisioned by `netlify database init`. Connection string is injected as `NETLIFY_DATABASE_URL`; `@netlify/neon`'s `neon()` reads it implicitly.
- Tables: `profiles`, `addresses`, `saved_carts`, `orders`, `order_items` — defined in `netlify/schema.sql`.
- **No Row-Level Security.** Supabase used RLS as the authorization layer because the browser hit the DB directly. On the Netlify stack, every query runs inside a Function; the Function checks the Identity JWT and filters by `user_id` itself. Postgres just trusts the Function.

### File storage — Netlify Blobs

- Avatars: store `profile-photos` (key pattern `<user_id>/avatar-<timestamp>.<ext>`), accessed via the `avatar` / `avatar-get` Functions.
- Pending carts: store `pending-orders` (key = Stripe session ID). `create-checkout-session` stashes the cart here; `stripe-webhook` reads + deletes it when the payment completes.
- Finished-piece photos: store `order-finished-photos` (key pattern `<order_id>/finished-<timestamp>.<ext>`). Lusik uploads via the admin view → `admin-order-photo`. The order row's `finished_photo_key` column points at the most recent upload; the customer's account page renders it via `order-photo-get`.

### Order notification emails (Resend)

The site sends up to six transactional emails across the order lifecycle, all through [Resend](https://resend.com) on the free tier (100/day, 3,000/month). Each fires with error isolation so a Resend outage never breaks the underlying database write — the email helpers log + return false on failure rather than throwing, and the calling code wraps them in `.catch()`.

1. **Admin notification** (`sendAdminOrderEmail`) — at order placement, from `stripe-webhook`: items + design metadata for stitching, shipping address, gift/social-consent info, admin-panel link.
2. **Customer confirmation** (`sendCustomerOrderConfirmation`) — at order placement: warm, on-brand "Lusik is starting on your order" with expectations and order summary. Intentionally NOT a duplicate of Stripe's receipt.
3. **Finished-piece notification** (`sendFinishedPhotoNotification`) — first time Lusik uploads a finished photo (gated by `orders.finished_photo_emailed_at`). CTA links to the account page; the photo is gated behind the order's user_id, not embedded.
4. **Shipped notification** (`sendShippedNotification`) — first time an order flips to `shipped` (gated by `orders.shipped_at`): carrier, monospace tracking number, Track-package CTA.
5. **Refund notification** (`sendRefundNotification`) — on `charge.refunded` (full or partial). Looks up the order by `stripe_payment_intent`, updates status, stamps `refunded_cents`; cumulative-vs-stored comparison dedupes Stripe re-fires.
6. **Cart recovery** (`sendCartAbandonmentRecovery`) — on `checkout.session.expired` (~24h after an unpaid session). Reads the pending-orders Blob keyed by `session.id`, sends, then deletes the blob so a re-fire can't double-send.

**Stripe dashboard subscription requirement**: subscribe to all three of `checkout.session.completed`, `charge.refunded`, AND `checkout.session.expired`. Without the third, abandoned carts get no recovery email.

Required env vars (Netlify → Site → Environment): `RESEND_API_KEY`, `ADMIN_NOTIFICATION_EMAIL`, and optionally `RESEND_FROM_EMAIL` (defaults to `Lusik & Sons <onboarding@resend.dev>` if unset — verify `lusikandsons.com` in Resend → Domains for a real `from`). The composers live in `netlify/functions/_lib/email.mjs`; shared `PALETTE`, `baseUrl()`, `esc`, `dollars`, `summarizeItem` helpers are reused across them.

### Lusik's Journal

A mini-blog (`/journal` list, `/journal/<slug>` posts) with starter posts about Armenian craft heritage (the alphabet, cross-stitch, the pomegranate). The posts are *cultural*, not biographical.

- Post data lives in `src/data/journalPosts.js`. Each entry has `slug`, `title`, `excerpt`, `publishedAt`, `readMinutes`, and a `content` array of typed nodes (`p`, `h2`, `blockquote`). A `prenext:build`/`gen:journal` step compiles it into `src/data/journalPostsData.js` (the search index); `npm run gen:sitemap` regenerates `public/sitemap.xml` from the same data. Adding a post = prepending an entry, then running `npm run gen:sitemap`. **Don't change a slug** once a post is shared.
- Components: `JournalListView`, `JournalPostView` (inline `BlogPosting` JSON-LD), `JournalView`; the route shell is `src/routes/JournalRoute.jsx` behind `app/journal/page.tsx` + `app/journal/[slug]/page.tsx`.
- Routing: file-based Next routes (`/journal`, `/journal/[slug]`) — the custom SPA router and legacy `#journal/<slug>` hash handling are gone.
- Per-route `<title>` + canonical come from each page's `metadata`/`generateMetadata`, so every post indexes as its own page.
- Posts carry `TODO_LUSIK_REVIEW` markers — Lusik should read each one.

### PWA (Add to Home Screen) + print styles

- `manifest.webmanifest` (served from `/public/`) declares brand name, theme colors (`#1A1612` ink, `#F5EFE3` cream), `standalone` display, icon paths. iOS Safari meta tags + a `theme-color` meta sit in `app/layout.tsx`'s `<head>`.
- **Icon set now shipped** (placeholder art, fine to replace with final brand assets): `/favicon.ico`, `/apple-touch-icon.png` (180×180), `/icon-192.png`, `/icon-512.png`, `/icon-maskable-512.png` — all under `/public/`, referenced by the manifest and linked from the layout.
- Print styles live in the main stylesheet (`@media print`): hide fixed UI, grayscale photos, append `(URL)` after external links, `page-break-inside: avoid` on `article`/`section`/order cards.

### Analytics + ad pixels (consent-gated)

Two distinct layers, both fed by the `track()` wrapper in `src/lib/analytics.js`:

1. **Umami (privacy-first, opt-in, default OFF).** Set `CONFIG.ANALYTICS.UMAMI_WEBSITE_ID` (in `src/data/config.js`) to enable; when off, Umami calls are no-ops. Tracks pageviews (incl. SPA navigation) and custom events: `add-to-cart`, `checkout-start`, `order-complete`, `save-design`, `share-design`, `waitlist-signup`, `newsletter-signup`.
2. **Ad pixels (LIVE since June 2026): Meta Pixel + Google Ads gtag.** IDs in `CONFIG.ANALYTICS.META_PIXEL_ID` / `GOOGLE_ADS_ID`; tags injected from `app/providers.tsx`; `track()` forwards mapped funnel events (AddToCart / InitiateCheckout / Purchase / Lead) to `fbq`. **Both sit behind the CPRA do-not-share opt-out in `src/lib/adConsent.ts`**: a stored opt-out (`lusik_ads_optout_v1`) or a Global Privacy Control browser signal prevents injection and event forwarding. The opt-out UI is the switch inside the Privacy Policy's "Advertising pixels" section (`PolicyModal.jsx`, `widget: "adsOptOut"`), reachable via the footer's "Your privacy choices" link (`openPolicy("privacyChoices")` deep-links to it). **If you add/remove an ad tag, update the Privacy Policy section in the same change — the policy describing reality is the deal.**

### SEO infrastructure

- `sitemap.xml` (served from `/public/`) lists the home page, journal index, and every journal post with `<lastmod>` — update it when adding a post. A `<url>` for each `/shop/...` page exists too.
- `robots.txt` (served from `/public/`) allows everything except `/.netlify/` and points at the sitemap.

### Two admin surfaces — `/admin` vs `/studio` (don't confuse them)

There are **two separate private surfaces**, on **distinct paths** so they don't collide:

- **`/admin` = the order dashboard.** A Next.js route (`app/admin/page.tsx` → `AdminRoute` → `AdminView`). Where Lusik manages orders/fulfillment. Client-gated by `isAdmin`; its data comes from `admin-*` Functions that enforce `requireAdmin`.
- **`/studio` = the Content Studio (Decap CMS).** A static SPA in `public/studio/` (`index.html` + `config.yml`), Git-Gateway backed, for editing content (journal today; products later). It gets a **looser, scoped CSP** in `netlify.toml` (`for = "/studio/*"`) because Decap loads from unpkg + commits via GitHub.

> History: the Decap CMS used to live at `public/admin/`, which **collided** with the Next `/admin` route (the route shadowed the static CMS). PR #1 of the CMS handoff moved it to `/studio/`. **Keep them separate.**

### Admin view + roles

Lusik manages orders through `view === "admin"`, gated three ways:

1. **Browser**: the nav link only renders when `auth.isAdmin()` is true.
2. **Function**: every admin endpoint calls `requireAdmin(context)` from `_lib/auth.mjs` (checks the Identity JWT's `app_metadata.roles` for `"admin"`), with an `ADMIN_EMAILS` env-var fallback for fresh deploys.
3. **Database**: nothing — the DB trusts the Function.

Granting admin: Netlify → Site → Identity → Users → Edit role → add `admin` → Save; the user signs out + back in so the role lands on the JWT. From admin, Lusik can change `fulfillment_status`, set `carrier`/`tracking_number`/`estimated_ship_date`, write `admin_notes`, upload a finished-piece photo, and run the waitlist Notify panel + CSV export.

### Stripe checkout flow

```
Browser ─POST cart──▶ /create-checkout-session ─┬─▶ stashes cart in `pending-orders` Blob (key = session.id)
                                                └─▶ Stripe Checkout (returns session.url)

Browser ◀─redirect── Stripe (customer pays)

Stripe ─webhook──▶ /api/stripe-webhook ─┬─▶ verifies signature
                                        ├─▶ reads pending cart from Blob
                                        ├─▶ inserts orders + order_items
                                        └─▶ deletes the Blob
```

Cart-ID shape is load-bearing: `mapLegacyId()` (in `src/lib/cartId.ts`, used by `CheckoutView`) translates browser cart IDs into `productKey` strings, and the same keys are the lookup into `_lib/trusted-products.mjs`. Change the cart-ID shape on the browser side and you must update both. The e2e test `Pay with Stripe POSTs to create-checkout-session` is the safety net — it asserts every cart item's `productKey` matches the shape `TRUSTED_PRODUCTS` recognizes.

## Conventions

- **`CONFIG` is the dial board.** Tunable numbers, feature flags, the text-us phone, upload caps — change them in `src/data/config.js`, not inline at call sites. Don't split `CONFIG`.
- **`auth` and `db` are the only access paths.** Every authenticated server call goes through one of these (`src/lib/`). Don't reach for `window.netlifyIdentity` directly; don't `fetch()` Functions ad-hoc — add a method to `db`.
- **Functions enforce authorization.** Inside a Function, call `requireUser(context)` and filter every query by `user.id`. There's no RLS.
- **Server-side trusted prices.** `_lib/trusted-products.mjs` is the only place pricing is trusted for checkout. The browser may send anything; Stripe gets what this file says.
- **i18n via `t("key.path")`.** Strings live in `TRANSLATIONS.en|hy|hyw` (`src/i18n/translations.js`). Missing keys fall back to English. `hy` is the only non-English language surfaced; `hyw` is staged for review.
- **TODO markers are intentional and addressed to Lusik, not Claude.** `⚠️ TODO_LUSIK` (needs photos/pricing/product confirmation) and `⚠️ TODO_LUSIK_REVIEW` (auto-translated strings awaiting a native speaker). Do not silently "fix" these.
- **Placeholder products are real.** Anything in `CATALOG` with `status: "placeholder"` renders a coming-soon card (commission path if priced, waitlist if unpriced). Don't promote one to `"live"` without the photos, price, copy, **and** the matching `_lib/trusted-products.mjs` row.
- **`CONFIG.ROTATED_GALLERY_INDEXES`** is a CSS-rotation band-aid for sideways source images; remove an index once its image is re-uploaded correctly.
- **Reduced-motion is honored.** Decorative animations (heart-burst, cart pulse) check `prefers-reduced-motion`. Match this for any new animation.
- **Cart IDs encode the variant.** A blanket cart row's `id` looks like `blanket-{alphabet}-{layout}-{blockDMC}-{letterDMC}[-multi-{dmcs}]`. Two orders with different colors stay separate line items, not qty=2. The trusted-products map keys off the layout suffix.

## Local development

- `npm ci` once. Then `npm run next:dev` (Next dev server) for fast iteration, or `netlify dev` to run the built site + Functions + Identity together (proxies `/.netlify/functions/*`).
- `npm run next:build` produces `.next/`. `npm run next:start` serves that production build — this is what the e2e tests run against. (`next:build`/`next:dev`/`typecheck` all run a `pre*` hook that regenerates the journal data first.)

### Test suite

Two layers, both run by `npm test`, and CI runs both on every push and PR (`.github/workflows/test.yml`, the **Tests** workflow):

1. **Unit tests** (`netlify/functions/_lib/__tests__/*.test.mjs`) — Node's built-in test runner, no extra install. Covers the security-critical helpers: `requireUser`/`requireAdmin` + `ADMIN_EMAILS` fallback, the HMAC token roundtrip, the `TRUSTED_PRODUCTS` price-map shape. `npm run test:unit`.

2. **E2E smoke tests** (`tests/e2e/*.spec.mjs`) — Playwright headless Chromium against a production Next build of the site, configured in `playwright.config.mjs` with **two projects**: `desktop-chromium` and `mobile-chromium` (Pixel 5, so `isMobile` is true). The `webServer` block runs `npm run next:build && npx next start --port 4173`. Backend calls are stubbed via `page.route()`. `npm run test:e2e` (first time: `npm run test:install`).

   The suite is written against the post-redesign UI (PR #147): it routes home→shop and home→story through the **Explore cards** (which render on both viewports), asserts the **"Almost in Lusik's hands"** checkout heading, asserts the priced-placeholder **"Write Lusik to commission this"** link, and **skips the cart-drawer tests on `mobile-chromium`** (the drawer is desktop-only). When the UI copy or nav changes again, these selectors are the first thing to update.

### One-time Netlify setup (fresh site)

1. Connect the GitHub repo to a Netlify site.
2. Site → Identity → Enable (decide email-confirmation policy).
3. From a local checkout: `netlify link`, then `netlify database init`.
4. Apply schema: `netlify db query --file netlify/schema.sql`.
5. Set env vars in Site → Environment: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
6. In Stripe, add a webhook at `https://<site>.netlify.app/api/stripe-webhook`. Subscribe to **all three** of `checkout.session.completed`, `charge.refunded`, `checkout.session.expired`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
7. (Recommended) Sign up at resend.com, set `RESEND_API_KEY` + `ADMIN_NOTIFICATION_EMAIL` (optionally verify the domain + set `RESEND_FROM_EMAIL`).
8. Set `REMINDER_SECRET` to a long random string (HMAC key for gift-reminder unsubscribe URLs — **required**, no fallback).
9. (Recommended) Set `SCHEDULED_FN_SECRET` (≥16 chars) to allow manual triggering of the scheduled functions (`cleanup-blobs`, `gift-reminder`); without it, only Netlify's scheduler can invoke them.

## Features beyond the core architecture

A condensed list of things wired up that aren't obvious from the architecture overview.

### Gift-occasion reminder (opt-in, one-year-later email)
- Checkbox at checkout (default off) → `orders.gift_reminder_opt_in`.
- `netlify/functions/gift-reminder.mjs` — scheduled function (daily 09:00 UTC). Finds ~11-month-old opted-in orders, claims each atomically (`UPDATE … SET sent_at = now() WHERE … AND sent_at IS NULL RETURNING id`), sends via Resend.
- `netlify/functions/unsubscribe-gift-reminder.mjs` — HMAC-signed unsubscribe URL, verified with `timingSafeEqual`, no sign-in needed.

### Product waitlist (placeholder catalog → real notification)
- `waitlist.mjs` — public POST, IP-keyed daily rate limit (20/day), strict `productKey` regex, upserts into `product_waitlist`.
- `admin-waitlist.mjs` — admin GET, per-product pending + notified **counts only** (no email addresses).
- `admin-waitlist-notify.mjs` — admin POST, sends `sendWaitlistAvailableEmail` to entries with `notified_at IS NULL`, capped at 100/call.
- `WaitlistsPanel` at the top of `AdminView`.

### Cart UX
- `SwipeableRow` — touch gesture machine for left-swipe-to-delete on cart rows (honors `prefers-reduced-motion`, handles `touchcancel` + multi-touch; tunables in `CONFIG.SWIPE`).
- Cart drawer (desktop) also has swipe-right-to-dismiss, X button, backdrop click, and Escape.
- Cart `-` on `qty === 1` routes to `removeFromCart` (with undo toast).
- **Cart persistence (June 2026).** The cart mirrors to localStorage (`lusik_cart_v1`, 30-day TTL, shape-validated on read) for everyone, and signed-in users get a debounced PUT to the `saved-cart` Function (which previously existed but was never called). The `/?order=success` return from Stripe explicitly clears both copies — before persistence, the full-page redirect resetting React state was the only thing "emptying" the bag post-purchase. All of it lives in `src/state/SiteProvider.jsx`.

### Security additions
- `link-guest-order.mjs` requires `email_verified === true` before claiming guest orders by email.
- `create-checkout-session.mjs` derives `userId`/`customerEmail` from the JWT (never the body) and validates `gift` + `social_consent` shapes.
- `avatar.mjs` keys blobs with a `<user_id>/avatar-<ts>-<nonce>.<ext>` (8-byte hex nonce).
- `avatar-get.mjs` + `order-photo-get.mjs` UUID-shape-gate keys before any blob lookup and set `X-Content-Type-Options: nosniff`.

## Migration history — Vite SPA → Next.js, both COMPLETE

The frontend has been through two completed migrations, in order:

1. **Single-file SPA → Vite + `src/` tree** — done long ago.
2. **Vite → Next.js (App Router)** — **done and flipped to production.**
   `netlify.toml` now builds with `command = "npm ci && npm run next:build"`,
   `publish = ".next"`, and `@netlify/plugin-nextjs`. Vite is fully retired
   (no `vite.config`, no `dist/`, no `src/main.jsx`, no `src/App.jsx`); routing
   moved from the custom history-API router inside `App.jsx` to file-based `app/`
   routes + `next/navigation` (the cart/nav/auth state that lived in `App.jsx`
   now lives in `src/state/SiteProvider.jsx`). The phase-by-phase log lives in
   **`NEXTJS_MIGRATION_PLAN.md`**.

A few **durable invariants** survived both migrations and still bite if ignored:

- **Photos live in `/public/img/`**, referenced as URL strings (`<img src={...}>`).
  The `CONFIG.ROTATED_GALLERY_INDEXES` rotation band-aid is unchanged.
- **Dynamic Tailwind class names** must be statically visible to PostCSS, or
  safelisted, or refactored to inline `style={{}}` (preferred for arbitrary hex
  values like DMC palette colors).
- **The cart-ID shape is load-bearing for Stripe** — `mapLegacyId` must match
  `_lib/trusted-products.mjs`; the smoke test is the safety net.
- **`netlify-identity-widget` stays loaded from `identity.netlify.com`** (via
  `next/script` `lazyOnload`) — do NOT switch to the npm package.
- **`netlify/functions/` was never touched by either migration** and keeps its own
  `package.json`. Don't merge it with the root one.
- **Browser env reads go through `process.env.NEXT_PUBLIC_*`**, not
  `import.meta.env.*` (which is undefined under Next).

## TypeScript migration (in progress, gradual)

The repo has a `tsconfig.json` and `npm run typecheck`. New code should be `.ts` / `.tsx`. Existing `.js` / `.jsx` coexist (`allowJs: true, checkJs: false`).

Already migrated (foundation layer): `src/data/languages.ts`, `src/data/shippingCarriers.ts`, `src/data/socialConsentPlatforms.ts`, `src/lib/cartId.ts`, `src/lib/tracking.ts`, `src/lib/galleryRotation.ts`, `src/lib/designUrl.ts`.

Recommended continuation order: remaining data modules → `auth`/`db` (define `User`/`Order`/`Profile`/… interfaces) → `analytics`/`errorReporting` → `translations` (dotted-path key union) → `icons` → leaf components → widget components → domain components → `src/routes/*` + `src/state/*` → flip `checkJs: true`. Each file is independent; run `npm run typecheck` after each. If a type mismatch surfaces a real bug, fix it — don't widen to `any`.

## Working in this repo

- Branch protection on `main` requires a PR with an approving review and passing
  **Tests** + **Lighthouse** checks — commit via a branch + PR, don't push to `main`.
- Remote: `origin` → `baghb004-cpu/Lusik-and-sons-` (GitHub).
- This file is the primary ambient guidance. There is no README; if you add one,
  keep it short and point at this file for depth.
