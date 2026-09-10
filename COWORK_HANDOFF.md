# Handoff to a Claude Cowork session

**Written 2026-09-10.** For a fresh session with no prior context, sitting down
with the owner to look at GitHub, Netlify and the Lusik & Sons site up close.

Read this first, then `CLAUDE.md` for the architecture and
`SITE_OVERHAUL_HANDOFF.md` for the overhaul plan and its progress log.

---

## 1. The one thing to know before you touch anything

**None of the last several weeks of work is live.** It all sits on one branch
behind one pull request:

- **PR:** https://github.com/baghb004-cpu/Lusik-and-sons-/pull/280
- **Branch:** `claude/lusik-sons-brochure-gt38ja` (51 commits ahead of `main`)
- **State as of writing:** all five CI checks green; `mergeable_state: blocked`
  **only** because branch protection requires an approving review. There is no
  merge conflict and nothing left for an agent to fix.

| Where | URL | What you see |
| --- | --- | --- |
| Deploy preview (the branch) | https://deploy-preview-280--lusikandsons.netlify.app | Everything described in this doc |
| Production | https://lusikandsons.com | The **old** site |

Quick way to tell them apart: `/welcome` returns 200 on the preview and **404**
on production.

If the owner asks "why doesn't the site look like that" — this is why. Merging
is theirs to do; you cannot approve or merge on their behalf.

---

## 2. Hard constraints. Do not break these.

**The lead times are stated, never explained.** There is a private, family-personal
reason the pieces take as long as they do. It is deliberately not written down in
this repository, and it must never appear in customer-facing copy — the website,
the brochure, an email, a product description, anywhere. Give realistic numbers as
plain fact. If you catch yourself writing a sentence that justifies the wait,
delete it.

**Printed material** (`print/`) has its own standing rules, all currently honored:
no prices, no em dashes, "colors may vary" on every product, all three ways to
order (phone, website, Instagram) plus a follow-on-Instagram ask, realistic lead
times, and it must not read as AI-written. Coupons stay on a **separate sheet** so
they can be included per box.

**⚠️ The coupon codes are still placeholders.** They exist only in the Stripe
dashboard and could not be verified from a sandbox. The sheet prints a red DRAFT
strip until `CODES_CONFIRMED` is flipped. **Do not send it to a printer first.**

**Money is server-trusted.** `netlify/functions/_lib/trusted-products.mjs` is the
only place a price is believed for checkout. The browser may send anything.

**`TODO_LUSIK` and `TODO_LUSIK_REVIEW` markers are addressed to the owner, not to
you.** They mark things needing photos, pricing, or a native Armenian speaker's
review. Do not silently "fix" them.

**Never transcribe stitched Armenian off a photograph.** Letters come from the
Unicode block or from the font; the render is then compared against the
photograph. A wrong Armenian word is not a red build, it is a hand-stitched
mistake in a box that took six weeks.

---

## 3. Five things only the owner can do

These are blocking real functionality. Worth walking through together.

1. **Approve and merge PR #280.** Nothing ships until then.
2. **Apply the database schema:** `netlify db query --file netlify/schema.sql`.
   Three tables arrived in this branch (`order_milestones`, `product_waitlist`,
   `reviews`) plus new columns on `orders`. It is idempotent. Until it runs, the
   order follow-along page and every review link will 404 in production.
3. **Confirm the crib blanket's alphabet.** The copy says "Ա to Ք" — thirty-six
   letters. The photographs look like they include Օ and Ֆ, which would make it
   thirty-eight. The 3D rig follows the photographs. One word settles it.
4. **Confirm the coupon codes** from the Stripe dashboard, then set
   `CODES_CONFIRMED = true` in `print/coupons/coupons.html` (line 41, currently
   `false`) and re-render. `print/README.md` has the steps.
5. **Two content jobs:** the Custom Name Bib has no cover photo (add it in the
   Studio at `/studio`), and `npm run gen:loom-posters` needs running on a machine
   with normal internet, then the output committed. It deliberately refuses to run
   in a sandbox rather than bake a product picture in the wrong typeface.

---

## 4. What exists now

The site is a **Next.js 15 App Router** app on React 18.3, deployed to Netlify,
with all backend logic in `netlify/functions/`, a Neon Postgres database, Stripe
for payments, Resend for transactional email, and Netlify Identity for auth.
`CLAUDE.md` is the real architecture document — it is kept accurate and is what
you should read before changing code.

Phases 1 to 3 of the overhaul are complete:

- **The Loom** (`src/loom/`) — a real-time 3D engine that renders each product as
  actual cross-stitch geometry and restitches as the customer types their child's
  name. Every live product has a rig. It is loaded only via `next/dynamic`, costs
  134 KB of a 230 KB budget, and **never shows a blank box**: every failure path
  lands on the live 2D preview instead.
- **Storyboarded pages** — Home v3 scenes, a three-question product chooser on
  `/shop`, "Try a name" on the shop cards, `/welcome` (the page the printed card
  points at), a stitched 404, a fitting room on the product page, and cart
  thumbnails showing the design the customer actually configured.
- **Commerce and trust** — a lead-time engine whose numbers match the brochure,
  six-stage order milestones reachable by a signed guest link, shared design
  pages, a gift card preview and a price-free gift receipt, coupons that stack
  with the bundle discount, and reviews.
- **A capability ladder** — full / lean / core device tiers, with a visitor-facing
  "Lighter version" toggle that always wins. The site works with JavaScript off.

### Reviews — worth understanding, it is the newest piece

Customers are invited fourteen days after delivery by an emailed capability link.
No account, no login, no review form anywhere else: a review can only exist
against a real order. Everything lands as `pending` until the owner approves it in
`/admin`. A photograph needs **two** separate yeses — the customer's consent and
the owner's approval — and both are re-checked on every single image request, so
withdrawing either takes the picture down without anyone editing a page.

---

## 5. What is left

**Tier 1 — finishing the core.** Roughly two to three focused sessions.

| | |
| --- | --- |
| PR 14, the rest | The actual performance work. The *gates* landed; the work behind them did not. CI measures 0.58 on home and 0.48 on the product page. The remaining causes are total blocking time and three render-blocking stylesheets, plus an INP audit of the configurator and Sentry release tagging. |
| PR 15 | Studio content fields for the Home v3 copy, an Armenian keyboard helper for parents typing on English keyboards, doc refresh. |
| PR 18 | Service worker, offline page, queued cart. |

**Tier 2 — the premium layer (PRs 19–27).** Roughly five to eight sessions. Five
of the nine are buildable today: AR export from the live rig, a certificate PDF
with a design QR, design-together, the alphabet room, and a
ledger/view-transitions grab-bag.

**Tier 3 — genuinely blocked on the owner**, not on any amount of coding:

- **Hero film** needs real footage of Lusik working.
- **Captured textures** need the actual cloth photographed.
- **Name meanings** need a native Armenian speaker's review.
- **The OKLCH palette** needs the physical materials measured. Converting the
  existing hexes without that measurement is notation change dressed up as colour
  science — and those hexes are load-bearing for the printed brochure.

Full detail, including what each finished piece cost in bugs, is in
`SITE_OVERHAUL_HANDOFF.md` section 0.5.

---

## 6. How to verify anything

```
npm ci                  # once
npm run next:dev        # dev server
npm run typecheck       # tsc --noEmit
npm run test:unit       # 343 Node tests, no browser needed
npm run test:e2e        # Playwright, 4 projects (excludes the axe suite)
npm run test:a11y       # axe on 15 routes x 2 viewports
npm run test:visual     # pixel baselines — read the warning below
npm run next:build      # ends with the bundle-budget gate
```

CI runs five jobs on every push: Unit, E2E, Accessibility, Visual baselines, and
Lighthouse. **Tests and Lighthouse both block merging.**

Three things that catch people out:

- **Visual baselines are drawn by CI, never locally.** A pixel baseline belongs to
  the browser that drew it, and a local Chromium differs in *text metrics*, not
  just antialiasing — paragraphs wrap differently and the page height moves.
  Refreshing one means: push, let the job fail, download its `visual-diffs`
  artifact, **look at** each `*-actual.png`, copy them into
  `tests/visual/__snapshots__/<project>/`, push again. A green local
  `--update-snapshots` run proves nothing. The procedure is in the header of
  `tests/visual/baseline.spec.mjs`.
- **Lighthouse numbers only mean something from CI.** Run it in a sandbox and home
  scores 0.82 performance where CI says 0.58 — the ad hosts are simply
  unreachable, so none of that JavaScript executes. Accessibility and SEO are DOM
  audits and do score the same everywhere, which is exactly why those two are the
  ones promoted to blocking.
- **`src/data/*.generated.js` are build artifacts.** They come from `content/`
  via `npm run gen:data`. Edit the JSON or the Studio, never the generated file.

---

## 7. The two admin surfaces — don't confuse them

- **`/admin`** is the order dashboard: fulfillment, tracking numbers, finished-piece
  photos, the waitlist panel, and the review moderation queue. Gated by an `admin`
  role on the Netlify Identity user.
- **`/studio`** is the content editor (Decap/Netlify CMS). Products, categories,
  the journal, the announcement bar, Story, testimonials. Saving publishes
  straight to `main` and triggers a deploy.

They live on separate paths on purpose — the CMS used to sit at `/admin` and the
Next route shadowed it.

---

## 8. Netlify — what to look at in the dashboard

Environment variables the code actually reads (set under Site → Environment).
**Never paste a value into a chat, a commit, or a document:**

| Variable | Needed for |
| --- | --- |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Checkout and the order webhook |
| `RESEND_API_KEY`, `ADMIN_NOTIFICATION_EMAIL` | All six transactional emails |
| `RESEND_FROM_EMAIL` | Optional; a verified domain instead of `onboarding@resend.dev` |
| `REMINDER_SECRET` | **Required**, no fallback. Signs the gift-reminder unsubscribe links |
| `ORDER_LINK_SECRET` | Signs order-follow and review links. Falls back to `REMINDER_SECRET`, so it works without being set |
| `SCHEDULED_FN_SECRET` | Lets you trigger the daily scheduled functions by hand |
| `ADMIN_EMAILS` | Fallback admin gate for a fresh deploy |
| `ANTHROPIC_API_KEY` | The on-site chat assistant |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional; error monitoring is off until it is set |

**Stripe webhook check.** The endpoint is `/api/stripe-webhook` and it must be
subscribed to **all three** of `checkout.session.completed`, `charge.refunded`
and `checkout.session.expired`. Without the third, abandoned carts get no recovery
email — worth confirming in the Stripe dashboard while you are looking.

**Three scheduled functions** run daily: `cleanup-blobs` (04:00 UTC),
`gift-reminder` (09:00 UTC) and `review-request` (10:00 UTC). Their run history
is in the Netlify Functions log.

---

## 9. Known gaps — state these plainly, don't paper over them

- **The 3D blanket cloth is a plain waffle**, while the 2D preview and the
  photographs both show a woven pomegranate motif. This is the largest remaining
  visible difference between the render and the real piece.
- **Home v3's "first stitch" scene is parked** on purpose: the home hero is the
  LCP element and Lighthouse is a required check, so it needs measuring before and
  after rather than being folded into a content PR.
- **`next/font` was deliberately not adopted.** It hashes the family name it
  generates, and the Loom's canvas rasteriser looks its face up *by name*. Adopting
  it would silently change which typeface every stitch is charted from. The fonts
  are already self-hosted, which is most of what it buys.
- **Lighthouse performance is not a blocking gate**, because the site does not meet
  one. A gate above what the site scores is a gate somebody switches off.

---

## 10. How this work has actually gone right

Two habits are responsible for nearly every real bug found on this branch, and
they are worth continuing.

**Look at the output, not the code.** Almost every genuine defect here was found
by looking at a render, a cropped CI screenshot, a font list, a Lighthouse report
— not by reading source or logs. Examples: every Armenian letterform was coming
from an arbitrary system fallback because the display font has no Armenian
coverage at all; the poster generator had *never once succeeded* while logging
success; the site's own Content-Security-Policy was blocking the Google Ads
conversion beacon, so the shop was paying for clicks it could not fully attribute;
a photo strip on phones was a scroll region no keyboard could ever reach.

**Verify every new gate red before trusting it.** Break the thing the test is
meant to catch, watch the test fail, then put it back. A test that has never
failed is a decoration. This caught a screenshot comparison that was comparing
*no pixels at all*, and a review test that passed on the wrong render branch.

---

## 11. Good opening moves for a Cowork session

1. Open the deploy preview **on a phone** — that is where most of the new work
   lives, and where the keyboard-access bug was hiding.
2. Compare it against production side by side, so the owner can see what merging
   would actually change.
3. Walk the five owner-only items in section 3 and clear as many as possible.
4. Check the Stripe webhook's three event subscriptions.
5. Then pick from section 5 — Tier 1 is the honest next work.
