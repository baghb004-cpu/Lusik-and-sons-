# Shipping the Replit app (Chunk 10)

From "the code is on the `replit` branch" to "the app is live on a real
URL," in order. Everything here uses config that's already committed —
no code changes required to deploy.

## 1. Run it on Replit (the dev loop)

1. [replit.com](https://replit.com) → **Create Repl → Import from
   GitHub** → pick this repo → branch **`replit`**.
2. Press **Run**. The root `.replit` config installs and starts the
   Vite dev server from `replit-app/` automatically; the webview opens
   the app.
3. That's the whole loop: edit → it hot-reloads. Backend calls (chat,
   waitlist, checkout) work immediately — see §4 for why.

## 2. Deploy it (a permanent URL)

1. In the workspace, open the **Deploy** panel → choose
   **Autoscale** (it scales to zero between visitors — right for a
   shop's companion app).
2. Replit reads the committed `[deployment]` block in `.replit`:
   - build: `cd replit-app && npm install && npm run build`
   - run: `cd replit-app && npm run preview`
3. Click **Deploy**. You get `https://<name>.replit.app` serving the
   production build.

## 3. The custom domain (app.lusikandsons.com)

1. Deployments → **Settings → Link a domain** → enter
   `app.lusikandsons.com`.
2. Replit shows a **CNAME** (and a TXT verification) record — add both
   in the DNS host for lusikandsons.com (Netlify DNS if the domain
   lives there: Netlify → Domains → lusikandsons.com → add record).
3. Wait for verification (minutes to an hour). Replit provisions TLS
   automatically.

## 4. How backend calls work in production (read once)

The Netlify Functions backend is **same-origin-only** (no CORS — by
design; the website calls it from its own origin). This app therefore
calls **relative** `/.netlify/functions/*` URLs, and the Vite server
**proxies** them to `https://lusikandsons.com` server-side — in dev
AND in the deployed app (`vite preview` uses the same proxy config in
`vite.config.js`). Browsers never make a cross-origin request, so
nothing is blocked. Don't switch `src/lib/api.js` back to absolute
URLs.

**The one consequence — Stripe's return URL.** The server builds
`?order=success` redirects from the request Origin via an allowlist
(`netlify/functions/_lib/origin.mjs`: production site, deploy
previews, localhost). So:

- **Local dev:** the full loop works — pay, return to the app, bag
  clears, thank-you shows.
- **Deployed on Replit:** payment works identically, but the
  post-payment redirect lands on **lusikandsons.com's** thank-you page
  (the order, emails, and admin flow are unaffected — only the in-app
  thank-you is skipped).
- **To get the in-app return on the deployed app:** add the deployed
  domain (e.g. `https://app.lusikandsons.com`) to the allowlist in
  `_lib/origin.mjs` — a two-line **website PR with explicit
  approval**, same pattern as the iOS app's Apple Pay note.

## 5. Pre-flight checks (once, on the deployed URL)

- [ ] Add to Home Screen on a phone — the monogram icon + standalone
      window should appear (manifest + icons shipped in Chunk 9).
- [ ] Browse → add to bag → reload — the bag persists.
- [ ] Chat → send a message — until `ANTHROPIC_API_KEY` is set
      server-side, the "assistant isn't online yet" panel with
      Text/email is the CORRECT behavior, not a bug.
- [ ] Waitlist a placeholder with a real email — confirm it appears in
      `/admin`'s Waitlists panel (one shared list with the website).
- [ ] **Checkout = a real charge** (live Stripe). Test like the iOS
      guide says: one real order to yourself, then refund it from the
      Stripe dashboard.
- [ ] Lighthouse, on any machine with Chrome:
      `npx lighthouse https://<your-url> --view`
      (the bundle is ~68 KB gzip of JS + lazy images — expect good
      numbers; fix regressions before they compound).

## 6. Maintenance map

| When… | Do… |
| --- | --- |
| Journal posts change on `main` | copy `src/data/journal-posts/*.md` onto this branch, run `node replit-app/scripts/gen-journal.mjs`, commit |
| Products/prices change | update `replit-app/src/data/catalog.js` (keys MUST stay equal to `_lib/trusted-products.mjs`) and `shippingZones.js` if the zone table moved |
| A placeholder goes live on the site | move it from `data/placeholders.js` into `catalog.js` with its trusted key + photos |
| Final brand icon lands | swap the PNGs in `replit-app/public/` (same files as the site's) |
| Chat goes live server-side | nothing — the 503 fallback stops rendering by itself |

## 7. Where things stand

All eleven roadmap chunks (0–10) are complete — see
[`ROADMAP.md`](./ROADMAP.md) for the full record of what shipped in
each and the standing decisions (the iOS app in `ios/` remains the
design spec; this branch never merges to `main`).
