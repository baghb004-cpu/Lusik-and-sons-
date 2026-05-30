# Phase 8 — production cut-over runbook (Vite → Next.js)

**This is a DRAFT for Cowork / the owner to apply during the flip. Nothing here
touches `netlify.toml` on `main` — the live site still builds + serves the Vite
`dist/` until someone deliberately applies the change below and merges it.**

Phase 8 is the only phase that touches production. It must be done deliberately,
on a deploy preview first, with a real Stripe test, by a human with Netlify
access. This doc gives the exact `netlify.toml` to apply and the checklist
around it.

---

## 0. Pre-flip checklist (do these first)

- [ ] Merge the open migration PRs in order: **#159 (Phase 6) → #160 (Phase 7) → #161 (Phase 7.5)**.
- [ ] Confirm CI green on `main` after each merge (Tests + Lighthouse).
- [ ] Decide the small deferred items (optional, not blockers): the Connect
      *drawer* (currently the nav "Connect" link points to `/contact`) and the
      placeholder-PDP waitlist-modal trigger.
- [ ] Have Netlify dashboard access + the Stripe test card ready.

---

## 1. Open a flip PR (do NOT push straight to main)

On a branch, replace `netlify.toml` with the version in §2, then push and open a
PR. Netlify builds a **deploy preview** of the Next runtime from that PR — this
is where all verification happens. Production keeps serving Vite from `main`
until this PR merges.

---

## 2. The `netlify.toml` to apply

> Replaces the current Vite config. Key changes are called out in §3.

```toml
# ============================================================
# Lusik & Sons — Netlify project config (Next.js runtime)
# ============================================================

[build]
  # Next build. prenext:build regenerates the journal data first (see
  # package.json). The Netlify Next.js Runtime publishes the build output and
  # wires SSR/ISR + the image CDN itself — do NOT set `publish` by hand.
  command = "npm ci && npm run next:build"

# Netlify's Next.js Runtime. v5 is auto-installed when Netlify detects a Next
# site; this block makes it explicit/pinned. If you rely on auto-detection you
# can omit it — confirm on the deploy preview that the runtime is active
# ("Next.js Runtime" in the deploy log).
[[plugins]]
  package = "@netlify/plugin-nextjs"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
  external_node_modules = ["stripe"]

# ── KEEP: Stripe webhook pretty URL (framework-agnostic) ────
[[redirects]]
  from   = "/api/stripe-webhook"
  to     = "/.netlify/functions/stripe-webhook"
  status = 200

# ── Legacy product shortcuts → canonical Next routes (301) ──
# These used to 200-rewrite to /index.html for the SPA. Under Next they become
# real redirects to the current product URLs so old shared links still resolve.
[[redirects]]
  from   = "/blanket"
  to     = "/shop/blankets/armenian-alphabet-blanket"
  status = 301
[[redirects]]
  from   = "/bib"
  to     = "/shop/bibs/baby-bib"
  status = 301

# NOTE: every other redirect from the Vite config is intentionally REMOVED —
# see §3. Next's file-based routing now owns /, /shop/*, /journal/*, /story,
# /workshop, /faq, /contact, /shipping, /newsletter, /account, /admin, /gallery.

# ============================================================
# SECURITY HEADERS — unchanged from the Vite config
# ============================================================
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' https://identity.netlify.com https://cloud.umami.is; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; connect-src 'self' https://identity.netlify.com https://*.netlify.app https://cloud.umami.is https://api.anthropic.com; frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com; child-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com; object-src 'none'; upgrade-insecure-requests"
    Strict-Transport-Security = "max-age=63072000; includeSubDomains"
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()"
    Cross-Origin-Opener-Policy = "same-origin"

[[headers]]
  for = "/admin/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://identity.netlify.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; font-src 'self' data:; img-src 'self' data: blob: https:; connect-src 'self' https://identity.netlify.com https://*.netlify.app https://api.github.com https://unpkg.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests"
    Strict-Transport-Security = "max-age=63072000; includeSubDomains"
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

# ============================================================
# CACHE — point immutable caching at Next's hashed static assets
# ============================================================
# Vite emitted /assets/*; Next emits /_next/static/*. The Next.js Runtime
# usually sets immutable caching on /_next/static itself, so this block is
# belt-and-suspenders — confirm on the preview and drop if redundant.
[[headers]]
  for = "/_next/static/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

---

## 3. What changed vs the Vite config (review carefully)

| Change | Why |
|---|---|
| `command` → `npm ci && npm run next:build` | Build the Next app instead of Vite. |
| **Removed** `publish = "dist"` | The Next.js Runtime sets the publish dir + wires SSR/functions. |
| **Added** `[[plugins]] @netlify/plugin-nextjs` | Enables the Next runtime (or rely on auto-detect — verify). |
| **Kept** `/api/stripe-webhook` rewrite + `[functions]` block | Functions remain the API (Phase 6). The webhook URL is unchanged. |
| **Removed** all SPA-fallback `→ /index.html` rewrites (`/journal*`, `/shop*`, `/story`, `/workshop`, `/faq`, `/contact`, `/shipping`, `/newsletter`, `/admin`, `/account`, `/gallery`) | There is no `index.html` under Next; these would shadow / break the file-based routes. |
| **Changed** `/blanket`, `/bib` from `→ /index.html` (200) to **301** to the canonical `/shop/...` URLs | Preserve old shared links as real redirects. |
| **Kept** all security headers (`/*` + `/admin/*`) | No change needed; `script-src 'unsafe-inline'` already covers Next's inline bootstrap. |
| **Replaced** `/assets/*` + `/index.html` cache headers with `/_next/static/*` | Next's hashed assets live under `/_next/static/`. |

`public/` assets (`/img/*`, `sitemap.xml`, `robots.txt`, `manifest.webmanifest`,
`/admin/` Decap) are served as static files by Next the same as before.

---

## 4. Verify on the deploy preview (before merging)

- [ ] Deploy log shows the **Next.js Runtime** active and the build succeeds.
- [ ] **Every URL** loads (no 404/blank): `/`, `/shop`, `/shop/blankets`,
      `/shop/blankets/armenian-alphabet-blanket`, a placeholder product,
      `/journal`, `/journal/<slug>`, `/story` + the other section pages,
      `/account`, `/admin`, `/gallery`, `/cart`, `/checkout`.
- [ ] `/blanket` and `/bib` 301 to the right product pages.
- [ ] **Chrome parity**: bottom nav + page header on mobile; top nav + footer on
      desktop (Phase 7.5).
- [ ] **`/api/stripe-webhook`** resolves to the function (Stripe CLI
      `stripe trigger` or a dashboard test event → 200, order row written).
- [ ] **Auth**: sign in via the Netlify Identity widget; `/account` loads orders.
- [ ] **db calls** work (profile/orders/saved cart) — i.e. `/.netlify/functions/*`
      resolve from the Next pages.
- [ ] SEO: view-source a product + journal page → SSR `<title>`, canonical, and
      JSON-LD present (Phase 7).
- [ ] **★ The owner runs ONE real Stripe card** through checkout on the preview
      and confirms the order lands in the DB. *(No agent runs a real card.)*
- [ ] Run the Playwright suite against the preview if pointing `BASE_URL` at it.

---

## 5. Flip + monitor

- [ ] Merge the flip PR → production rebuilds on the Next runtime.
- [ ] Smoke-test production immediately: home, one product, one journal post,
      add-to-cart, **a real checkout**, the webhook firing, sign-in.
- [ ] Watch Netlify function logs + Stripe webhook deliveries for ~30 min.

## 6. Rollback (if needed)

The Vite build path is untouched in the repo. To roll back, revert the flip
commit (restores `publish = "dist"` + `npm run build` + the SPA redirects);
Netlify redeploys the Vite `dist/`. Keep the revert handy during the flip window.

---

## Notes / open verification items

- The `@netlify/plugin-nextjs` version + whether to pin it vs rely on
  auto-detection is a Netlify-config call (Cowork). Confirm the runtime engages
  on the preview.
- CSP: if Next ships any inline script the current `'unsafe-inline'` doesn't
  cover (e.g. a nonce/strict-dynamic setup), tighten/adjust on the preview.
  Today's policy already allows `'unsafe-inline'`, so the default Next bootstrap
  should pass — verify there are no CSP console errors on the preview.
