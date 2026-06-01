# Lusik & Sons

Hand-embroidered Armenian alphabet blankets and bibs. A Next.js (App Router) site, deployed on Netlify with Stripe Checkout via Netlify Functions.

Live site: https://lusikandsons.com

## Stack

- **Frontend**: Next.js 15 (App Router) + React 18 + Tailwind CSS
- **Hosting**: Netlify (`@netlify/plugin-nextjs` runtime + serverless functions)
- **Payments**: Stripe Checkout (top-level redirect)
- **Database**: Netlify DB (Neon)
- **Auth**: Netlify Identity (admin-only)
- **Monitoring**: Sentry scaffold (DSN required to activate)
- **Tests**: Playwright e2e + Node native test runner
- **CI**: Lighthouse CI (`lighthouserc.json`)

## Local development

```bash
npm ci
npm run next:dev     # Next dev server
npm run next:build   # production build into .next/
npm run next:start   # serve the production build
npm run typecheck    # tsc --noEmit
npm run test:unit    # Node native test runner
npm run test:e2e     # Playwright (chromium)
```

Requires Node `>=20`.

## Repository layout

| Path | Purpose |
|---|---|
| `app/` | Next.js App Router routes (`page.tsx` shells, `layout.tsx`, `providers.tsx`, `not-found.tsx`, `error.tsx`) |
| `src/` | React app code imported by the routes (components, routes, state, lib, data, i18n) |
| `netlify/functions/` | Serverless functions (Stripe, email, DB) |
| `netlify/schema.sql` | Database schema (Neon) |
| `public/` | Static assets served as-is |
| `tests/e2e/` | Playwright tests |
| `netlify.toml` | Netlify deploy config (build, redirects, security headers, CSP) |

## Branching & deploys

See [`BRANCHING.md`](./BRANCHING.md) for the production branch, branch policy, and deploy flow.

## Environment variables

These are configured in **Netlify → Site settings → Environment variables**, never committed to the repo. Names only:

- `STRIPE_SECRET_KEY` — Stripe secret API key (Functions runtime)
- `STRIPE_WEBHOOK_SECRET` — verifies Stripe webhook signatures
- `STRIPE_PRICE_*` — referenced in `netlify.toml`; confirm in `netlify/functions/create-checkout-session.mjs`
- `NETLIFY_DATABASE_URL` — auto-injected by Netlify DB; do not set manually
- (optional) `NEXT_PUBLIC_SENTRY_DSN` — activates the Sentry scaffold (browser-visible, so it must carry the `NEXT_PUBLIC_` prefix)
- (optional) Umami analytics website ID — activates `src/lib/analytics.js`

**Never paste real secret values into a PR, README, issue, or chat.**

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — project context for AI-assisted development
- [`BRANCHING.md`](./BRANCHING.md) — branch and deploy policy
- [`SECURITY_REVIEW.md`](./SECURITY_REVIEW.md) — application-layer security review
- [`IMPLEMENTATION_REPORT.md`](./IMPLEMENTATION_REPORT.md) — most recent feature/hardening notes
- [`SERVICE_SIGNUP_CHECKLIST.md`](./SERVICE_SIGNUP_CHECKLIST.md) — optional third-party services

## License

Private — © Lusik & Sons. All rights reserved.
