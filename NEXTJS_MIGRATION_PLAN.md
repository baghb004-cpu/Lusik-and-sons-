# Next.js migration plan — Lusik & Sons

**Status: Phase 1 (scaffold) — production is NOT affected.**

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
