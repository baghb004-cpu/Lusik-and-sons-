# Lusik & Sons — iOS app (`ios-app` branch only)

A native SwiftUI app bringing the website's mobile experience — the immersive
photo product pages, the pill sheet, the zoom lightbox, the Liquid Glass
chrome — to the App Store. It talks to the SAME backend the website uses
(Netlify Functions + Stripe), so prices, inventory, and checkout stay
server-authoritative with zero duplication.

**This directory exists only on the `ios-app` branch and is never merged to
`main`. Nothing here can affect lusikandsons.com.**

## Working model (short sessions, chunked)

All planning state lives in [`ROADMAP.md`](./ROADMAP.md). Each Claude session
does one chunk and pushes. You verify on your Mac. To resume, tell any new
session: *"Continue the iOS app — ios/ROADMAP.md on the ios-app branch, next
unchecked chunk."*

## One-time Mac setup

1. Install Xcode from the App Store (free), open it once to accept licenses.
2. `brew install xcodegen` (generates the Xcode project from `project.yml`,
   so the repo never stores merge-hostile `.xcodeproj` noise).
3. ```bash
   git fetch origin ios-app && git checkout ios-app
   cd ios && xcodegen && open LusikSons.xcodeproj
   ```
4. Pick an iPhone simulator, press ⌘R. Report anything red to the next session.

## App Store path (the short version)

1. Enroll in the Apple Developer Program ($99/yr) — needs your legal/business
   identity (matches your LLC if you have one).
2. TestFlight first: archive → upload → install on your own iPhone.
3. Physical-goods checkout via Stripe's hosted page is allowed by App Review
   Guideline **3.1.3(e)** — the app never needs In-App Purchase. We'll cite
   this in the review notes (Chunk 10 writes that doc).
4. Submission needs: icon, screenshots, privacy declarations, support URL —
   all produced in Chunks 9–10.

## Fonts

The brand display font is Fraunces and body is DM Sans (both on Google Fonts,
SIL Open Font License — App Store redistribution is fine). Until the .ttf
files are added to `LusikSons/Resources/Fonts/` (Chunk 6), `Brand.font*`
falls back to the system serif/sans so everything still builds.
