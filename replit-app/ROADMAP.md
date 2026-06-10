# Lusik & Sons — Replit App Roadmap (chunked for short sessions)

> **How to resume in ANY future Claude session, even a short one:**
> 1. Say: *"Continue the Replit app — check replit-app/ROADMAP.md on the
>    `replit` branch and do the next unchecked chunk."*
> 2. The session checks out `replit`, reads this file, does ONE chunk,
>    checks the box, commits, pushes `replit`.
> 3. You open the repo on Replit (import the GitHub repo, pick the
>    `replit` branch) and press **Run** — `.replit` at the repo root
>    starts the Vite dev server from `replit-app/`. Report anything
>    broken back in the next session.
>
> **Branch rules:** ALL work lives on the `replit` branch, under
> `replit-app/` (plus the root `.replit` config). It is NEVER merged into
> `main` — the website cannot be affected by anything here. Everything
> else on this branch is a frozen reference: **`ios/` is the SwiftUI app
> this one mirrors chunk-for-chunk**, and `src/` + `app/` are the
> production website the iOS app itself was ported from.

## What this is

The iOS app (`ios/`), rebuilt identical as a web app Replit can run and
host: same four tabs, same Liquid Glass chrome, same immersive pill-sheet
product pages, same checkout — achieved with React + CSS instead of
SwiftUI. Where SwiftUI gives something for free (springs, materials,
haptics), this app recreates it (CSS spring curves, backdrop-filter,
navigator.vibrate). One design, two runtimes.

- **Stack:** Vite + React 18, plain CSS on custom properties (no UI
  framework — the glass is hand-built, like the website's). Dependencies
  stay minimal so Replit cold-starts fast.
- **Backend:** the SAME live Netlify Functions the website and iOS app
  use (`https://lusikandsons.com/.netlify/functions/*`). Server-trusted
  prices, same `productKey` contract, same Stripe hosted checkout.
- **Design source of truth:** the matching Swift file in `ios/` for every
  view, and `replit-app/src/styles/tokens.css` for every color/face
  (the CSS mirror of `Brand.swift`).

## Fold readiness (baked into every chunk)

Written ahead of the book-style **iPhone Fold** — 7.8" 4:3 inner display,
5.5" cover screen, horizontal fold, wider passport-like form factor —
mirroring `ios/LusikSons/Theme/FoldLayout.swift` ("the open book"):

- `useFoldLayout()` + the `(min-width: 700px), (horizontal-viewport-segments: 2)`
  media query are the ONE signal for the unfolded canvas (they also catch
  tablets and fold-posture-reporting browsers).
- Expanded rules every chunk must honor: the glass island stays a
  centered ≤430px pill; photo-led product pages render as a **two-page
  spread** (photos = left page, buy column = right page — no pill sheet);
  grids gain columns; prose/forms cap at readable columns (640/700px).
- The 5.5" cover screen is simply a small phone — the compact layouts.

## The chunks

Each chunk ≈ one short session, mirroring the iOS list one-for-one. Do
them in order; each ends with: commit on `replit`, push, update this
checklist. The matching iOS chunk is the spec — open the Swift file and
port its behavior.

- [x] **Chunk 0 — Foundation (this commit).** Branch, this roadmap,
      README, root `.replit` run config, Vite + React scaffold, brand
      tokens CSS (light/dark pairs mirroring Brand.swift), the four-tab
      shell with kept-alive surfaces, the Liquid Glass island with the
      gliding lens + tap haptic + bag-badge plumbing, `haptics.js`
      (Haptics.swift vocabulary on navigator.vibrate), `useFoldLayout()`
      + fold breakpoints, For You placeholder with the live contact
      cluster (sms:/mailto, CONFIG.TEXT_US strings). Run: import repo on
      Replit → `replit` branch → Run. Local: `cd replit-app && npm
      install && npm run dev`.
- [ ] **Chunk 1 — Shop.** Port `ShopView.swift`: category index (2×2 on
      the open book), category product grids (adaptive columns), classic
      product detail with photo pager, cap-variant toggle, Add to Bag.
      Catalog data ports from `Catalog.swift` (live photo URLs from
      production). Client-side routing decision lands here (likely
      hash-based, no router dependency).
- [ ] **Chunk 2 — Immersive product page (the pill sheet).** Port
      `ImmersiveProductView.swift`: full-screen photo pager behind a
      draggable sheet with three detents, spring snapping + flick
      threshold (pointer events + CSS spring curves), tap-the-pill
      cycles detents, photo-tap contract, per-product detent memory
      (localStorage), reduced-motion honored. **Unfolded: the two-page
      spread instead — photos left, buy column right, no sheet.**
- [ ] **Chunk 3 — Lightbox.** Port `PhotoViewer.swift`: zoomable photo
      viewer (pinch via pointer events, double-tap zoom, pan clamped,
      sideways paging when unzoomed, pull-down-to-close, ✕, counter).
- [ ] **Chunk 4 — Bag.** Port `Cart.swift` + `BagView.swift`: cart store
      with localStorage persistence, the display mirrors of the server
      math (bundle savings $1/extra capped $25, free shipping at $150),
      rows tapping back to products, qty stepper, swipe-to-delete,
      progress bar, empty state. Haptics in the store mutations.
- [ ] **Chunk 5 — Checkout.** Port `CheckoutView.swift` +
      `ShippingZones.swift`: zone table mirror, required ship ZIP with
      live estimate, gift options, reminder opt-in, notes, POST
      create-checkout-session (same body shape + idempotency key),
      Stripe hosted page via redirect, `?order=success` return clears
      the bag → thank-you state (success haptic).
- [ ] **Chunk 6 — Liquid Glass polish.** Finish the chrome to match
      `GlassTabBar.swift` + the breathe hint: refraction-grade glass,
      lens spring tuning, the sheet's rise-and-settle teaching hint
      until first use (gesture-learned flag), reduced-motion paths.
- [ ] **Chunk 7 — Journal + chat.** Port `JournalView.swift` +
      `ChatView.swift`: journal data generated from the markdown posts
      (reuse `ios/scripts/gen-journal-swift.mjs`'s parse as a JS
      module), card list (pairs up on the open book), post pages with
      typed nodes, Keep-reading aside; the chat sheet over POST /chat
      with the 503 → real-channels fallback.
- [ ] **Chunk 8 — Niceties.** Port the Chunk-8 iOS set: waitlist for the
      four placeholder products (same /waitlist Function + keys), haptic
      pass, dark mode audit (tokens already pair — verify every
      surface), type scaling audit, reduced-motion audit.
- [ ] **Chunk 9 — PWA prep.** The web sibling of App Store prep:
      manifest + icons (reuse the site's icon set), installability
      (Add to Home Screen), offline shell decision, meta/OG tags,
      Lighthouse pass.
- [ ] **Chunk 10 — Ship guide.** Step-by-step doc: Replit deployment
      (autoscale config is already in `.replit`), custom domain
      (app.lusikandsons.com), and the CORS note (if the Netlify
      Functions ever lock down origins, the Replit domain must be
      allowed — a website PR with explicit approval).

## Standing decisions (so future sessions don't re-litigate)

- **The iOS app is the spec.** When a behavior question comes up, open
  the matching Swift file in `ios/` and do what it does. Divergence only
  where the platform demands it (e.g., Stripe return handling uses a
  redirect, not a WKWebView).
- `productKey` strings MUST equal `_lib/trusted-products.mjs` keys — the
  server rejects anything else at checkout. Prices are DISPLAY ONLY.
- Photos load from production (`https://lusikandsons.com/img/...`) — no
  asset duplication.
- No UI-framework dependencies. React + hand-rolled CSS keeps the glass
  honest and the Replit cold-start fast. New deps need a reason recorded
  here.
- Haptics: `navigator.vibrate` (Android real, iOS Safari silently
  no-ops). Visual feedback must always accompany a buzz so iPhones lose
  nothing.
- Fold rules are non-optional: every new surface ships its compact AND
  expanded ("open book") layout in the same chunk.
- Accounts/sign-in deferred, guest checkout first — same call as iOS.
