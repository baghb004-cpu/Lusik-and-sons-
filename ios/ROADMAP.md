# Lusik & Sons — iOS App Roadmap (chunked for short sessions)

> **How to resume in ANY future Claude session, even a short one:**
> 1. Say: *"Continue the iOS app — check ios/ROADMAP.md on the ios-app branch and do the next unchecked chunk."*
> 2. The session checks out `ios-app`, reads this file, does ONE chunk, checks the box, commits, pushes `ios-app`.
> 3. You open the repo on your Mac, run `xcodegen` in `ios/`, build in Xcode, and report anything red back in the next session.
>
> **Branch rules:** ALL iOS work lives on the `ios-app` branch, under `ios/`.
> It is NEVER merged into `main` — the website cannot be affected by anything
> here. The web code on this branch is just a frozen reference for porting.

## Why this maps cleanly to an app

- The backend is already an API: `https://lusikandsons.com/.netlify/functions/*`
  (create-checkout-session, inventory, waitlist, chat). The app is a second
  client of the SAME server-trusted prices and Stripe flow.
- **Physical goods = Stripe stays.** Apple's App Review Guideline 3.1.3(e)
  allows web/Stripe checkout for physical goods — no In-App Purchase required,
  no 30% cut. Checkout opens the Stripe-hosted page in-app (SFSafariViewController),
  exactly like the website does in the browser.
- Product photos load from the live site (`https://lusikandsons.com/img/...`)
  via AsyncImage — no asset duplication while we iterate.

## The chunks

Each chunk ≈ one short session. Do them in order; each ends with: commit on
`ios-app`, push, update this checklist.

- [x] **Chunk 0 — Foundation (this commit).** Branch, this roadmap, README,
      XcodeGen `project.yml`, app entry + 4-tab shell, brand theme tokens
      (ink/cream/gold, Fraunces/DM Sans plan), exact product models
      (`ProductKey` mirrors `_lib/trusted-products.mjs` keys), catalog data
      for the 7 live products with live photo URLs, API client skeleton
      (checkout request shape incl. `ship_zip`, inventory). First Mac step:
      `brew install xcodegen && cd ios && xcodegen && open LusikSons.xcodeproj`.
- [x] **Chunk 1 — Shop.** Category index (4 cards — Blankets/Bibs live,
      Towels/For Baby coming-soon) → category product grid → classic product
      detail: swipeable photo pager, brand eyebrow/tagline copy, cap-variant
      toggle on the hy-em + bari sets (correct per-variant checkout keys),
      Add to Bag with haptic + tab badge, shipping/free-over-$150 note.
      Acceptance: browse all 7 live products with photos on simulator;
      adding to bag bumps the Bag tab badge.
- [x] **Chunk 2 — Immersive product page (the pill sheet).** Shipped:
      ImmersiveProductView — full-screen photo pager behind a draggable
      sheet with three detents (collapsed 76pt pill / 46% / 86%), spring
      snapping + 600pt/s flick threshold, tap-the-pill cycles detents,
      photo-tap contract (sheet up → collapse; collapsed → full-photo
      viewer placeholder that Chunk 3 makes zoomable), custom page dots
      riding the sheet top, per-product detent memory + the global
      gesture-learned flag (UserDefaults) for Chunk 6's breathe hint,
      reduced-motion honored, custom back button. Buy controls extracted
      to ProductBuyControls — ONE buy surface shared with the classic
      page (web parity). Routing switches on Product.presentation.
- [x] **Chunk 3 — Lightbox.** Shipped: PhotoViewer — UIScrollView-backed
      zoomable pages (anchored pinch 1×–4×, double-tap 2.5× into the tapped
      spot / double-tap reset, pan clamped + centered by UIKit), sideways
      paging between photos when unzoomed, pull-down-to-close (bounce
      threshold), ✕ button, hint line + counter (web copy parity). Wired
      into the immersive sheet's photo-tap contract; placeholder deleted.
- [x] **Chunk 4 — Bag.** Shipped: CartStore persistence (UserDefaults
      JSON, restored on launch) + the display mirrors of the server math
      (bundle savings: $1/extra unit, $25 cap, subtotal floor — exact
      bundle-discount.mjs parity; free-shipping progress at $150).
      BagView: rows with photo/title tapping back to the product page
      (ProductRoute — ONE presentation switch shared with the shop),
      qty stepper (1..99 clamp, accessibility-adjustable), swipe-to-
      delete, bundle-savings row + add-another nudge, free-shipping
      progress bar, empty state, Checkout button (Chunk-5 alert stub).
- [x] **Chunk 5 — Checkout.** Shipped: ShippingZones (exact Swift mirror
      of the server zone table/rates/transit), CheckoutView — summary with
      bundle savings + gift wrap line, REQUIRED ship ZIP w/ live zone
      estimate (Pay disabled without it; free-over-$150 skips it), gift
      options (message 140 / hide prices / wrap +$5), one-year reminder
      opt-in, notes (280), POST create-checkout-session with the exact web
      body shape + per-attempt idempotency key, Stripe hosted page in an
      in-app WKWebView watched for the ?order=success return → clear bag →
      thank-you state. DECISION RECORDED: WKWebView (reliable success
      detection, card payments work) over SFSafariViewController (Apple Pay
      but no return visibility); upgrading to Apple Pay later needs a tiny
      server-side app-return redirect = a website PR with explicit approval.
- [x] **Chunk 6 — Liquid Glass chrome.** Shipped: GlassTabBar — floating
      pill on .ultraThinMaterial with the warm cream tint (--lg-tint-island
      parity), bevel stroke + depth shadow, gliding lens capsule over the
      active tab (matchedGeometryEffect), bag count bubble, light haptic on
      switch, reduced-motion + a11y (selected traits). RootTabView keeps
      all four tabs ALIVE (ZStack) so nav state survives switching; every
      tab reserves GlassTabBar.clearance as a bottom safe-area inset so
      content scrolls UNDER the glass (photos bleed beneath it on the
      immersive pages — the web aesthetic, no band fix needed natively).
      Breathe hint ported to ImmersiveProductView: rise-and-settle on every
      product open until the guest moves the sheet once (the Chunk-2
      gesture-learned flag), canceled instantly by any real gesture,
      skipped under reduced motion.
- [x] **Chunk 7 — Journal + chat.** Shipped: the Journal tab —
      JournalPost model + a GENERATED data mirror
      (`ios/scripts/gen-journal-swift.mjs` ports the 7 posts from
      `src/data/journal-posts/*.md` with the web codegen's exact parse
      + ordering; re-run it when posts change), card list ("Read
      something new", gold-wash cover cards) → post page rendering the
      typed nodes (p / h2 / blockquote with the gold bar) + a
      "Keep reading" aside pushing the two other newest posts. Chat:
      ChatView — the web ChatAssistant natively (same welcome copy,
      bubbles, typing dots, optimistic send with rollback-on-error,
      per-install session id for the server's daily cap, AI
      disclaimer), POST `/chat` added to LusikAPI with typed errors.
      Chat is OFF server-side today (no ANTHROPIC_API_KEY), so a 503
      swaps the composer for the REAL channels — Text (760) 874-2333 /
      email — meaning the sheet is useful from day one. Contact.swift
      mirrors CONFIG.TEXT_US; For You gained the "Send us a text."
      cluster (sms: prefill link + assistant launcher).
- [x] **Chunk 8 — Niceties.** Shipped: WAITLIST — the four web
      placeholder products (towel-hand, towel-baptism, baby-swaddle,
      baby-bathrobe; keys + copy verbatim from catalog.js) as
      coming-soon cards inside the now-browsable Towels / For Baby
      categories → PlaceholderProductView with the "Currently
      unavailable / Price coming soon." bar and a one-field signup
      POSTing to the SAME /waitlist Function the site uses (app +
      site signups land in one Notify list per product), success
      state, mailto fallback. HAPTICS — Haptics.swift vocabulary
      (add/remove/step/tap/success) moved INTO CartStore mutations
      (web SiteProvider parity — every surface feels identical), plus
      a success buzz on order-complete and waitlist-joined. DARK
      MODE — every Brand color is now a light/dark pair mirroring
      :root[data-theme="dark"] (the ink↔cream inversion, warm dark
      surfaces, brighter dark gold) with new surface / shadow /
      glassBevel tokens replacing system .background fills and
      ink-colored shadows. DYNAMIC TYPE — Brand fonts scale relative
      to .body via UIFontMetrics; the glass island is capped at
      xxxLarge (fixed-chrome pattern, content scales freely).
      REDUCED MOTION — audited: tab lens, breathe hint, sheet
      snapping, chat dots/autoscroll all honor it. Drive-by: the bag
      footer now says Buena Park (matches the June-10 copy commits).
- [x] **Chunk 9 — App Store prep.** Shipped: Assets.xcassets with the
      1024×1024 opaque AppIcon (upscaled from the website's icon set —
      swap `AppIcon.png` when final brand art exists) + a
      LaunchBackground colorset (cream / warm-dark) wired into
      `UILaunchScreen`, so launch blends into the app;
      `PrivacyInfo.xcprivacy` (no tracking, UserDefaults CA92.1,
      collected-data declarations for the guest-checkout flow:
      email/name/address/payment-via-Stripe/purchases/user content —
      all app-functionality, none tracking); `ASSETCATALOG_COMPILER_
      APPICON_NAME` in project.yml; and `ios/APP_STORE.md` — the
      paste-ready listing pack: identity (name/subtitle/SKU/category),
      age rating answers (→ 4+), privacy-questionnaire table mirroring
      the manifest, the 6.9" screenshot shot list, description +
      keywords drafts, support/marketing URLs. ⚠️ ONE BLOCKER flagged:
      the site has no standalone privacy-policy URL (it's a footer
      modal) — App Store Connect requires one; needs a small `/privacy`
      route via a normal website PR before submission. Re-run
      `xcodegen` after pulling so the assets + manifest join the
      project.
- [ ] **Chunk 10 — TestFlight & submission guide.** Step-by-step doc:
      Apple Developer Program enrollment ($99/yr), bundle id
      `com.lusikandsons.app`, signing, archive → TestFlight, App Review
      notes (physical-goods checkout explanation), the 3.1.3(e) citation.

## Standing decisions (so future sessions don't re-litigate)

- **iPhone Fold readiness (June 2026, baked in).** The app is laid out for
  the book-style iPhone Fold ahead of launch: 7.8" 4:3 inner display +
  5.5" cover screen, horizontal fold, wider passport-like form factor.
  Mechanism: the inner display lands in the iPad-mini ballpark, so the
  opened posture arrives as the REGULAR horizontal size class — all
  adaptive rules key off that (no fold-specific API needed; they also
  light up on iPads/landscape Max today, which doubles as the test rig).
  The rules live in `Theme/FoldLayout.swift` ("the open book"): glass
  island stays a centered pill (max 430pt); immersive product pages
  become a two-page SPREAD (photos = left page, buy column = right page,
  no pill sheet/breathe hint — nothing is covered); shop/journal grids
  gain columns; prose/forms cap at readable column widths. Landscape was
  enabled in project.yml for the opened posture. The cover screen is just
  a small compact iPhone — the existing layouts. Test in any iPad
  simulator or iPad-mini-sized window until Apple ships Fold simulators.

- iOS 17 minimum, SwiftUI only, no third-party dependencies until Stripe
  return-handling forces a decision (it likely won't — physical goods).
- `ProductKey` raw values MUST equal `_lib/trusted-products.mjs` keys — the
  server rejects anything else at checkout.
- Prices in the app are DISPLAY ONLY (server reprices everything), same rule
  as the website. Mirror values, never invent.
- Photos: remote from production for now. Bundling/caching is a Chunk 8+ call.
- Accounts/sign-in (Netlify Identity) deliberately deferred — guest checkout
  first, like most v1 commerce apps. Revisit after TestFlight feedback.
- A `/catalog.json` public Netlify function (so app + site share one catalog
  source) is a GOOD idea but touches the website repo — only do it as a
  normal website PR with the user's explicit go-ahead, never from this branch.
