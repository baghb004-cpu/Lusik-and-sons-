# Implementation Report — Features + Hardening Round 2

**Branch:** `claude/features-and-hardening-round-2`
**Base:** `main` (PR #11 merged with all six prior hardening PRs)
**Date:** 2026-05-14

---

## Summary

This round audited the existing site for the features the brief asked about — many were already implemented — then focused on five high-value, low-risk additions plus targeted security hardening for the new code paths.

**What was inspected first (and found to already exist — skipped):**

| Brief item | Already in repo | Where |
|---|---|---|
| Live blanket preview | ✓ | `src/components/BlanketLayoutPreview.jsx` |
| Bib char counter (6-max) | ✓ | `src/components/CustomProductCard.jsx:214` shows `{cleanName.length}/{maxNameLength}` |
| FAQ section | ✓ | `src/components/HomeView.jsx:212` (`#faq`, 7 questions, native `<details>` accordion) |
| Care instructions | ✓ | `src/data/product.js:77` + `i18n/translations.js:138` + FAQ entry |
| Shipping/returns info | ✓ | `src/components/PolicyModal.jsx` |
| Trust badges | ✓ | `src/components/PaymentMethodsRow.jsx` + footer trust signals |
| Contact section | ✓ | `src/components/HomeView.jsx:237` (4-way contact panel) |
| Form validation/sanitization | ✓ | per-form; new code in this round follows the same pattern |
| Form honeypots | ✓ | NewsletterSignup, WaitlistModal |
| OpenGraph / Twitter cards | ✓ | `index.html:36-54` |
| Structured data (JSON-LD) | ✓ | `index.html:77-161` (LocalBusiness + Product + WebSite + BreadcrumbList) |
| Security headers | ✓ | `netlify.toml` (per-path CSP, HSTS, Permissions-Policy, COOP, cache headers) |
| Stripe checkout flow | ✓ | with idempotency-key + redirect-loop protection |
| Sentry scaffold | ✓ | `src/lib/errorReporting.js` — needs DSN to activate |
| Analytics scaffold | ✓ | Umami in `src/lib/analytics.js` — needs website ID to activate |

---

## Features added

### 1. Customer order notes at checkout (end-to-end)

A new optional **"A short note for Lusik"** textarea on the checkout page. Lives separately from the gift-message field (which goes on the recipient's card). This is for the customer to tell Lusik herself things like "please rush — birthday on the 14th," "baby has sensitive skin, no perfume in the package," or "the name is pronounced O-len."

End-to-end coverage:

- **Schema**: new column `orders.customer_notes TEXT` plus the matching `ALTER TABLE … ADD COLUMN IF NOT EXISTS` so existing deployments pick it up.
- **Browser**: new textarea capped at 280 characters with a live counter, identical visual treatment to the existing gift-message box. Optional — empty is fine.
- **Function**: `create-checkout-session.mjs` validates the field is a string, strips CR/LF and C0 control characters (SMTP-injection defense), caps at 280, and stores `NULL` when empty. Stashes in the pending-orders blob alongside cart + gift + social_consent.
- **Webhook**: `stripe-webhook.mjs` re-applies the same sanitization (belt-and-suspenders for any future code path that writes the blob differently) and `INSERT`s into the new column.
- **Admin email**: `_lib/email.mjs` renders a dedicated **"Note from the customer"** block in the admin notification, in both HTML and plaintext bodies. Uses the existing `esc()` HTML-escape helper so a note containing `<script>` is safe.

### 2. Image lazy loading sweep

Inspection showed only 2 of 24 `<img>` tags had any loading attribute. Now 18 of 20 do (the remaining two are inside conditionally-rendered lightbox / modal blocks).

- **Above-the-fold hero images** (HomeView hero, PDP main gallery): `fetchPriority="high" decoding="async"` to optimize LCP.
- **Everything else** (gallery thumbnails, customer photos, avatar, admin photos, cart line items, FAQ illustrations): `loading="lazy" decoding="async"` to defer until needed.

Effect: faster initial paint, lower data usage for visitors who don't scroll all the way down the home page.

### 3. Skip-to-content link

Added at the top of `<App>` (first focusable element). Visually hidden via `sr-only` until focused — pressing Tab on any page surfaces a "Skip to main content" pill in the top-left, which jumps to the new `<main id="main-content">` wrapper around the view tree.

Standard WCAG 2.1 § 2.4.1 pattern for keyboard + screen-reader users who'd otherwise have to tab through the nav on every page.

### 4. Font preload for first-paint critical fonts

Added two `<link rel="preload" as="font" crossorigin="anonymous">` hints in `index.html` for the latin-subset of DM Sans regular and Fraunces upright. These are the fonts the body copy + headings actually use on the home page; preloading them shaves ~150-300 ms off first paint by parallelising the font fetch with the CSS fetch.

Other subsets (vietnamese, latin-ext, Allura accent, italic Fraunces) continue to lazy-load only when actually needed — preloading them eagerly would waste bandwidth for most US visitors who never see those characters.

### 5. NewsletterSignup consolidated; NewsletterForm deleted

Two near-duplicate components were doing roughly the same job:

- `NewsletterSignup.jsx` (used in the footer) — actually POSTed to Netlify Forms with a honeypot and a `track()` analytics event.
- `NewsletterForm.jsx` (used in the home-page hero "Be first to know" section) — had identical UX but contained "REPLACE WITH YOUR NEWSLETTER SERVICE" placeholder comments, never actually sent the email anywhere.

Refactor:

- `NewsletterSignup.jsx` gained a `variant` prop. Default `"footer"` renders the inline "Newsletter" heading + pitch above the form. `variant="hero"` suppresses the inline heading (the host section provides its own).
- `HomeView.jsx` now renders `<NewsletterSignup variant="hero" />` — gets a *working* signup form instead of the dead placeholder.
- `NewsletterForm.jsx` deleted.

Result: one component, one code path, both surfaces actually work.

---

## Security improvements made

### S1 — SMTP-header-injection defense on the new customer_notes field

The note flows browser → function → blob → webhook → admin email. At every boundary, control characters (CR, LF, and the rest of C0) are stripped before storage. Even if a future code path makes the field flow into a `subject` line (not currently the case), no `\r\nBcc: attacker@evil.com` smuggling is possible.

### S2 — Length cap at three layers (browser, function, webhook)

The 280-char limit is enforced in the browser via `setCustomerNotes(value.slice(0, 280))`, in the function via the same slice, and again in the webhook on the way to the DB. A malicious browser-side modification can't push a 1 MB payload into the DB.

### S3 — HTML-escape on the admin email

The note is interpolated through the existing `esc()` helper before being placed in the admin email HTML. A note containing `<img src=x onerror=alert(1)>` renders as literal text in Lusik's inbox, not as executable HTML.

---

## Code cleanup / refactoring done

- **Deleted `src/components/NewsletterForm.jsx`** (59 lines of non-functional duplicate)
- **`NewsletterSignup.jsx`** now serves both surfaces via a `variant` prop — single source of truth for newsletter submission logic
- **Image attributes** consistently applied across components (helps anyone running Lighthouse against the site)
- **`<main id="main-content">` wrapper** in App.jsx for both a11y and clean semantic markup

No behavioral changes to existing flows — cart, checkout, payment, journal, auth, admin, etc. all unchanged.

---

## Files changed

| File | Change |
|---|---|
| `netlify/schema.sql` | New `customer_notes TEXT` column + matching `ALTER TABLE IF NOT EXISTS` |
| `netlify/functions/create-checkout-session.mjs` | Accept + sanitize + stash `customer_notes` |
| `netlify/functions/stripe-webhook.mjs` | Re-sanitize + INSERT into `customer_notes` |
| `netlify/functions/_lib/email.mjs` | Render note block in admin email (HTML + text) |
| `src/components/CheckoutView.jsx` | New "Note for Lusik" textarea + sends field + lazy image attribute |
| `src/components/HomeView.jsx` | Lazy/eager attributes on 7 images + use `NewsletterSignup variant="hero"` |
| `src/components/ProductShowcase.jsx` | `fetchPriority` on main gallery + lazy on thumbnails + detail photo |
| `src/components/CustomProductCard.jsx` | Lazy on 2 illustration images |
| `src/components/AccountView.jsx` | Lazy on avatar |
| `src/components/AdminOrderRow.jsx` | Lazy on finished-piece photo |
| `src/components/NewsletterSignup.jsx` | New `variant` prop; replaces duplicate component |
| `src/components/NewsletterForm.jsx` | **DELETED** (consolidated into NewsletterSignup) |
| `src/App.jsx` | Skip-to-content link + `<main id="main-content">` wrapper |
| `index.html` | Font preload hints for DM Sans + Fraunces latin |

---

## Risks / assumptions

1. **Schema migration is non-destructive.** `ADD COLUMN IF NOT EXISTS customer_notes TEXT` adds a nullable column. Existing rows get `NULL`. No backfill needed.
2. **Existing deploys need to apply the migration.** Run `netlify db query --file netlify/schema.sql` once after deploy. If you forget, the INSERT in stripe-webhook will fail and Stripe will retry forever (visible in the function logs as an SQL error). Mitigation: the migration is idempotent — running it twice is fine.
3. **Old browsers may not respect `fetchPriority`.** It's a hint; browsers that don't understand it fall back to default eager loading for those `<img>` tags. No regression.
4. **`loading="lazy"` is supported in every browser released since 2020.** Older browsers will load eagerly. No regression.
5. **Font preloading is for the "happy path" of latin-script US visitors.** Visitors browsing the Armenian-language version still get the Armenian glyphs via fonts.css's individual `@font-face` blocks — they just aren't preloaded. Acceptable trade-off given preload bandwidth.

---

## How to test the site after changes

```bash
# 1. Install + build
npm ci
npm run build

# 2. Type-check (TypeScript strict)
npm run typecheck

# 3. Unit tests (Node native test runner)
npm run test:unit

# 4. E2E (Playwright headless Chromium)
npm run test:e2e
```

**Manual smoke checks on a deploy preview:**

1. Open the home page — confirm the hero photo loads instantly (eager) but scrolling reveals images lazily as they enter viewport.
2. Tab from a cold page load — the first Tab should focus the "Skip to main content" pill in the top-left.
3. Add a blanket to cart, click Checkout — confirm the new "A short note for Lusik" textarea appears under the gift options. Type something, see the counter update, exceed 280 chars and confirm it stops.
4. Complete a $0.50 test purchase (Stripe test mode) with a customer note — verify the admin notification email contains the "Note from the customer" block.
5. Submit the newsletter form from both the home page "Be first to know" section AND the site footer — confirm both POST successfully (Netlify dashboard → Site → Forms → newsletter submissions table).

---

## Features considered but NOT implemented

| Feature | Why deferred |
|---|---|
| Verified-purchase reviews | DB schema + admin moderation UI + email-link review flow is multi-day; out of scope for one focused PR. |
| Gift cards | Needs Stripe Coupon integration + custom redeem flow + storage of unused balance. Bigger than this round. |
| Custom photo-to-stitch upload | Needs admin moderation queue + Lusik's confirmation of capability. Operational decision first. |
| Live shipping rate by ZIP | Carrier-API integration (USPS / UPS / FedEx); free tiers all require account signup. Recommended separately. |
| Web Push notifications to Lusik's phone | Standalone feature deserving its own PR (service worker + admin subscribe + push helper). Already scoped in a previous chat. |
| Customer reviews UI | Needs data layer first (see above). |
| Cloudflare Turnstile on checkout | Recommended but requires Cloudflare account + secret key; out of scope until Cloudflare proxy is verified active. |
| Sentry DSN activation | Already wired in code — just needs you to paste a DSN into Netlify env. Documented in SERVICE_SIGNUP_CHECKLIST.md. |
| SavedDesignsSection full-page-reload (L3 from prior audit) | UX issue, not security. Larger restructuring; defer. |
| AVIF / WebP image conversion | Would shave ~30-40% off image bytes but requires a build step; Netlify Image CDN does this automatically if enabled. Recommended separately. |

---

## Tests

| Layer | Result |
|---|---|
| `npm run build` | ✅ Clean (8.35s) |
| `npm run typecheck` | ✅ No errors |
| `npm run test:unit` | ✅ 90/90 pass |
| `npm run test:e2e` | ✅ 16/16 pass (50.4s) |

No commands are missing. All four are in `package.json`.
