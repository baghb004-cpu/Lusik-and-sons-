# Print pieces

Two things that go in every delivery box: a tri-fold brochure and a coupon sheet.
Both are plain HTML + CSS (no build step) rendered to PDF with headless Chromium.

```
print/
├── brochure/brochure.html   the tri-fold (US Letter landscape, two sides)
├── brochure/fonts/          Fraunces, DM Sans, Allura, Noto Sans/Serif Armenian (static woff2, self-hosted)
├── brochure/art/            QR code SVGs (site + Instagram)
├── coupons/coupons.html     the coupon sheet (US Letter portrait); the codes live at the top of this file
├── render.mjs               renders everything in out/
└── out/                     the PDFs to print
```

## Printing the brochure at home

1. Open `out/lusik-and-sons-brochure.pdf`.
2. Print on US Letter, **landscape**, **2-sided, flip on the short edge**, scale **100%** (not "fit to page").
   If side two comes out upside down, print again with "flip on the long edge" instead.
   Cardstock (65 to 80 lb) folds and feels best; plain paper works.
3. Fold: the small tick marks in the top and bottom margins show the two folds.
   Lay the sheet with the **inside** facing up (the side that starts with "The blankets"
   on the left). Fold the **right** flap ("Two matched sets") in over the middle panel
   first, then fold the **left** panel over it. The stack-of-blankets photo is now the
   front cover, the "how to place an order" panel is the back, and the story panel is
   the flap you see first when you open it. Do one test print and check that nothing
   near the outer edges is clipped before printing a stack.

Page 1 (outside), left to right: inside flap (story) | back cover (how to order) | front cover.
Page 2 (inside), left to right: blankets | bibs | more bibs, by request, care.

`out/lusik-and-sons-brochure-print-shop.pdf` is the same design on an 11.25 x 8.75 in
page with crop marks and a 1/8 in bleed margin. Give that one to a print shop; they
trim to 11 x 8.5 in.

## The coupon sheet

`out/lusik-and-sons-coupon-sheet.pdf` prints 1-sided, portrait, 100%.

**The three codes on it are placeholders, and the sheet prints a red DRAFT strip
across the top until you say otherwise.** Nothing in this repo or the inbox records
any promotion codes; codes are created and managed only in the Stripe dashboard, and
Stripe is the only place to see whether a code is still active. Before printing:

1. Stripe dashboard > Product catalog > Coupons > New coupon > tick
   "Use customer-facing coupon codes", create the code exactly as printed (or change
   the printed one), set the redemption limit and expiry.
2. Edit the `COUPONS` array and `VALID_THROUGH` at the top of `coupons/coupons.html`
   to match, set `CODES_CONFIRMED = true`, then re-render. The red strip disappears.
   Pick codes with no O/0 or I/1 look-alikes. Stripe cannot limit a code to a
   customer's first order on this checkout, and a percent-off coupon also discounts
   the gift-wrap line unless its "applies to" is restricted; honor the same rule by
   hand on phone and Instagram orders.

These codes work on every order, including bags of two or more pieces. That used
to be untrue: the automatic multi-piece savings were attached to the checkout as a
Stripe coupon, and Stripe hides the promotion-code box whenever a session already
carries one. The savings are now subtracted from the item prices instead, so the
promotion-code box is always there and a printed code stacks on top. Phone and
Instagram orders are honored by hand, as before.

## Re-rendering after an edit

```
npx playwright install chromium   # once, if Chromium is not already installed
node print/render.mjs             # writes print/out/*.pdf
node print/render.mjs --preview-dir /some/folder   # also writes PNG previews
```

Photos are referenced straight from `public/img/`, so re-rendering picks up any
photo you replace there. The render script refuses to write a PDF if any panel's
content overflows its margins, so a too-long edit fails loudly instead of printing
into the paper edge.

Fonts are static instances cut from the Google Fonts variable files with
fontTools (`pip install fonttools brotli`, then `fontTools.varLib.instancer`) so the
PDFs embed real TrueType subsets rather than Type3 outlines, which print-shop
preflight rejects. Add a weight by cutting another instance and declaring it in
`brochure/fonts/faces.css`. Keep the copy rules when editing: no em dashes, no
prices, colors-vary note on every product, lead time on every product, and no
explanation of why the lead times are what they are.

## Where the QR codes point

The site QR on the brochure points at `lusikandsons.com`, the home page.
There is now also a **`/welcome`** page built for exactly this moment:
someone standing there with the card, wanting to know how to order, why
the colour on the card is not exactly the colour that arrives, how long a
piece takes, what to do with a coupon code, and how to look after a piece
once it is theirs. It is written in this brochure's voice, with no em
dashes, and its lead times are read from the same board the site and the
confirmation emails use, so it cannot drift from the printed numbers.

If the brochure is ever reprinted, point the site QR at
`lusikandsons.com/welcome` instead. Until then the page stands on its own
and is listed in the sitemap.
