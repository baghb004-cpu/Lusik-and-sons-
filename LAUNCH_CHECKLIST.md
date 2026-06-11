# Launch checklist — Lusik & Sons

A living inventory of what's still between the site and a fully-finished public
launch. Most items are addressed to **Lusik** (photos, pricing, copy
confirmation); a couple need a dev pass. Refresh this file by hand (or ask
Claude to re-audit) whenever the catalog or content changes — last refreshed
**2026-06-11** (this pass also verified the live Netlify env vars directly,
not just the code).

Status legend: ✅ done · 🟡 needs Lusik · 🔧 needs a dev pass.

## Products

**Seven products are live and buyable today**, each with its matching
server-side price row in `netlify/functions/_lib/trusted-products.mjs`:

| Product | Status |
| --- | --- |
| Armenian Alphabet Blanket | ✅ live ($65) |
| Full Alphabet Crib Blanket | ✅ live ($245) |
| The Custom Name Bib | ✅ live ($22) |
| Days-of-the-Week Bib Set | ✅ live ($60) |
| Hye Em Yes Bib | ✅ live ($20 / $38 with cap) |
| Mama & Papa's Anushig Bib Set | ✅ live ($40) |
| Bari Akhorzhak Bib & Burp Cloth Set | ✅ live ($40 / $58 with cap) |

Bib prices were dropped to these everyday levels in June 2026 (a deliberate
price-test — lower than the old founding-promo prices, so the promo was
retired rather than extended).

**Four products remain coming-soon placeholders.** All eleven products (live
ones included) are CMS-managed now — Lusik can edit them herself in the Content
Studio at `/studio` (they live in `content/products/*.json`):

| Product | Blocker |
| --- | --- |
| Embroidered Hand Towel | 🟡 set a price + photos |
| Armenian Baptism Towel | 🟡 set a price + photos |
| Baby Swaddle | 🟡 set a price + photos |
| Baby Bathrobe | 🟡 set a price + photos |

Flipping a placeholder to buyable takes **both** halves: the CMS entry gets
`status: live` + `priceFrom`, **and** the matching commented-out row in
`netlify/functions/_lib/trusted-products.mjs` gets uncommented with the same
price (the server-side price contract) — otherwise checkout rejects it.

## Time-boxed: Founding-price launch promo

- ✅ **Retired (June 2026).** The promo was superseded by the permanent
  bib price drop above (the new everyday prices sit below the old founding
  prices). `LAUNCH_PROMO` is `enabled: false` with an empty `FOUNDING_CENTS`
  in **both** `src/data/config.js` and `netlify/functions/_lib/launch-promo.mjs`
  (kept in lockstep by `launch-promo-drift.test.mjs`). To run a future promo,
  re-populate both files with prices strictly below the current trusted prices.

## Content review (the big one)

In rough priority order:

- 🟡 **Replace the placeholder testimonials.** The home-page quotes use
  invented names and were written as seed content. They're now CMS-managed
  (`content/pages/testimonials.json`), so Lusik can swap in real quotes — from
  customers who said yes to being quoted — herself in the Studio, or empty the
  list to hide the section until then.
- ✅ **Calendly link is real (2026-06-11).** `CONFIG.TEXT_US.calendly_url` now
  points at the owner-confirmed 30-minute event,
  `https://calendly.com/lusikandsons/30min`. If the event is ever renamed or
  deleted in Calendly, update the config in the same breath.
- 🟡 Confirm the Alphabet Blanket size (`src/data/catalog.js` — "Approx.
  30 × 36 in" is marked unconfirmed) and the blanket variants flagged in
  `src/data/product.js`.
- 🟡 Record + upload the hands-stitching video clip (`src/data/product.js`).
- 🟡 Replace the placeholder photo of Lusik in the shop "Help deciding" section
  (`src/components/shop/HelpDecidingSection.jsx`).
- 🟡 Customer photos: `CustomerPhotosSection` hides itself until real photos
  exist — add them when customers consent.
- 🟡 The journal posts carry `TODO_LUSIK_REVIEW` — Lusik should read each and
  confirm (or send a personal anecdote to splice in).
- 🟡 Eastern Armenian (`hy`) is surfaced but ~two dozen strings are
  auto-translated drafts awaiting a native speaker
  (`src/i18n/translations.js`); Western Armenian (`hyw`) is staged and hidden
  until reviewed.

## Brand assets

- ✅ Full icon set + favicon + maskable icon + `og-image.jpg` shipped under
  `public/`. The art is placeholder-grade — fine to replace with final brand
  artwork whenever it exists, no code change needed (same filenames).

## Payments / go-live (owner-only — can't be automated)

The 2026-06-11 audit checked the **live Netlify environment** directly. Set and
confirmed: `STRIPE_SECRET_KEY` (live key), `STRIPE_WEBHOOK_SECRET`,
`NETLIFY_DATABASE_URL`, `RESEND_API_KEY`, `ADMIN_NOTIFICATION_EMAIL`,
`ADMIN_EMAILS`, `REMINDER_SECRET`. What remains:

- 🟡 **Brand the Resend sender.** `RESEND_FROM_EMAIL` is verified to still be
  `onboarding@resend.dev` — order confirmations risk the spam folder. Verify
  `lusikandsons.com` in Resend → Domains, add the SPF/DKIM/DMARC records at
  Cloudflare, then set `RESEND_FROM_EMAIL=Lusik & Sons <orders@lusikandsons.com>`.
  Highest-value 15 minutes on this list.
- 🟡 **Set `NEXT_PUBLIC_SENTRY_DSN`** — verified NOT set, so Sentry is wired but
  dormant: nobody finds out when something breaks for a real customer.
- 🟡 **Rotate the dev-context Stripe secrets.** The Netlify env vars
  `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` carry **unmasked plaintext
  copies in the "dev" context** (the other contexts are secret-masked) —
  anything with Netlify API read access can see the live key. Delete the
  dev-context values (local dev should use a Stripe *test* key via `.env`) and
  roll the live secret key in Stripe afterward.
- 🟡 Confirm the Stripe webhook is subscribed to all three events
  (`checkout.session.completed`, `charge.refunded`, `checkout.session.expired`)
  — not checkable via the API access available to the audit.
- 🟡 The end-to-end **Stripe live-card test**: place one small real-card order,
  confirm the webhook fires and the order lands in the DB, then refund.
- 🟡 `SCHEDULED_FN_SECRET` is not set (optional — only needed to manually
  trigger `cleanup-blobs` / `gift-reminder` with curl; Netlify's scheduler
  works without it).

## Engineering hygiene (in progress, low priority)

- ✅ Unknown `/shop/...` and `/journal/...` URLs now return a real 404 (the
  dynamic routes call `notFound()`), instead of a soft-404 with HTTP 200.
- ✅ First-load JS budget (210 KB gzip per route) enforced as a postbuild on
  every build — locally, CI, and Netlify (`scripts/check-bundle-budget.mjs`).
- ✅ All products + categories + five page surfaces are CMS-managed with a
  build-time trusted-products reconciliation gate (a Studio edit can't invent
  a buyable product or drift a price).
- ✅ The privacy policy lives at a real URL (`/privacy`) for external listings.
- 🔧 Gradual `.js → .ts` migration is ongoing (one module at a time, each a PR).
