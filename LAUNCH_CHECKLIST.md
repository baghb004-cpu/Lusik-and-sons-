# Launch checklist — Lusik & Sons

A living inventory of what's still between the site and a fully-finished public
launch. Most items are addressed to **Lusik** (photos, pricing, copy
confirmation); a couple need a dev pass. Refresh this file by hand (or ask
Claude to re-audit) whenever the catalog or content changes — last refreshed
**2026-06-09**.

Status legend: ✅ done · 🟡 needs Lusik · 🔧 needs a dev pass.

## Products

**Seven products are live and buyable today**, each with its matching
server-side price row in `netlify/functions/_lib/trusted-products.mjs`:

| Product | Status |
| --- | --- |
| Armenian Alphabet Blanket | ✅ live ($65) |
| Full Alphabet Crib Blanket | ✅ live ($245) |
| The Custom Name Bib | ✅ live ($22) |
| Days-of-the-Week Bib Set | ✅ live ($129) |
| Hye Em Yes Bib | ✅ live ($35 / $52 with cap) |
| Mama & Papa's Anushig Bib Set | ✅ live ($54) |
| Bari Akhorzhak Bib & Burp Cloth Set | ✅ live ($48 / $65 with cap) |

**Four products remain coming-soon placeholders**, now CMS-managed — Lusik can
edit them herself in the Content Studio at `/studio` (they live in
`content/products/*.json`):

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

- 🟡 `LAUNCH_PROMO` (intro pricing on the bibs) runs **2026-06-05 → 2026-06-12**
  and auto-reverts at the end timestamp. To extend it, change the window in
  **both** `src/data/config.js` and `netlify/functions/_lib/launch-promo.mjs`
  (kept in lockstep by `launch-promo-drift.test.mjs`). To let it lapse, do
  nothing.

## Content review (the big one)

In rough priority order:

- 🟡 **Replace the placeholder testimonials.** The quotes in
  `src/components/TestimonialsSection.jsx` (rendered on the home page) use
  invented names and were written as seed content. Swap in real quotes from
  customers who said yes to being quoted — or hide the section until then.
- 🟡 **Verify the Calendly link.** `CONFIG.TEXT_US.calendly_url` is a guessed
  placeholder URL. If the account/event doesn't exist, the "Book a video call"
  circle on the mobile Shop page dead-ends. Create the event (free tier is
  fine) and paste the real link.
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

- 🟡 The end-to-end **Stripe live-card test**: place one small real-card order,
  confirm the webhook fires and the order lands in the DB, then refund.
- 🟡 Confirm the Stripe webhook is subscribed to all three events
  (`checkout.session.completed`, `charge.refunded`, `checkout.session.expired`).
- 🟡 Confirm `NEXT_PUBLIC_SENTRY_DSN` is set in Netlify if error monitoring
  should be on (Sentry is wired but dormant without it).

## Engineering hygiene (in progress, low priority)

- ✅ Unknown `/shop/...` and `/journal/...` URLs now return a real 404 (the
  dynamic routes call `notFound()`), instead of a soft-404 with HTTP 200.
- 🔧 Gradual `.js → .ts` migration is ongoing (one module at a time, each a PR).
