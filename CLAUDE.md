# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page marketing + e-commerce site for **Lusik & Sons**, a Cypress, CA maker of hand cross-stitched Armenian alphabet baby blankets and related goods. The site is one file (`index.html`, ~7,100 lines) plus a small `netlify/` directory that holds the database schema and the serverless functions every backend interaction goes through.

## Architecture — the one thing to know

`index.html` is a self-contained SPA. Everything (React components, styles, product data, base64-encoded product photos) lives in this one file. The runtime stack is loaded from CDNs in `<head>`:

- **React 18** + **ReactDOM** (UMD builds)
- **Babel Standalone** — transpiles the single `<script type="text/babel" data-presets="env,react">` block at runtime, so JSX works without a bundler
- **Tailwind CDN** — utility classes via runtime JIT
- **`netlify-identity-widget`** — auth (signup, login, password reset, JWT issuance). The widget is loaded but not auto-rendered; we drive it programmatically through the `auth` wrapper inside `index.html`.
- Google Fonts: Fraunces (display), DM Sans (body), Allura

Deploy target is **Netlify**. The static `index.html` is the entire frontend — no build step on the SPA side. The `netlify/functions/` directory is its own little project (with its own `package.json`) that Netlify installs and bundles at deploy time. Locally, `netlify dev` runs the static site + functions + Identity together on one port.

### File layout inside `index.html`

Approximate line ranges drift as the file grows; use these as starting points, not gospel:

| Lines | Contents |
| --- | --- |
| 1–75 | `<head>`: meta tags, OpenGraph/Twitter cards, favicons, CDN script tags (React, Identity widget, Babel, Tailwind) |
| 76–479 | `<style>`: custom CSS (animations, mega-menu, back-to-top, text-us widget, tooltips) |
| ~485 | Loading splash + `<div id="root">` + image data placeholder script |
| ~507 | SVG icon components (`<Icon>` wrapper + per-icon definitions) |
| ~570 | `PHOTO_*` constants (mostly `/img/*.jpg` paths) |
| ~611 | `PRODUCT` — the live Armenian Alphabet Blanket: gallery, specs, thread colors (DMC palette), color presets (Boys/Girls/Unisex/Purple/Armenian Flag), alphabets, layouts |
| ~980 | `CATALOG` — multi-category catalog (blankets / bibs / towels / baby). Most items are `status: "placeholder"` pending Lusik's photos and pricing |
| ~1085 | `CONFIG` — all tunable values: function base path, upload caps, cart storage key, debounce timing, text-us phone, etc. |
| ~1160 | `SOCIAL_PLATFORMS` — tier1/tier2 social drawer entries |
| ~1190 | `SOCIAL_CONSENT_PLATFORMS` — opt-in checkout list (Instagram / TikTok / Facebook / YouTube) |
| ~1240 | `LANGUAGES`, `TRANSLATIONS` — i18n tables |
| ~1860 | `LangContext` + `LanguageProvider` + `useT()` |
| ~2210 | `auth` — Netlify Identity wrapper (signup, signin, signout, password reset, JWT) |
| ~2370 | `db`   — fetch() wrapper around every Netlify Function (profile, addresses, saved-cart, orders, etc.) |
| ~2480 | `BackToTopButton`, `TextUsWidget` (fixed-position UI) |
| ~2810 | `App` — root component, holds cart + view + auth state |
| ~3660 | `HeartBurst` — add-to-cart feedback animation |
| ~3710 | `PolicyModal` — Privacy / Terms / Refunds (intentionally English-only) |
| ~3920 | `AuthDrawer` — sign-in / sign-up |
| ~4160 | `AccountView`, `OrderHistory`, `OrderCard` |
| ~4640 | `HomeView`, `TrackingForm`, `NewsletterForm` |
| ~5030 | `CustomProductCard` — bibs / custom-image embroidery flow |
| ~5680 | `ProductTemplate`, `BlanketLayoutPreview` — SVG previews of the blanket layout |
| ~6065 | `ProductShowcase` — the main PDP for the Armenian Alphabet Blanket |
| ~6815 | `CheckoutView` — POSTs the cart to the `create-checkout-session` Function, redirects to Stripe |
| ~7080 | `ReactDOM.createRoot(...).render(<LanguageProvider><App/></LanguageProvider>)` |

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
    ├── profile.mjs                  # GET/PUT       /profile
    ├── addresses.mjs                # GET/POST/DEL  /addresses
    ├── saved-cart.mjs               # GET/PUT       /saved-cart
    ├── saved-designs.mjs            # GET/POST/DEL  /saved-designs
    ├── orders.mjs                   # GET           /orders
    ├── link-guest-order.mjs         # POST          /link-guest-order
    ├── avatar.mjs                   # POST          /avatar          (write to Netlify Blobs)
    ├── avatar-get.mjs               # GET           /avatar-get?key=...  (public read)
    ├── admin-orders.mjs             # GET/PUT       /admin-orders    (admin role required)
    ├── admin-order-photo.mjs        # POST          /admin-order-photo (finished-piece upload, admin)
    ├── order-photo-get.mjs          # GET           /order-photo-get?key=...  (signed-in customer or admin)
    ├── create-checkout-session.mjs  # POST          /create-checkout-session (Stripe)
    └── stripe-webhook.mjs           # POST          /api/stripe-webhook (Stripe → DB, fires admin email)
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

The site sends up to five transactional emails across the order lifecycle, all through [Resend](https://resend.com) on the free tier (100/day, 3,000/month). Each fires with error isolation so a Resend outage never breaks the underlying database write — the email helpers log + return false on failure rather than throwing, and the calling code wraps them in `.catch()`.

**At order placement** — the `stripe-webhook` Function fires two emails in parallel (`Promise.allSettled`) after the order row is inserted:

1. **Admin notification** to Lusik (`sendAdminOrderEmail`) — operational tone: items + full design metadata for stitching, shipping address, gift options if any, social-share consent + handles if any, link to the admin panel.
2. **Customer confirmation** (`sendCustomerOrderConfirmation`) — warm, on-brand tone: "Lusik is starting on your order," what to expect (5–10 business days, photo before ship, tracking on ship), order summary, gift recap if applicable, contact info for catching mistakes before stitching begins.

The customer confirmation is intentionally NOT a duplicate of Stripe's auto-generated receipt — Stripe handles the financial paperwork; ours handles brand experience + expectation setting.

**At finished-piece photo upload** — the `admin-order-photo` Function fires the third email the first time Lusik uploads a photo for an order:

3. **Finished-piece notification** (`sendFinishedPhotoNotification`) — "Lusik just finished your blanket," with a CTA linking to the customer's account page where the photo is rendered. Slightly different copy for gift orders ("the gift you ordered is ready") vs. self-purchases. We deliberately don't embed the photo in the email itself because access is gated behind the order's user_id — instead the customer signs in to see it.

The `orders.finished_photo_emailed_at` timestamp gates this. Re-uploads or replacements don't re-trigger the email.

**At ship time** — the `admin-orders` Function fires the fourth email the first time Lusik flips an order's `fulfillment_status` to `shipped`:

4. **Shipped notification** (`sendShippedNotification`) — "your order is on its way," with the carrier name, the tracking number rendered in monospace, a Track-package CTA linking to the carrier's public tracking page (USPS/UPS/FedEx URL patterns mirrored from the browser-side `getTrackingUrl`), a callout to the finished-piece photo if Lusik already uploaded one, and the 14-day "if anything's wrong" reassurance.

The `orders.shipped_at` timestamp gates this. Once it's set (the first save with status = shipped), it's never re-fired even if Lusik toggles status back and forth. Both timestamps (`shipped_at` and `finished_photo_emailed_at`) follow the same pattern: stamped in the same UPDATE as the change that triggers them, so the DB write and email send are atomic from the workflow's perspective.

**On refund** — the `stripe-webhook` Function handles `charge.refunded` events in addition to `checkout.session.completed`:

5. **Refund notification** (`sendRefundNotification`) — "We've refunded your order" (full) or "We've applied a partial refund" (partial). Includes order number, original total, refund amount, remaining balance for partial refunds, and the standard "5–10 business days for it to appear on your card" reassurance.

The handler looks up the order by `stripe_payment_intent` (captured at order insert), updates `orders.status` to `refunded` or `partially_refunded`, flips `fulfillment_status` to `refunded` only on a full refund (partial refunds let the customer still receive most of their order), and stamps `refunded_cents` with the cumulative refund total. The cumulative-vs-stored comparison gates dedupe — Stripe sometimes fires the event multiple times for the same refund.

**Stripe dashboard subscription requirement**: in the Stripe webhook configuration, both events need to be subscribed: `checkout.session.completed` AND `charge.refunded`. Without the second, the refund handling code never gets a chance to run.

Required env vars (set in Netlify dashboard → Site → Environment):

- `RESEND_API_KEY` — generate at resend.com/api-keys (free tier: 100 emails/day, 3,000/month; both emails count against this).
- `ADMIN_NOTIFICATION_EMAIL` — where to send the admin notifications (e.g. `hello@lusikandsons.com`).
- `RESEND_FROM_EMAIL` *(optional)* — sender address. Defaults to `Lusik & Sons <onboarding@resend.dev>` if unset, which works for testing but will land in spam. To use a real `from`, verify `lusikandsons.com` in Resend → Domains and set this to e.g. `Lusik & Sons <orders@lusikandsons.com>`. Especially important for the customer confirmation — a transactional email from `resend.dev` looks suspicious to non-technical customers.

The composers live in `netlify/functions/_lib/email.mjs`. Shared helpers (`esc`, `dollars`, `summarizeItem`) are reused between both. To extend (e.g. add a shipped-notification email when Lusik flips an order to `shipped`), add another exported function alongside the existing two and call it from wherever in the order pipeline you need.

### Lusik's Journal

A small in-file mini-blog at `view === "journal"`, with three starter posts about Armenian craft heritage (the alphabet, cross-stitch as a technique, the pomegranate in textiles). The posts are intentionally *cultural*, not biographical — they make claims about Armenian history that are well-attested rather than claims about Lusik personally that would need her sign-off.

- Post data: the `JOURNAL_POSTS` array near the SHIPPING_CARRIERS constant (~line 1455). Each entry has `slug`, `title`, `excerpt`, `publishedAt`, `readMinutes`, and a `content` array of typed nodes (`p`, `h2`, `blockquote`). Adding a new post = prepending an entry **AND** adding a `<url>` block to `sitemap.xml` at the repo root. **Don't change a slug** once a post is shared — old URLs would 404.
- Components: `JournalListView` (index), `JournalPostView` (single post with inline `BlogPosting` JSON-LD for Google), and the parent `JournalView` that swaps between them.
- Routing: real history-API URLs (`/journal` for the list, `/journal/<slug>` for a post). Netlify's `[[redirects]]` block in `netlify.toml` serves index.html for any `/journal*` path so direct visits and shared links work. Two effects in `App` keep the URL in sync with state both ways: on mount + popstate, pathname → state; on internal navigation, state → `pushState`. Legacy `#journal/<slug>` hash URLs from before the routing change get silently rewritten to clean pathnames on first load.
- Per-route `<title>` and `<link rel="canonical">` are set via DOM manipulation when `view` or `journalSlug` changes, so each journal post is indexed as its own page rather than being collapsed into the home page by a static canonical.
- All three posts carry the `TODO_LUSIK_REVIEW` marker — Lusik should read each one and tell us if anything needs adjusting. She can also send a personal anecdote for any of them, which we'd splice in as a section.

### PWA (Add to Home Screen) + print styles

The site is wired for both as of the polish pass:

- `manifest.webmanifest` at the repo root declares brand name, theme colors (`#1A1612` ink, `#F5EFE3` cream), display mode (`standalone`), and icon paths. Linked from `<head>` via `<link rel="manifest">`.
- iOS Safari meta tags (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`) sit alongside the manifest because Apple ignores `manifest.webmanifest` and uses its own legacy attributes.
- A `theme-color` meta tag sets the mobile browser address-bar to brand ink on Android Chrome.

**Icon files needed before launch** (referenced by both the manifest and the existing favicon tags — none of these exist in the repo yet, all flagged `TODO_LUSIK`):

- `/favicon.ico` (32×32 or multi-size)
- `/apple-touch-icon.png` (180×180 for iOS home screen)
- `/icon-192.png` (192×192 for Android)
- `/icon-512.png` (512×512 for Android splash + iOS large)
- `/icon-maskable-512.png` (512×512 with safe-zone padding for Android adaptive icons)

The PWA install still works without them — the browser falls back to a screenshot of the page as the icon — but the experience is much better with proper artwork.

Print styles live in the main `<style>` block (search for `@media print`). They:
- Hide all fixed-position UI (toasts, drawers, sticky nav, back-to-top, text-us widget, mobile bottom-nav)
- Convert photos to grayscale to save color toner
- Append `(URL)` after external links so paper copies stay useful
- Force `page-break-inside: avoid` on `article`, `section`, and order cards so a long page splits sensibly

### Analytics (privacy-first, opt-in)

The site is wired for [Umami](https://umami.is)-compatible analytics. Default is OFF — the script tag isn't loaded and no requests are made until `CONFIG.ANALYTICS.UMAMI_WEBSITE_ID` (~line 1370 in `index.html`) is set to a real ID.

To enable:

1. Sign up for an Umami Cloud free account (or self-host Umami, or pick a different privacy-first provider — anything that exposes a global `window.umami.track()` works).
2. Create a website in the dashboard for `lusikandsons.com`, copy the website ID.
3. Paste it into `CONFIG.ANALYTICS.UMAMI_WEBSITE_ID`. If you're not using Umami Cloud, also update `UMAMI_SRC_URL` to your script URL.
4. Deploy.

What gets tracked:

- **Pageviews**, including SPA navigation (the App fires `umami.track()` on every `view` or `journalSlug` change so journal posts and account/admin views show up as distinct pages).
- **Custom events** — wired at the call sites that signal real intent:
  - `add-to-cart` (with kind: "blanket"/"custom" and design variant info)
  - `checkout-start` (when Pay-with-Stripe is clicked, with item count + total cents)
  - `order-complete` (when Stripe redirects back with `?order=success`)
  - `save-design` (signed-in customer saves a configuration)
  - `share-design` (any share — native share sheet or clipboard)
  - `waitlist-signup` (per-product placeholder waitlist email submitted)
  - `newsletter-signup` (footer newsletter email submitted)

All custom events go through the module-level `track(eventName, data)` helper in `index.html`. When analytics is off, every `track()` call is a no-op and costs nothing.

The Privacy Policy's "Cookies and tracking" clause already acknowledges the optional analytics provider in honest terms ("if active, it doesn't set cookies, doesn't track you across other sites…") — so the disclosure is accurate whether analytics is on or off.

### SEO infrastructure

- `sitemap.xml` at the repo root lists the home page, the journal index, and every journal post with its `<lastmod>`. Update it when you add a new post — there's a comment at the top of the file walking through what to change.
- `robots.txt` at the repo root tells crawlers everything is allowed except the `/.netlify/` namespace, and points at the sitemap. Both files are static and served directly by Netlify with no special config needed (they live alongside `index.html` at the repo root).

### Admin view + roles

Lusik (and her sons) manage orders through a dedicated admin view: `view === "admin"` inside the React app. It's gated three ways:

1. **Browser**: the nav link only renders when `auth.isAdmin()` returns true.
2. **Function**: every admin endpoint calls `requireAdmin(context)` from `_lib/auth.mjs`, which checks the Identity JWT's `app_metadata.roles` for the string `"admin"`. There's also an env-var fallback: `ADMIN_EMAILS` (comma-separated) lets a brand-new deploy work before the role has been assigned in the Netlify dashboard.
3. **Database**: nothing — the DB just trusts the Function, same pattern as the customer endpoints.

Granting admin access (one-time per user):

1. Netlify dashboard → Site → Identity → Users → click the user → Edit role → add `admin` → Save.
2. The user signs out + signs back in (the role lands on the JWT on next login).
3. They see "Open admin panel →" at the bottom of their account view.

From the admin view, Lusik can: change `fulfillment_status`, set `carrier` + `tracking_number`, set `estimated_ship_date`, write internal `admin_notes`, and upload a finished-piece photo per order. The customer's order card on their account page picks up every change automatically — the stepped progress timeline, the tracking link, and the finished-piece photo all key off these fields.

### Stripe checkout flow

```
Browser  ─POST cart──▶  /create-checkout-session  ─┬─▶ stashes cart in `pending-orders` Blob (key = session.id)
                                                   └─▶ Stripe Checkout (returns session.url)

Browser ◀─redirect──   Stripe                       (customer pays)

Stripe   ─webhook──▶   /api/stripe-webhook  ─┬─▶ verifies signature
                                             ├─▶ reads pending cart from Blob
                                             ├─▶ inserts orders + order_items
                                             └─▶ deletes the Blob
```

Cart-ID shape is load-bearing for this flow: `mapLegacyId()` in `index.html` (search for it inside `CheckoutView`) translates browser cart IDs into `productKey` strings, and the same product keys are the lookup into `_lib/trusted-products.mjs`. If you change cart-ID shape on the browser side, update both.

## Conventions

- **One file, no build.** Resist the urge to split `index.html` into modules. Babel Standalone transpiles JSX in-browser; adding a bundler would defeat the deploy-by-uploading-one-file model. (The `netlify/functions/` directory IS bundled by Netlify CI — but that's separate from the SPA.)
- **`CONFIG` is the dial board.** Tunable numbers, feature flags, the text-us phone, upload caps, the limited-edition order count — change them in `CONFIG` (~line 1085), not inline at call sites.
- **`auth` and `db` are the only access paths.** Browser-side, every authenticated server call goes through one of these two objects in `index.html` (~line 2210). Don't reach for `window.netlifyIdentity` directly. Don't `fetch()` Functions ad-hoc; add a method to `db` and call it.
- **Functions enforce authorization.** Inside a Function, call `requireUser(context)` from `_lib/auth.mjs` and filter every query by the returned `user.id`. There's no RLS to save you if you forget.
- **Server-side trusted prices.** `_lib/trusted-products.mjs` is the only place pricing is trusted for checkout. The browser may send anything; Stripe gets what this file says.
- **i18n via `t("key.path")`.** Strings live in `TRANSLATIONS.en|hy|hyw`. Missing keys fall back to English automatically. Eastern Armenian (`hy`) is the only non-English language currently surfaced to users; `hyw` is staged for Lusik's review.
- **TODO markers are intentional and addressed to Lusik, not Claude.** Two flavors appear throughout:
  - `⚠️ TODO_LUSIK` — needs Lusik's photos, pricing, or product confirmation before going live
  - `⚠️ TODO_LUSIK_REVIEW` — auto-translated Armenian strings awaiting a native speaker's review
  Do not silently "fix" these; they are tracking real product/content gaps.
- **Placeholder products are real.** Anything in `CATALOG` with `status: "placeholder"` renders a coming-soon card. Don't promote one to `"live"` without the corresponding photos, price, and copy.
- **`CONFIG.ROTATED_GALLERY_INDEXES`** is a CSS-rotation band-aid for sideways source images. Once an image is re-uploaded correctly, remove its index from that Set; the rotation vanishes everywhere it was applied.
- **Reduced-motion is honored.** The heart-burst animation and cart pulse explicitly check `prefers-reduced-motion`. Match this pattern for any new decorative animation.
- **Cart IDs encode the variant.** A blanket cart row's `id` looks like `blanket-{alphabet}-{layout}-{blockDMC}-{letterDMC}[-multi-{dmcs}]`. Two orders with different colors must remain separate line items, not stack as qty=2. The trusted-products map keys off the layout suffix, so the format is load-bearing.

## Local development

- Install the Netlify CLI once: `npm install -g netlify-cli`. Then `netlify dev` runs the static `index.html` + Functions + Identity on a single port (default `http://localhost:8888`). Use that, not `python3 -m http.server` — the latter won't proxy `/.netlify/functions/*` calls.
- Hard-reload (Cmd/Ctrl-Shift-R) is usually necessary after edits because of the Babel transpile cache and Tailwind CDN behavior.
- There are no automated tests. Verify changes by clicking through: home → product → add to cart (with each preset) → cart drawer → checkout (Stripe hand-off can be observed but actual payment requires the real Stripe test keys configured in Netlify).
- Pre-launch checklist embedded near the top of `<head>` (OpenGraph block, lines 11–35) lists external assets that must exist at deploy time: `/og-image.jpg` (1200×630), `/favicon.ico`, `/apple-touch-icon.png`.

### One-time Netlify setup (when you spin up a fresh site)

1. Connect the GitHub repo to a Netlify site.
2. Site → Identity → Enable. Decide on email confirmation policy (default: required).
3. From a local checkout, `netlify link`, then `netlify database init` to provision the Postgres database.
4. Apply the schema: `netlify db query --file netlify/schema.sql`.
5. Set environment variables in Site → Environment: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
6. In the Stripe dashboard, add a webhook endpoint pointing at `https://<your-site>.netlify.app/api/stripe-webhook`. Subscribe to **both** `checkout.session.completed` and `charge.refunded` (so refunds you issue from the Stripe dashboard automatically update the order + email the customer). Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
7. (Optional but recommended) Sign up at [resend.com](https://resend.com) — free tier covers 100 emails/day. Generate an API key under "API Keys" and set it as `RESEND_API_KEY` in Netlify. Set `ADMIN_NOTIFICATION_EMAIL` to wherever Lusik wants to receive new-order notifications. (Optionally verify `lusikandsons.com` in Resend → Domains and set `RESEND_FROM_EMAIL` to `Lusik & Sons <orders@lusikandsons.com>`; until then, emails come from `onboarding@resend.dev` which often lands in spam.)

## Working in this repo

- Active development branch for documentation changes: `claude/add-claude-documentation-Vi3zH`.
- Remote: `origin` points at `baghb004-cpu/lusik-and-sons-` (GitHub).
- No README, no Cursor rules, no Copilot instructions exist — this file is the only ambient guidance.
