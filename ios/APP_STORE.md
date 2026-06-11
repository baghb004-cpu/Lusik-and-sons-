# App Store prep (Chunk 9)

What's already in the project from this chunk, and the listing material
to paste into App Store Connect. Enrollment, signing, TestFlight, and
the review-notes walkthrough are **Chunk 10** — this file is everything
you can prepare before touching Apple's site.

## Shipped in the project

| Piece | Where | Notes |
| --- | --- | --- |
| App icon (1024, opaque) | `LusikSons/Assets.xcassets/AppIcon.appiconset/` | Upscaled from the website's icon set — same placeholder monogram art. **To replace with final brand art: overwrite `AppIcon.png` (1024×1024, no transparency) — nothing else to change.** |
| Launch screen | `project.yml` → `UILaunchScreen` + `LaunchBackground` colorset | Solid brand cream (warm dark in dark mode) so launch blends straight into the app. |
| Privacy manifest | `LusikSons/PrivacyInfo.xcprivacy` | No tracking; UserDefaults (CA92.1); collected-data list for a guest-checkout shop. The App Store Connect privacy questionnaire MUST match it (table below). |

## App identity

- **Name:** Lusik & Sons
- **Subtitle** (30 chars max): `Hand-stitched Armenian gifts` (28)
- **Bundle ID:** `com.lusikandsons.app` (already in project.yml)
- **SKU:** `lusiksons-ios-001` (any unique string; this works)
- **Primary category:** Shopping · **Secondary:** Lifestyle
- **Price:** Free (it sells physical goods via Stripe — no IAP, see 3.1.3(e) in Chunk 10)

## URLs App Store Connect will ask for

- **Support URL:** `https://lusikandsons.com/contact`
- **Marketing URL** (optional): `https://lusikandsons.com`
- **Privacy Policy URL:** `https://lusikandsons.com/privacy` ✓ **live**
  (shipped as website PR #248 — the same policy the footer modal shows,
  including the CPRA do-not-share switch).

## Age rating questionnaire

Answer **None / No** to every content question (violence, sexual
content, profanity, horror, gambling, contests, drugs, medical,
unrestricted web access, user-generated content browsing — the chat is
1-on-1 with the shop's assistant, not a community). Result: **4+**.

## Privacy questionnaire (must mirror PrivacyInfo.xcprivacy)

| Data | Collected? | Linked to identity | Tracking | Purpose |
| --- | --- | --- | --- | --- |
| Email address | Yes | Yes | No | App functionality |
| Name | Yes | Yes | No | App functionality |
| Physical address | Yes | Yes | No | App functionality |
| Payment info | Yes (entered on Stripe's page) | Yes | No | App functionality |
| Purchase history | Yes | Yes | No | App functionality |
| Other user content (chat, gift notes) | Yes | Yes | No | App functionality |
| Everything else (location, contacts, identifiers, usage data, diagnostics…) | No | — | — | — |

"Do you or your partners use data for tracking?" → **No.**

## Screenshots checklist

iPhone-only app → one required size, one optional legacy size. Capture
in Simulator with **⌘S** (files land on the Desktop). Status bar looks
best at 9:41 with full battery (it is by default in Simulator).

**Required — 6.9" (iPhone 16 Pro Max, 1320×2868), portrait, 3–10 shots:**

1. **For You** — the brand front door (hero copy + contact cluster)
2. **Shop** — the four category cards
3. **Immersive product page** — Full Alphabet blanket, sheet at the
   collapsed pill so the photo fills the screen (the money shot)
4. **Immersive product page** — sheet at medium with the buy controls
5. **Bag** — two+ items so Bundle savings + the free-shipping bar show
6. **Checkout** — "Almost in Lusik's hands" with the gift options open
7. **Journal post** — an open post (Tatik's Hands reads beautifully)
8. *(Optional)* same shots in **dark mode** — the warm dark theme is a
   differentiator, worth two slots

**Optional — 6.5" (iPhone 15 Plus / 11 Pro Max, 1284×2778 or 1242×2688):**
re-capture shots 1–5 on that simulator, or let Connect scale the 6.9" set.

No iPad screenshots needed (`TARGETED_DEVICE_FAMILY: 1`). When the
iPhone Fold ships, capture the two-page product spread on its inner
display — the layouts are already built for it.

## Description draft (edit freely, it's your voice not mine)

> Hand cross-stitched Armenian alphabet blankets, name bibs, and
> heirloom gifts — made one at a time by Lusik in Southern California.
>
> Every piece is made to order: pick a blanket or bib, add the baby's
> name or initial in Armenian or English, and Lusik stitches it by hand
> over the next couple of weeks. You'll get a photo of the finished
> piece before it ships.
>
> • The Armenian Alphabet Blanket — Ա Բ Գ, cross-stitched corner to corner
> • The Full Alphabet Crib Blanket — all thirty-six letters, hand-knit
> • Name bibs, blessing bibs, and the Days-of-the-Week set
> • Bundle savings on every additional piece, free U.S. shipping over $150
> • Lusik's Journal — short posts on the alphabet, the craft, the symbols
> • Questions? Text Lusik right from the app
>
> Checkout is handled securely by Stripe. Made in California, rooted in
> Armenia, kept for generations.

**Keywords** (100 chars, comma-separated, no spaces needed):
`armenian,alphabet,blanket,baby,bib,gift,heirloom,cross-stitch,embroidery,baptism,christening,name`

## Before archiving (quick pre-flight)

- [ ] Replace `AppIcon.png` with final art (or accept the monogram for v1)
- [ ] `cd ios && xcodegen` after pulling this chunk (new assets + manifest enter the project)
- [ ] Bump `MARKETING_VERSION` in project.yml when you're ready to call it `1.0.0`
- [ ] Privacy policy URL exists on the website (the TODO above)
- [ ] Run once on a real iPhone — haptics and the glass blur read differently on hardware
