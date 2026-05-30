# Launch checklist — Lusik & Sons

A living inventory of what's still blocking a full public launch, generated from
the catalog + repo state. Most items are addressed to **Lusik** (photos, pricing,
copy confirmation) or need brand artwork; a couple need a dev pass. Maintained by
the daily maintenance sweep — last refreshed **2026-05-29**.

Status legend: ✅ done · 🟡 needs Lusik · 🔧 needs a dev pass.

## Products

Two products are fully live and buyable today; the rest are coming-soon
placeholders. The catalog carries **16 `TODO_LUSIK` markers** in total.

| Product | Status | Blocker |
| --- | --- | --- |
| Armenian Alphabet Blanket | ✅ live ($65) | — |
| The Custom Name Bib | ✅ live ($22) | — |
| Full Alphabet Crib Blanket | 🔧 placeholder, **priced $245** | Price is set; needs the live product view + `trusted-products.mjs` row wired so it's buyable online. Until then the page shows the commission (write/call) path. |
| Days-of-the-Week Bib Set | 🟡 placeholder | **Set a price**, confirm sizing |
| Hye Em Yes Bib | 🟡 placeholder | **Set a price**, confirm whether the matching cap is bundled or an add-on |
| Mama & Papa's Anushig Bib Set | 🟡 placeholder | **Set a price** |
| Bari Akhorzhak Bib & Burp Cloth Set | 🟡 placeholder | **Set a price**, confirm sizing |
| Embroidered Hand Towel | 🟡 placeholder | **Set a price** |
| Armenian Baptism Towel | 🟡 placeholder | **Set a price** |
| Baby Swaddle | 🟡 placeholder | **Set a price** |
| Baby Bathrobe | 🟡 placeholder | **Set a price** |

**Bottom line:** 8 products are blocked only on Lusik setting a price (and a few
sizing confirmations). Once a price + photos + final copy exist, each placeholder
can be flipped to `live` — but only together with its matching
`netlify/functions/_lib/trusted-products.mjs` entry (the server-side price
contract), or checkout will reject it.

## Brand assets (missing — need artwork)

The site references these in the manifest/favicon tags, but the files don't exist
in `public/` yet (an `icon.svg` and `manifest.webmanifest` are present). The PWA
install still works without them — the browser falls back to a page screenshot —
but the experience is much better with real artwork.

- 🟡 `public/favicon.ico` (32×32 or multi-size)
- 🟡 `public/apple-touch-icon.png` (180×180, iOS home screen)
- 🟡 `public/icon-192.png` (192×192, Android)
- 🟡 `public/icon-512.png` (512×512, Android splash + iOS large)
- 🟡 `public/icon-maskable-512.png` (512×512 with safe-zone padding, Android adaptive)
- 🟡 `public/og-image.jpg` (1200×630, social-share preview card)

All six could be generated from the existing `public/icon.svg` if Lusik is happy
to use that mark; otherwise they need her chosen artwork.

## Content review (TODO_LUSIK_REVIEW)

- 🟡 The three Journal posts carry `TODO_LUSIK_REVIEW` — Lusik should read each and
  confirm (or send a personal anecdote to splice in).
- 🟡 Eastern Armenian (`hy`) is surfaced; Western Armenian (`hyw`) is auto-translated
  and staged for a native speaker's review before it's exposed.

## Payments / go-live (owner-only — can't be automated)

- 🟡 The end-to-end **Stripe live-card test**: place one small real-card order, confirm
  the webhook fires and the order lands in the DB, then refund. This is the last
  gate before the shop is officially shippable.
- 🟡 Confirm the Stripe webhook is subscribed to all three events
  (`checkout.session.completed`, `charge.refunded`, `checkout.session.expired`).

## Engineering hygiene (in progress, low priority)

- 🔧 Gradual `.js → .ts` migration is ongoing (one module at a time, each a PR).
- 🔧 The production bundle is a single ~590 KB chunk; consider code-splitting
  (`build.rollupOptions.output.manualChunks`) if load time becomes a concern.
