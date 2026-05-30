# Next.js migration plan — Lusik & Sons

**Status: Phases 1–3 complete (scaffold → install → provider shell) — production is NOT affected.** See the **Progress log + handoff** section at the bottom for the live state, decision log, and the open question that blocks Phase 4.

Migrate the Vite + React SPA to **Next.js (App Router)** on Netlify, for true
server rendering on product/journal pages (SEO + first paint), *without breaking
the live store*.

## Guardrails (non-negotiable)

- **Production stays on the current Vite build** (`netlify.toml` `publish = "dist"`)
  until the final flip in Phase 8. Every intermediate phase leaves the site
  building and serving exactly as it does today.
- **URLs are preserved exactly** — shared links and SEO must not break.
- **The cart-ID ↔ `trusted-products.mjs` contract is unchanged** (the Stripe smoke
  test guards it).
- **Netlify Identity** keeps loading from `identity.netlify.com`.
- **`netlify/functions/*` stay as-is initially** — Stripe webhook, auth, orders,
  and DB access are untouched.

## Current architecture (what we're moving)

- Vite build → `dist/`, served by Netlify. Entry: `index.html` → `src/main.jsx` → `<App/>`.
- **Routing:** a custom history-API router inside `src/App.jsx` (~2,100 lines):
  `/`, `/shop/<cat>/<product>`, `/journal/<slug>`, `/story` + promoted section
  pages (`/workshop`, `/faq`, `/contact`, `/shipping`, `/newsletter`), account, admin, checkout.
- **Providers/state:** `LangProvider` (i18n), `ToastProvider`, the `auth` Identity
  wrapper, the `db` fetch wrapper.
- **Backend:** `netlify/functions/*` (profile, addresses, orders,
  create-checkout-session, stripe-webhook, admin-*, waitlist, scheduled fns) on
  Neon Postgres + Netlify Blobs.
- **Styling:** Tailwind via PostCSS (works with Next as-is).

## Phases (low-risk → high-risk; each is its own branch + PR)

**Phase 1 — Scaffold (this PR).** `next.config.mjs` + an `app/` skeleton
(`layout.tsx`, a home placeholder) + this plan. These files are **inert**: not
built or served, and the Vite build + CI stay green. Zero production impact.

**Phase 2 — Install + first real route** *(do in Claude Code — it can install deps
and run `next build`).* `npm install next` (regenerates `package-lock.json`), add
Next `dev`/`build` scripts under distinct names so the Vite scripts still work.
Confirm `next build` serves a working home route locally. Move the global
stylesheet into `app/globals.css`; point Tailwind `content` at `app/`.

**Phase 3 — Global shell + providers.** Mount the provider stack (`LangProvider`,
`ToastProvider`, Identity init, analytics) in `app/layout.tsx` behind a single
`"use client"` boundary so existing client components work unchanged.

**Phase 4 — Leaf + widget components.** Most of `src/components/*` ports directly;
add `"use client"` where a component uses hooks or browser APIs. No behavior change.

**Phase 5 — Routes, one at a time, URLs preserved:**
- `/` → `HomeView`
- `/shop`, `/shop/[category]`, `/shop/[category]/[product]` → `ShopIndexView` / `CategoryView` / `ProductView`
- `/journal`, `/journal/[slug]`
- `/story`, `/workshop`, `/faq`, `/contact`, `/shipping`, `/newsletter`
- `/account`, `/admin`, checkout

Map the `App.jsx` `setView`/`pushState` logic onto file-based routes + `next/navigation`.

**Phase 6 — Backend.** Keep `netlify/functions/*` as the API (Netlify serves them
alongside Next). The `/api/stripe-webhook` redirect must keep resolving. Migrating
functions to `app/api` route handlers is optional and NOT required for the flip.

**Phase 7 — SSR + SEO.** Make product and journal pages server components with
`generateMetadata` (real SSR titles / OG / JSON-LD); keep interactive parts as
client islands. Regenerate `sitemap.xml`.

**Phase 8 — Parity test + flip:**
- Run the Playwright suite against the Next build; manual/visual QA on a Netlify deploy preview.
- Do the real Stripe live-card test on the preview.
- Flip `netlify.toml` to the Netlify Next.js runtime, merge, and monitor.

## Execution note

The per-route porting (Phases 2–7) is best done in **Claude Code** (or local) — it
can install dependencies, run `next build` / Playwright, and push. Cowork
orchestrates: reviews each phase's PR, manages the Netlify deploy config, and runs
the final rollout. **A phase merges only when its CI is green; production is never
touched until Phase 8.**

## Why / whether

The real payoff is server-rendered product/journal pages (SEO + first paint). Note
that much per-route SEO — titles, canonical tags, JSON-LD, the sitemap — *already
exists* in the SPA, so weigh the SSR gain against the migration cost. Proceeding
deliberately, one green phase at a time, keeps the risk bounded.

---

## Progress log + handoff (for Cowork)

**Phases 1–3 are done and pushed — each its own PR, stacked, all green locally.
Production is untouched (Vite still builds + serves `dist/`).**

### Stack & merge order (rebase/merge bottom-up)

1. **PR #153 — Phase 1: scaffold + plan.** `next.config.mjs`, `app/` skeleton,
   this doc. Inert.
2. **PR #154 — Phase 2: install Next + first route.** `next@^14.2.0` + the
   non-clobbering `next:dev` / `next:build` / `next:start` scripts;
   `app/globals.css` re-imports `src/styles/index.css`; Tailwind `content`
   gains `./app/**`; tsconfig auto-edited by `next build` (jsx→preserve,
   incremental, the `next` plugin, `.next/types`); `.gitignore` for `.next/`,
   `next-env.d.ts`, `*.tsbuildinfo`.
3. **PR #155 — Phase 3: global shell + providers.** `app/providers.tsx` — a
   single `"use client"` boundary mounting `LanguageProvider` + `ToastProvider`
   and calling `auth.init()`; `app/layout.tsx` loads the Netlify Identity
   widget from `identity.netlify.com` via `next/script` (`beforeInteractive`).

Each PR is stacked on the previous, so its diff vs `main` is cumulative until
the lower ones merge.

### Verify any phase locally

```
npm ci
npm run next:build   # App Router build (added in Phase 2)
npm run typecheck
npm run build        # Vite — MUST stay byte-identical (the production path)
npm run test:unit    # 90/90
npm run test:e2e     # 22 passed, 2 skipped (mobile cart-drawer, by design)
```

### Decision log

- **Next 14.2, not 15** — keeps the existing **React 18.3** runtime as-is (no
  React 19 / async-request-API coupling mid-migration). Bump in a later phase
  if wanted.
- **One stylesheet** — `app/globals.css` `@import`s `src/styles/index.css` so
  Vite + Next share one source of truth. Vite's ambient `*.css` type keeps the
  standalone `tsc` green.
- **Single client boundary** — the provider `.jsx` files get NO `"use client"`
  of their own; importing them from `app/providers.tsx` already bundles them
  client-side. This is the boundary Phase 3 calls for.
- **Identity** stays on the CDN (`identity.netlify.com`), `beforeInteractive`.
- **Deferred to the App port (Phase 5):** Sentry (`src/lib/errorReporting.ts`)
  and analytics (`src/lib/analytics.js`) — both read Vite `import.meta.env` /
  inject scripts from `App.jsx` effects.

### ⚠️ Open decision that blocks Phase 4 (component port)

Many `src/components/*` and `src/lib/*` read **`import.meta.env.*`**
(`VITE_SENTRY_DSN`, `import.meta.env.DEV`, …). Next/SWC leaves
`import.meta.env` **undefined at runtime**, so a strategy is needed before
porting widely. Options:

- **(A) Env-compat shim** — define the handful of `import.meta.env` keys for
  the Next build (`next.config` `env` / a small `import-meta-env`-style
  polyfill). Least churn.
- **(B) Shared env module** — refactor reads into `src/lib/env.ts` that works
  under both builds (`import.meta.env` for Vite, `process.env.NEXT_PUBLIC_*`
  for Next). Cleaner end state, touches more files. **Recommended.**
- **(C) Case-by-case** as each component ports.

### Other Phase 4 notes

- Add `"use client"` only to components using hooks / browser APIs / event
  handlers; leaf presentational components can stay server components.
- `analytics.js` script injection currently lives in `App.jsx` effects — it
  ports with App (Phase 5).
- Consider extracting `main.jsx`'s inline `ErrorBoundary` into a shared
  component so both the Vite and Next entries use it.

### CI / environment caveats

- **Playwright browser mismatch (this dev container only):** the locked
  `@playwright/test` wants browser build **1223**, but only **1194** is cached
  and the download is network-blocked. Worked around locally by symlinking the
  cached headless shell into the 1223 path. In normal CI (where `test:install`
  fetches the matching browser) this is a non-issue.
- **`next build` is not yet in the Tests workflow** — production rides Vite, so
  CI doesn't build Next. Worth adding a `next build` CI step so later phases
  can't silently break the Next build.

### Phase 6 (backend) — done; ⚠️ carry-overs for the Phase 8 flip

Phase 6 keeps `netlify/functions/*` as the API (no migration to `app/api`). A
guard test (`netlify/functions/_lib/__tests__/migration-api-contract.test.mjs`)
locks the contract: the `/api/stripe-webhook` rewrite, no `app/api` shadow,
relative `CONFIG.FN_BASE`, functions intact. The webhook handler is already
exercised by the existing signature unit tests; `db`/`auth` are framework-
agnostic (relative `/.netlify/functions` base, no `import.meta`). The only
piece that needs the real Netlify runtime — the live `/api/stripe-webhook`
rewrite resolving under Next — is confirmed on the **Phase 8 deploy preview**.

**When flipping `netlify.toml` to the Next runtime at Phase 8, also:**
- **Remove the SPA-fallback rewrites** (`/journal`, `/journal/*`, `/shop`,
  `/shop/*`, `/story`, `/workshop`, `/faq`, `/contact`, `/shipping`,
  `/newsletter`, `/blanket`, `/bib`, `/admin`, `/account`, `/gallery` →
  `/index.html`). They exist for the Vite SPA; under Next they would shadow the
  file-based routes. **Keep** the `/api/stripe-webhook` rewrite, the
  `[functions]` block, and the security/cache headers.
- Re-point the `/assets/*` immutable-cache header at Next's `/_next/static/*`.
- Verify `/api/stripe-webhook` end-to-end (Stripe CLI or a test event) on the
  preview before merging the flip.
