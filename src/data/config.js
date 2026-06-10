// ============================================================
// CONFIG — the dial board
// ============================================================
// One file, one source of truth for every tunable number, feature
// flag, support phone, and paid-feature credential. Adjust here,
// never inline at the call sites. Per CLAUDE.md § Conventions,
// this file MUST stay a single export — do NOT split it into
// smaller modules.
//
// duplicated in netlify/functions/_lib/pricing.mjs
// (FREE_SHIPPING_THRESHOLD_CENTS, GIFT_WRAP_PRICE_CENTS); the
// pricing-drift unit test guards those against silent drift.
// ============================================================

export const CONFIG = {
  // ============================================================
  // SWIPE GESTURES — cart drawer + per-row swipe-to-delete
  // ============================================================
  // Two gesture machines share the same intent-detection model:
  // (1) per-row leftward swipe to delete (SwipeableRow); (2) cart
  // drawer rightward swipe to dismiss. Keeping the tunables here
  // means both gestures stay in sync with each other so a tweak
  // to one doesn't accidentally desync the feel of the other.
  SWIPE: {
    CLAIM_DIST_PX:        12,   // px of movement before we decide whether the gesture is ours
    DELETE_THRESHOLD_PX:  44,   // leftward drag past this SNAPS the row open to reveal Delete (no auto-delete)
    REVEAL_WIDTH_PX:      92,   // width of the revealed red Delete button a row snaps open to
    DISMISS_THRESHOLD_PX: 100,  // rightward drag past this commits a drawer dismiss
    COMMIT_ANIM_MS:       180,  // off-screen slide on commit, before unmount / handler fires
  },

  // ============================================================
  // SHEET — the mobile photo-immersive product sheet (Apple-style)
  // ============================================================
  // Drives <ImmersiveBuySheet>: on phones a live product page becomes a
  // full-screen swipeable photo backdrop with a draggable bottom sheet
  // (the real buy controls) that snaps between three detents — collapsed
  // pill / medium / expanded — like Apple Maps / Find My. It layers BELOW
  // the bottom-nav island and stops above it, so the nav stays usable.
  //
  // LIVE since June 2026 for the photo-led products. EXCLUDE_KEYS keeps
  // the configurator-led products on the classic page: their value is the
  // live design preview + option pickers (alphabet/thread/name), which a
  // photo backdrop would bury behind a collapsed pill. New catalog
  // products get the sheet automatically once they have `images` — add
  // their key here to opt them out instead.
  SHEET: {
    IMMERSIVE_ENABLED:    true,
    EXCLUDE_KEYS:         ["blanket-alphabet", "bib-single"], // configurator products keep the classic page
    DEFAULT_DETENT:       "medium", // opening detent: "expanded" | "medium" | "collapsed"
    FLICK_VELOCITY_PX_MS: 0.6,    // |drag speed| past this = a flick (jumps a detent)
    STORAGE_PREFIX:       "lusik_sheet_detent_v1", // localStorage key prefix (per product)
  },

  // ============================================================
  // BACKEND — Netlify Database (Postgres) + Netlify Identity (auth)
  // ============================================================
  // No URLs or anon keys live here anymore. Identity reads its
  // config from <link rel="netlify-identity"> and from the site
  // it's deployed to; Netlify Functions are reached at the
  // relative /.netlify/functions/* path, so they work in local
  // dev (netlify dev) and production with zero changes.
  //
  // Base path for serverless functions. The leading slash is
  // intentional — browser-relative, so localhost and production
  // behave identically.
  FN_BASE: "/.netlify/functions",

  // File-upload caps for custom-embroidery image uploads.
  UPLOAD_MAX_BYTES: 5 * 1024 * 1024,
  UPLOAD_ACCEPTED_TYPES: ["image/png", "image/jpeg"],

  // File-upload caps for profile-photo uploads (smaller — these are avatars).
  AVATAR_MAX_BYTES: 2 * 1024 * 1024,
  AVATAR_ACCEPTED_TYPES: ["image/png", "image/jpeg", "image/webp"],

  // localStorage key for the guest cart. Persists cart across page refreshes
  // for users who haven't signed in yet.
  CART_STORAGE_KEY: "lusik_guest_cart_v1",

  // How long to wait after the last cart change before writing to the database.
  // Higher = fewer DB writes; lower = less data loss if user closes tab quickly.
  CART_PERSIST_DEBOUNCE_MS: 800,

  // ============================================================
  // FREE-SHIPPING PROGRESS BAR
  // ============================================================
  // Lusik offers free U.S. shipping on orders at or above this
  // threshold. The cart drawer renders a progress bar nudging
  // customers toward it. Set ENABLED to `false` to hide the bar
  // entirely if she ever decides not to run the promotion.
  //
  // Threshold is in cents to match the rest of the order math.
  // 15000 cents = $150 → roughly two blankets, or a blanket + a
  // bib + a bib. Adjust here when the promotion changes; nothing
  // else needs to be touched.
  FREE_SHIPPING_ENABLED: true,
  // 0 = free U.S. shipping on every order (no minimum). Mirrors
  // FREE_SHIPPING_THRESHOLD_CENTS in netlify/functions/_lib/pricing.mjs.
  FREE_SHIPPING_THRESHOLD_CENTS: 15000,

  // ============================================================
  // GIFT WRAP (optional add-on at checkout)
  // ============================================================
  // Customer opts in via the gift fieldset on CheckoutView. The
  // browser shows "+$X.XX" in the order summary; the server adds
  // a matching line item to the Stripe session so the customer is
  // actually charged for it. Both sides read this same number, so
  // there's only one place to change the price.
  //
  // Set to 0 to disable (the checkbox still renders but the line
  // item adds nothing — equivalent to "free gift wrap").
  GIFT_WRAP_PRICE_CENTS: 500,

  // ============================================================
  // DELIVERY & LOCAL PICKUP (product-page "details" disclosure)
  // ============================================================
  // Powers the Apple-style "Show delivery and pickup details"
  // collapsible on every product page (DeliveryPickupDetails).
  // DELIVERY_NOTE is always shown; the pickup row only renders when
  // LOCAL_PICKUP.ENABLED is true. Flip ENABLED to false to drop the
  // pickup line (and the word "pickup" disappears from the label).
  DELIVERY_NOTE: "Made to order — hand-stitched in ~2 weeks, then 3–5 business days in transit.",
  LOCAL_PICKUP: {
    ENABLED: true,
    AREA: "the Orange County & Los Angeles area only",
  },

  // ============================================================
  // LAUNCH PROMO — time-boxed "Founding Price" intro pricing
  // ============================================================
  // DISPLAY mirror of netlify/functions/_lib/launch-promo.mjs (the
  // server is what actually charges; this drives the struck-through
  // price + gold "Founding price" badge in the shop). The two files
  // are kept in lockstep by launch-promo-drift.test.mjs.
  //
  // enabled: false = fully dormant — no badge, no price change anywhere.
  // To run it: set enabled: true HERE AND in launch-promo.mjs, set the
  // startsAt/endsAt window, and deploy. Prices auto-revert at endsAt.
  //
  // FOUNDING_CENTS: productKey -> founding price in cents.
  // Must match the server file exactly.
  //
  // RETIRED June 2026 — superseded by a permanent base-price drop on the
  // bibs that took everyday prices below the old founding prices, so the
  // map is empty and the promo is off (must match launch-promo.mjs).
  LAUNCH_PROMO: {
    enabled: false,
    startsAt: "2026-06-05T00:00:00Z",
    endsAt:   "2026-06-12T00:00:00Z",
    label: "Founding price",
    FOUNDING_CENTS: {},
  },

  // ============================================================
  // BUNDLE DISCOUNT — "every extra piece saves $1"
  // ============================================================
  // DISPLAY mirror of netlify/functions/_lib/bundle-discount.mjs (the
  // server attaches the real Stripe coupon at checkout; this drives the
  // savings row in the bag + checkout summary). Kept in lockstep by
  // bundle-discount-drift.test.mjs. Storewide; the first unit is full
  // price, every unit after it takes PER_EXTRA_ITEM_CENTS off, capped
  // at MAX_DISCOUNT_CENTS. Gift wrap never counts. Tune the per-item
  // amount or flip ENABLED in BOTH files together.
  BUNDLE_DISCOUNT: {
    ENABLED: true,
    PER_EXTRA_ITEM_CENTS: 100,
    MAX_DISCOUNT_CENTS: 2500,
  },

  // ============================================================
  // PRIVACY-FIRST ANALYTICS (opt-in, empty by default)
  // ============================================================
  // Both values empty = no script loaded, no requests made, no
  // tracking. To turn analytics on:
  //
  //   1. Sign up for a free privacy-first analytics provider —
  //      Umami Cloud (umami.is) is the default this code is
  //      shaped for, but the same pattern works for any
  //      drop-in script tag (Plausible, Fathom, GoatCounter,
  //      Cloudflare Web Analytics, etc.).
  //   2. Paste the website ID from your dashboard into
  //      UMAMI_WEBSITE_ID below.
  //   3. If you're using something other than Umami Cloud,
  //      also update UMAMI_SRC_URL (Umami self-hosted, Plausible,
  //      etc. each ship their own script URL).
  //   4. Deploy. The script tag is injected on every page load,
  //      pageviews track automatically, and SPA navigation
  //      between views fires extra pageview events via the
  //      view-change effect in App.
  //
  // Privacy posture: Umami doesn't use cookies, doesn't track
  // cross-site, and doesn't collect personal data. Our own
  // Privacy Policy mentions this behavior when the website ID
  // is set; when it's empty, the policy reads as "we don't run
  // analytics" — both forms are accurate at the right time.
  ANALYTICS: {
    UMAMI_WEBSITE_ID: "",                            // paste from umami.is dashboard
    UMAMI_SRC_URL:    "https://cloud.umami.is/script.js",
    // Meta (Facebook/Instagram) Pixel. Paste the numeric Pixel ID from
    // Meta Events Manager (https://business.facebook.com/events_manager)
    // to enable conversion tracking for Instagram/Facebook ads. Empty =
    // off (no script loaded, no requests). When set, the base pixel
    // loads + fires PageView on every page, and the track() wrapper
    // forwards AddToCart / InitiateCheckout / Purchase so Meta can
    // optimize ad delivery and report real ROAS. The Pixel ID is a
    // public client-side identifier (not a secret), so it's fine here.
    //
    // CONSENT: both tags sit behind the CPRA do-not-share opt-out in
    // src/lib/adConsent.ts (the "Your privacy choices" footer link +
    // the switch inside the Privacy Policy). A stored opt-out or a
    // Global Privacy Control browser signal keeps them from loading.
    // The Privacy Policy's "Advertising pixels" section describes
    // exactly these two tags — if you add/remove one, update that
    // section in PolicyModal.jsx in the same change.
    META_PIXEL_ID: "1011469671814643",
    GOOGLE_ADS_ID: "AW-18161513091",
  },

  // ============================================================
  // PAID-FEATURE FLAGS — stubbed off, activate when ready
  // ============================================================
  // Each entry below points at a third-party service Lusik can
  // turn on later. The code at the call sites already checks the
  // flag and falls back to the current free behavior when it's
  // empty/false, so flipping one on doesn't require code edits
  // beyond pasting credentials. Pricing notes are based on
  // public 2026 plans — verify before turning anything on.
  //
  // PHILOSOPHY: business hasn't proven revenue yet, so every flag
  // here is off. As soon as orders are steady, the first one
  // worth turning on is REVIEWS (free Loox tier) — it boosts
  // conversion immediately and costs nothing until 100 orders/mo.
  // Second is EMAIL_MARKETING (Klaviyo free tier, 500 contacts)
  // for cart-abandonment + welcome flows. Everything else can
  // wait until revenue justifies it.
  // ============================================================
  PAID_FEATURES: {
    // -- Email marketing (Klaviyo) ----------------------------
    // Free up to 500 contacts / 500 emails per month, then
    // ~$45/mo for 1,500 contacts. Drop-in: paste the public API
    // key and the welcome flow + abandoned-cart flow start
    // working. The newsletter form already posts to
    // /.netlify/functions/newsletter (currently a no-op stub
    // that just returns 200); flip this on + wire the function
    // to forward to Klaviyo's /api/profiles endpoint.
    EMAIL_MARKETING: {
      ENABLED: false,
      KLAVIYO_PUBLIC_KEY: "",                        // pk_xxxxxx
      KLAVIYO_LIST_ID:    "",                        // newsletter list id
    },

    // -- Product reviews (Loox / Trustpilot / Judge.me) -------
    // Loox: free up to 100 orders/mo, $9.99/mo for 500 orders/mo.
    // Renders below the product gallery. When ENABLED is false,
    // the placeholder hook in ProductShowcase shows nothing.
    REVIEWS: {
      ENABLED: false,
      PROVIDER: "loox",                              // "loox" | "trustpilot" | "judgeme"
      WIDGET_ID: "",                                 // shop-domain or widget-id from provider
    },

    // -- Image CDN (Cloudinary) -------------------------------
    // Free up to 25 GB storage + 25 GB bandwidth/mo, ~$89/mo
    // after. Worth turning on once we replace the embedded
    // base64 product photos — those bloat index.html and slow
    // first paint. The PHOTO_* constants near line 570 would
    // shift from data: URIs to Cloudinary URLs (e.g.
    // https://res.cloudinary.com/<cloud>/image/upload/.../hero.jpg).
    IMAGE_CDN: {
      ENABLED: false,
      CLOUDINARY_CLOUD_NAME: "",                     // <your-cloud-name>
    },

    // -- Address autocomplete (Google Places) -----------------
    // $200/mo free credit covers ~17,000 address lookups. After
    // that, $0.017 per lookup. Reduces shipping-address typos
    // on the checkout form. When ENABLED is true, AddressEditor
    // would mount the Places JS API and bind it to the
    // street-line input.
    ADDRESS_AUTOCOMPLETE: {
      ENABLED: false,
      GOOGLE_PLACES_API_KEY: "",                     // restricted to lusikandsons.com
    },

    // -- Live chat (Crisp / Intercom / Tawk) ------------------
    // Crisp: free for 2 seats, ~$25/mo for unlimited. Tawk:
    // permanently free. Drop-in script tag injected from useEffect
    // in App when ENABLED. Replaces the "Text us" widget for
    // customers who prefer in-page chat.
    LIVE_CHAT: {
      ENABLED: false,
      PROVIDER: "tawk",                              // "tawk" | "crisp" | "intercom"
      PROPERTY_ID: "",
    },

    // -- Behavioral analytics (PostHog / Mixpanel) ------------
    // PostHog: 1M events/mo free, then $0.00031/event. Runs
    // alongside the Umami stub (which counts pageviews); this
    // is for funnels and session replay. PostHog includes free
    // session replay which is genuinely useful for figuring
    // out where customers get stuck in checkout.
    BEHAVIORAL_ANALYTICS: {
      ENABLED: false,
      POSTHOG_KEY: "",                               // phc_xxxxxxxxxx
      POSTHOG_HOST: "https://us.i.posthog.com",
    },

    // -- SMS notifications (Twilio) ---------------------------
    // ~$0.0079 per SMS in the US + $1.15/mo per number. We
    // already send emails via Resend (free). SMS is the next
    // step up: text Lusik when an order arrives. The webhook
    // function checks this flag and calls Twilio's REST API in
    // addition to the existing Resend email.
    SMS_NOTIFICATIONS: {
      ENABLED: false,
      TWILIO_ACCOUNT_SID: "",                        // set as env var server-side
      TWILIO_AUTH_TOKEN:  "",                        // set as env var server-side
      TWILIO_FROM_NUMBER: "",                        // e.g. +18185551234
      TWILIO_TO_NUMBER:   "",                        // Lusik's phone
    },

    // -- AI chat assistant (Anthropic / Claude) ---------------
    // Pay-as-you-go through the Anthropic API. Typical exchange
    // costs ~$0.0015 with Haiku 4.5 (the default), so 100 chats
    // a day = ~$5/mo. The server-side function (chat.mjs) caps
    // each visitor at 30 turns/day so a single tab can't run up
    // an unbounded bill.
    //
    // To turn on:
    //   1. Sign up at console.anthropic.com, generate an API key.
    //   2. Netlify → Site → Environment → ANTHROPIC_API_KEY.
    //   3. (Optional) CHAT_MODEL env var to pick a different
    //      model — defaults to claude-haiku-4-5-20251001.
    //   4. Flip ENABLED below to true. The floating chat button
    //      appears on every page; conversation history is held
    //      in memory only (refresh clears it).
    //
    // The system prompt + product knowledge live server-side in
    // chat.mjs, NOT here, so changing the assistant's behavior
    // doesn't require a frontend redeploy.
    CHAT_ASSISTANT: {
      ENABLED: false,
      LAUNCHER_LABEL: "Ask us anything",              // text on the floating button
      WELCOME: "Hello — I'm the Lusik & Sons assistant. Ask me about the alphabet blanket, the bibs, the towels, the colors Lusik works in, shipping, sizing, anything. If a question is best for Lusik herself, I'll tell you that too.",
      PLACEHOLDER: "Type your question…",
    },
  },

  // Gallery indexes whose source files are sideways and need a CSS-rotation
  // band-aid until the actual image files are replaced. Applies wherever
  // these gallery items render. Once you re-upload an image rotated correctly,
  // remove its index here and the rotation vanishes everywhere.
  //
  // After the May 2026 photo refresh, PRODUCT.gallery was entirely replaced
  // with 15 freshly-curated bib-free alphabet-blanket shots at
  // /img/abc-blanket/01..15.jpg — all already EXIF-rotated during ingest.
  // No display-time rotation is needed for any of them, so the set is empty.
  // (Kept as an empty Set rather than removing the field so the
  // galleryRotationStyle helper still has something to read.)
  ROTATED_GALLERY_INDEXES: new Set(),

  // Heart-burst feedback timings.
  HEART_BURST_LIFETIME_MS: 1100,

  // Floating "Text us" widget config. The phone number is the same one
  // shown elsewhere on the site — single source of truth lives here.
  TEXT_US: {
    phone_e164: "+17608742333",          // E.164 format, used in tel:/sms: links
    phone_display: "(760) 874-2333",     // pretty format, shown to users
    sms_prefill: "Hi Lusik & Sons — ",   // seeds the SMS body so threads are recognizable
    email: "hello@lusikandsons.com",     // contact email, used in mailto: links
    // ⚠️ TODO_LUSIK: paste your real Calendly scheduling link here.
    // Create a free event type at calendly.com (e.g. a 15-min
    // "Video call with Lusik"), then replace this placeholder URL —
    // nothing else needs to change. The "Book a video call" circle
    // on the mobile Shop page opens whatever URL lives here.
    calendly_url: "https://calendly.com/lusikandsons/video-call",
    headline: "Send us a text.",
    subhead: "Lusik or one of her sons writes back, usually within a day.",
  },
};
