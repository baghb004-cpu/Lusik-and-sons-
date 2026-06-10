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
- [ ] **Chunk 2 — Immersive product page (the pill sheet).** Full-screen photo
      pager behind a draggable bottom sheet with three detents
      (collapsed pill / medium / expanded) — native SwiftUI drag gesture w/
      spring snapping, mirroring `ImmersiveBuySheet.tsx` (incl. tap-to-cycle
      and the photo-tap contract: card up → tap photo collapses; collapsed →
      tap opens lightbox). Configurator products (alphabet blanket, name bib)
      get a classic scroll page (parity with `SHEET.EXCLUDE_KEYS`).
- [ ] **Chunk 3 — Lightbox.** Zoomable full-photo viewer: pinch (anchored),
      double-tap zoom/reset, pan clamped to edges, swipe between photos,
      swipe-down to close. Native gestures make this MUCH easier than web.
- [ ] **Chunk 4 — Bag.** CartStore (ObservableObject + persistence), qty
      stepper, swipe-to-delete, bundle-savings line ($1/extra piece — mirror
      `_lib/bundle-discount.mjs` math), free-shipping-at-$150 progress, tap
      row → product page (parity with the web bag).
- [ ] **Chunk 5 — Checkout.** ZIP field → zone-rate estimate (mirror
      `_lib/shipping-zones.mjs` table), gift options + notes, POST
      `create-checkout-session` with the EXACT body shape (productKey, qty,
      ship_zip, gift, social_consent, idempotency_key), open `session.url`
      in SFSafariViewController, handle the `?order=success` return via a
      custom URL scheme or just detect navigation. Clear bag on success.
- [ ] **Chunk 6 — Liquid Glass chrome.** Floating tab pill with `.ultraThinMaterial`
      + the lens highlight over the active tab; breathe hint on first product
      open until first sheet interaction (UserDefaults flag — port the
      "seen isn't learned" rule).
- [ ] **Chunk 7 — Journal + chat.** Journal list/post rendering (port
      `journalPostsData` content nodes), "Text Lusik" chat via POST `/chat`.
- [ ] **Chunk 8 — Niceties.** Waitlist for placeholders, haptics
      (UIImpactFeedbackGenerator on add-to-bag — parity with `haptic.js`),
      reduced-motion checks, Dynamic Type pass, dark mode via brand tokens.
- [ ] **Chunk 9 — App Store prep.** App icon set (from `public/icon.svg`),
      launch screen, `PrivacyInfo.xcprivacy` (Required Reason API +
      data-collection declarations: purchases via Stripe, no tracking),
      App Store screenshots checklist, age rating, support URL
      (lusikandsons.com/contact).
- [ ] **Chunk 10 — TestFlight & submission guide.** Step-by-step doc:
      Apple Developer Program enrollment ($99/yr), bundle id
      `com.lusikandsons.app`, signing, archive → TestFlight, App Review
      notes (physical-goods checkout explanation), the 3.1.3(e) citation.

## Standing decisions (so future sessions don't re-litigate)

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
