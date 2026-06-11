"use client";

// ============================================================
// CheckoutView — the checkout step before Stripe takes over
// ============================================================
// Shows the order summary (display-only, no qty controls),
// gift options (is_gift / message / hide_prices / wrap),
// gift-reminder opt-in, social-share consent, then POSTs the
// cart to /.netlify/functions/create-checkout-session and
// redirects to the Stripe-hosted URL.
//
// Cart-ID shape (mapLegacyId) is load-bearing for the server's
// TRUSTED_PRODUCTS map — see src/lib/cartId.js for the rules.
//
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import { CONFIG } from "../data/config.js";
import { SOCIAL_CONSENT_PLATFORMS } from "../data/socialConsentPlatforms";
import { estimateShippingForZip, SHIPPING_FROM_DOLLARS, SHIPPING_TO_DOLLARS } from "../data/shippingZones.js";
import { bundleSavingsForCart } from "../lib/bundleDiscount.js";
import { auth } from "../lib/auth.js";
import { db } from "../lib/db.js";
import { track } from "../lib/analytics.js";
import { mapLegacyId } from "../lib/cartId";
import { CartItemThumb } from "./CartItemThumb.jsx";
import { PaymentMethodsRow } from "./PaymentMethodsRow.jsx";
import { CollapsibleCard } from "./CollapsibleCard.jsx";
import { ArrowRight } from "./icons.jsx";
import { PRODUCT } from "../data/product.js";

// Generate a UUID for Stripe idempotency keys. crypto.randomUUID is
// available in all evergreen browsers (Chrome 92+, Safari 15.4+,
// Firefox 95+) and in any secure context (https or localhost). The
// fallback covers exotic embedded WebViews that don't expose the
// API yet — collision-resistant enough for a deduplication key with
// a few-minute TTL on Stripe's side (24h).
function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return (
    Date.now().toString(36) + "-" +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  );
}

export function CheckoutView({ cart, subtotal, user, profile, onBack }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Stripe idempotency key — generated once per checkout attempt and
  // re-sent on retries until the request fully succeeds (then we mint
  // a fresh one). Without this, if the first POST reaches the server
  // but the network drops before the response, a retry creates a
  // SECOND Stripe Checkout Session and the customer can pay twice.
  // With the same key, Stripe returns the original session URL.
  const idempotencyKeyRef = useRef(newIdempotencyKey());

  // If the customer empties the cart from inside checkout (deleting
  // every line item via the X / minus-on-1 / swipe), bounce back to
  // the home view rather than render an empty "Almost there" page
  // with no items to pay for. onBack() resets view → "home".
  useEffect(() => {
    if (cart.length === 0) onBack?.();
  }, [cart.length, onBack]);

  // --- GIFT OPTIONS (optional) ---
  // The baby-blanket category is overwhelmingly gift purchases, so
  // these fields are first-class rather than buried in a "notes"
  // textbox. Three independent toggles + a 140-char message that
  // fits on the small thank-you card Lusik includes in the box:
  //
  //   giftIsGift        — flips the whole block on. Default off
  //                       because most checkouts are for the buyer.
  //   giftMessage       — short note printed/handwritten on the
  //                       included card. Max 140 chars so it stays
  //                       legible on a 3"x5" card.
  //   giftHidePrices    — Lusik reads this and excludes the packing
  //                       slip pricing when shipping. Stripe's email
  //                       receipt still goes to the buyer regardless;
  //                       this controls what's in the BOX.
  //
  // Everything ships to the Function as `gift` and ends up in
  // orders.metadata + a JSONB column the webhook can stamp.
  const [giftIsGift,     setGiftIsGift]     = useState(false);
  const [giftMessage,    setGiftMessage]    = useState("");
  const [giftHidePrices, setGiftHidePrices] = useState(false);
  // Gift wrap: optional add-on. Price defined once in CONFIG.GIFT_WRAP_PRICE_CENTS;
  // browser shows the line in the order summary, server adds a matching Stripe
  // line item so the customer is actually charged. Gated on giftIsGift in three
  // places (the checkbox only renders inside the gift block, the order-summary
  // line is conditional on giftIsGift && giftWrap, and the payload sends
  // `wrap: giftIsGift && giftWrap`). The mirror server-side gate in
  // create-checkout-session.mjs also requires `is_gift === true`. To allow
  // wrap on non-gift purchases, you'd have to flip all four gates together.
  const [giftWrap, setGiftWrap] = useState(false);

  // --- ONE-YEAR REMINDER (optional, opt-in) ---
  // Default off. If ticked, the order row carries gift_reminder_opt_in = true
  // and a daily scheduled job emails the customer about 11 months later.
  // Independent of giftIsGift — works for self-purchases too (the buyer's
  // own baby growing up, repeat gifting, etc.). One-shot: once sent, never
  // re-sent. Unsubscribe link in every email turns it off without sign-in.
  const [giftReminderOptIn, setGiftReminderOptIn] = useState(false);

  // --- CUSTOMER NOTES FOR LUSIK (optional) ---
  // Free-form text the customer can leave for Lusik that ISN'T a gift
  // message ("please rush — birthday on the 14th", "no perfume in the
  // package, baby has sensitive skin", "can you include a card that
  // says 'welcome'"). Distinct from giftMessage, which goes ON the
  // gift card. customerNotes is for Lusik herself. Capped at 280
  // chars — tweet-length, enough to be useful, short enough to avoid
  // abusive payloads. Server re-validates length + strips control
  // chars before persisting.
  const [customerNotes, setCustomerNotes] = useState("");
  const CUSTOMER_NOTES_MAX = 280;

  // --- SHIPPING ZIP (drives the zone-priced rate) ---
  // Hosted Stripe Checkout fixes its shipping options at session-
  // creation time, so the destination ZIP has to be known BEFORE the
  // hand-off. Below the free-shipping threshold the ZIP is required —
  // it's what makes a Florida order pay Florida shipping instead of a
  // flat fee. The estimate shown here comes from the browser mirror
  // (src/data/shippingZones.js); the server recomputes from its own
  // copy (drift-tested) so a tampered ZIP can't change the charge.
  const [shipZip, setShipZip] = useState("");
  const shipZipValid = /^\d{5}$/.test(shipZip);
  const freeShipping = Math.round(subtotal * 100) >= CONFIG.FREE_SHIPPING_THRESHOLD_CENTS;
  const shipEstimate = !freeShipping && shipZipValid ? estimateShippingForZip(shipZip) : null;
  const zipNeeded = !freeShipping && !shipZipValid;

  // City/state confirmation for the typed ZIP ("Cypress, CA" echoes as
  // they finish typing) — catches a typo'd ZIP before it prices the
  // wrong shipping zone. First-party lookup via db.lookupZip; display
  // only and NEVER blocks payment: an unknown ZIP gets a gentle
  // double-check note, a failed lookup shows nothing at all.
  const [zipPlace, setZipPlace] = useState(null);          // { city, state } | null
  const [zipUnrecognized, setZipUnrecognized] = useState(false);
  useEffect(() => {
    setZipPlace(null);
    setZipUnrecognized(false);
    if (!shipZipValid) return undefined;
    let stale = false;
    const timer = setTimeout(() => {
      db.lookupZip(shipZip).then(({ place, notFound }) => {
        if (stale) return;
        setZipPlace(place);
        setZipUnrecognized(notFound);
      });
    }, 220);
    return () => { stale = true; clearTimeout(timer); };
  }, [shipZip, shipZipValid]);

  // Bundle savings (display mirror — the server attaches the real
  // Stripe coupon). $1 off per piece beyond the first, storewide.
  const bundle = bundleSavingsForCart(cart, subtotal);

  // --- SOCIAL-SHARE CONSENT (optional, opt-in) ---
  // Default everything OFF — affirmative opt-in is the only thing
  // that grants Lusik permission to share photos of the customer's
  // finished order on social media. Four independent fields,
  // persisted with the order so Lusik knows what's allowed when she
  // goes to post:
  //   socialAllow      : true only after the customer ticks the box
  //   socialPlatforms  : subset of SOCIAL_CONSENT_PLATFORMS ids they OK'd
  //   socialHandles    : { [platformId]: "@handle" } — keyed by
  //                      platform because almost nobody uses the same
  //                      handle on Instagram, TikTok, Facebook, and
  //                      YouTube. We preserve typed handles across
  //                      toggling a platform off-then-on so a misclick
  //                      doesn't make the customer retype, but at
  //                      submit time we only include handles for
  //                      platforms that are currently checked.
  // Sent to the Function as `social_consent` under the snake_case
  // convention used by the rest of the order metadata.
  const [socialAllow, setSocialAllow] = useState(false);
  const [socialPlatforms, setSocialPlatforms] = useState([]);
  const [socialHandles, setSocialHandles] = useState({});
  const toggleSocialPlatform = (id) => {
    setSocialPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };
  const updateSocialHandle = (id, value) => {
    setSocialHandles((prev) => ({ ...prev, [id]: value }));
  };

  // NOTE: this is the one deliberate exception to the "all Function calls go
  // through src/lib/db" rule. Checkout needs two things the generic db.call()
  // wrapper drops: the cache-bust query param below, and the rich error body
  // ({ code, param, message }) the catch block renders for hands-free debugging
  // on branch deploys. Keep it inline.
  //
  // Relative path — works in `netlify dev` locally and in production
  // with zero changes. The Function reads the Identity JWT from the
  // Authorization header (set below) when present, otherwise treats
  // the order as a guest checkout.
  // Cache-bust query param so Safari can't serve a stale POST
  // response between deploys. The function ignores unknown params.
  const checkoutFnUrl = `${CONFIG.FN_BASE}/create-checkout-session?v=${Date.now()}`;

  const handleCheckout = async () => {
    setBusy(true);
    setError("");
    track("checkout-start", { itemCount: cart.length, totalCents: Math.round(subtotal * 100) });

    // Build the cart payload. Strip the giant base64 image data — the
    // Function doesn't need it for the Stripe session (Stripe metadata
    // has a 500-char cap per value). The full custom image stays in
    // cart state and is recovered via Netlify Blobs on the order side.
    // For now, we just mark which items are custom; image upload to
    // Blobs is a future polish.
    const safeCart = cart.map((item) => ({
      productKey: item.productKey ?? mapLegacyId(item.id),
      id: item.id,
      qty: item.qty,
      subtitle: item.subtitle,
      size: item.size ?? null,
      colorHex: item.colorHex ?? null,
      isCustom: !!item.isCustom,
      customImageName: item.customImageName ?? null,
      // Always forward customMetadata if it exists. For custom-image uploads,
      // we add size/filename info. For blanket orders, the cart's own
      // customMetadata holds the alphabet + diagonal choice. For everything
      // else, it's null. This metadata is what flows to Lusik's order email
      // via Stripe → webhook → orders.order_items.custom_metadata.
      customMetadata: item.customMetadata
        ? item.customMetadata
        : (item.isCustom
          ? { size: item.size, image_filename: item.customImageName }
          : null),
    }));

    // If the user is signed in, attach their Identity JWT so the
    // Function can stamp the order with their user_id. Guests still
    // check out fine — no header is sent in that case.
    const headers = { "Content-Type": "application/json" };
    try {
      const token = await auth.getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    } catch { /* ignore — guest checkout */ }

    try {
      const res = await fetch(checkoutFnUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          cart: safeCart,
          userId: user?.id ?? null,
          customerEmail: user?.email ?? profile?.email ?? null,
          prefilledAddress: null, // future: pull from default saved address
          // Optional gift options. The webhook persists these on the
          // order so Lusik sees them in her admin view. When not a
          // gift, all fields are explicit defaults so the order
          // record clearly reads "not a gift" rather than "unknown."
          gift: {
            is_gift:      giftIsGift,
            message:      giftIsGift ? giftMessage.trim() : "",
            hide_prices:  giftIsGift ? giftHidePrices : false,
            wrap:         giftIsGift && giftWrap,
          },
          // Customer's one-year reminder opt-in. Stored verbatim on the
          // order row by the webhook; a daily scheduled function reads
          // it later. Nothing else here depends on this — declining
          // doesn't affect checkout.
          gift_reminder_opt_in: giftReminderOptIn,
          // Optional social-share consent. The stripe-webhook Function
          // persists this on the order row in orders.social_consent (JSONB)
          // when checkout completes, so Lusik sees it in her admin view.
          // `allowed: false` is the legally-meaningful default — if the
          // customer didn't tick the box, no permission was granted.
          // `handles` is keyed by platform id; only platforms currently
          // checked are included, and empty strings are dropped, so the
          // saved record is exactly what Lusik should act on.
          social_consent: {
            allowed: socialAllow,
            platforms: socialAllow ? socialPlatforms : [],
            handles: socialAllow
              ? Object.fromEntries(
                  socialPlatforms
                    .map((p) => [p, (socialHandles[p] ?? "").trim()])
                    .filter(([, v]) => v.length > 0)
                )
              : {},
            consented_at: socialAllow ? new Date().toISOString() : null,
          },
          // Optional free-form customer note. Server caps + strips
          // control chars; sending an empty string is fine, the
          // server stores NULL in that case.
          customer_notes: customerNotes.trim().slice(0, CUSTOMER_NOTES_MAX),
          // Destination ZIP for the zone-priced shipping rate. The
          // server validates the shape and recomputes the rate from
          // its own zone table — this only tells it WHERE, not how much.
          ship_zip: shipZipValid ? shipZip : null,
          // Idempotency key — forwarded to Stripe so a retried POST
          // (or a tap that the customer thinks didn't register)
          // returns the original Checkout Session URL instead of
          // creating a second one. Held in a ref so React re-renders
          // during the in-flight request don't mint a new key.
          idempotency_key: idempotencyKeyRef.current,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        // In prod the server returns just { error }; on branch deploys /
        // netlify dev it also returns { code, param, message } for
        // hands-free debugging. Render whatever came back.
        const detail = [errBody?.code, errBody?.param, errBody?.message]
          .filter(Boolean)
          .join(" · ");
        const msg = detail
          ? `${errBody?.error || "Checkout failed"} (${detail})`
          : errBody?.error || `Checkout failed (HTTP ${res.status})`;
        throw new Error(msg);
      }
      const { url } = await res.json();
      if (!url) throw new Error("No checkout URL returned");
      // Stash the order value so the Meta Pixel Purchase event can report a
      // real conversion value on the /?order=success return — by then the cart
      // is cleared, so there's nothing left to read. sessionStorage survives
      // the Stripe round-trip in the same tab; consumed + removed in
      // app/providers.tsx. Best-effort: a $0 Purchase is better than no render.
      try {
        sessionStorage.setItem(
          "lusik_purchase_value_v1",
          JSON.stringify({ value: Math.round(subtotal * 100) / 100, currency: "USD" }),
        );
      } catch { /* storage blocked — Purchase fires without value */ }
      window.location.href = url; // hand off to Stripe
    } catch (err) {
      setError(err?.message || "Couldn't start checkout. Please try again or contact us.");
      setBusy(false);
    }
  };

  return (
    // max-w: 5xl on desktop (the 2-col grid), but the single-column form
    // narrows to a readable 2xl on the open-book canvas (iPhone Fold inner
    // display / 768–1023px) instead of stretching inputs across 4:3.
    <div className="fade-in max-w-5xl md:max-w-2xl lg:max-w-5xl mx-auto px-6 lg:px-12 pt-10 lg:pt-16 pb-[150px] lg:pb-16">
      <button onClick={onBack} className="text-sm tracking-wide opacity-70 hover:opacity-100 mb-8">← Continue shopping</button>
      {/* min-w-0 on both grid children is load-bearing: CSS Grid items
          default to min-width: auto, which means they refuse to shrink
          below the intrinsic max-content width of their content (a
          paragraph's "longest line if it didn't wrap"). On a narrow
          portrait phone viewport (~390px) that intrinsic width can
          exceed the viewport, pushing the layout past the right edge
          even though the parent had px-6 padding to spare. Landscape
          (~844px) doesn't surface the bug because the column is wide
          enough to satisfy the unwrapped intrinsic width. */}
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
        <div className="min-w-0">
          <h1 className="font-display text-4xl lg:text-5xl mb-3" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>Almost in Lusik's hands.</h1>
          <p className="text-base lg:text-lg opacity-80 leading-relaxed mb-8">
            We'll send you to our secure checkout, powered by Stripe — Apple Pay, Google Pay, and every major card. Shipping and tax are calculated on the next page. Lusik begins on your piece the same week the order comes through.
          </p>
          {user ? (
            <p className="text-sm opacity-70 mb-6 italic">Signing in as <span style={{ fontWeight: 500 }}>{user.email}</span> — your order will appear in your account.</p>
          ) : (
            <p className="text-sm opacity-70 mb-6 italic">Checking out as a guest. Sign in or make an account if you'd like to track your order later.</p>
          )}

          {error && (
            <div className="text-sm p-3 mb-6" style={{ background: "rgba(139,44,44,0.08)", border: "1px solid rgba(139,44,44,0.25)", color: "#8B2C2C" }}>
              {error}
            </div>
          )}

          {/* ============================================================
              OPTIONAL: GIFT OPTIONS
              ============================================================
              Most baby-blanket orders are gifts. This block lets the
              buyer turn that on first-class — short message printed
              on Lusik's included card, and a flag that tells her to
              omit prices from the packing slip in the box. When the
              headline checkbox is off, no gift metadata is sent. */}
          <CollapsibleCard eyebrow="Optional" title="Gift options" className="mb-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={giftIsGift}
                onChange={(e) => setGiftIsGift(e.target.checked)}
                className="mt-0.5 w-4 h-4 flex-shrink-0"
                style={{ accentColor: "var(--accent)" }}
              />
              <span className="text-sm leading-snug">
                <span style={{ fontWeight: 500 }}>This is a gift.</span>
                <span className="block text-xs opacity-65 mt-1 leading-relaxed">
                  Lusik will include a small handwritten card with your message. You can also ask her to leave prices off the packing slip so the recipient never sees what was paid.
                </span>
              </span>
            </label>

            {giftIsGift && (
              <div className="mt-4 pt-4" style={{ borderTop: "1px dashed rgba(176,136,66,0.3)" }}>
                <label className="block mb-4">
                  <span className="text-[0.6rem] tracking-[0.25em] uppercase opacity-70 block mb-1.5">Message for the card <span className="normal-case tracking-normal opacity-70">(optional)</span></span>
                  <textarea
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value.slice(0, 140))}
                    maxLength={140}
                    rows={3}
                    placeholder="With all our love, Mom and Dad."
                    className="w-full px-3 py-2.5 text-sm resize-none"
                    style={{ border: "1px solid var(--border-strong)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
                    aria-label="Gift message for the included card"
                  />
                  <span className="text-[0.6rem] opacity-55 mt-1 block tabular-nums">{giftMessage.length}/140</span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={giftHidePrices}
                    onChange={(e) => setGiftHidePrices(e.target.checked)}
                    className="mt-0.5 w-4 h-4 flex-shrink-0"
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <span className="text-xs leading-snug">
                    Hide prices from the packing slip inside the box.
                    <span className="block opacity-65 mt-0.5">
                      Your email receipt still goes to you with the total — this only affects what's printed and shipped with the order.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer mt-3">
                  <input
                    type="checkbox"
                    checked={giftWrap}
                    onChange={(e) => setGiftWrap(e.target.checked)}
                    className="mt-0.5 w-4 h-4 flex-shrink-0"
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <span className="text-xs leading-snug">
                    <span style={{ fontWeight: 500 }}>Add gift wrap</span>
                    <span className="tabular-nums opacity-80"> (+${(CONFIG.GIFT_WRAP_PRICE_CENTS / 100).toFixed(2)})</span>
                    <span className="block opacity-65 mt-0.5">
                      Lusik will wrap the piece in soft tissue and twine, with the card tucked inside. Ready to give.
                    </span>
                  </span>
                </label>
                <p className="text-[0.65rem] opacity-55 mt-3 italic leading-snug">
                  Shipping address is collected on the next page — if you're sending this to someone else, use their address there.
                </p>
              </div>
            )}
          </CollapsibleCard>

          {/* ============================================================
              OPTIONAL: A SHORT NOTE FOR LUSIK
              ============================================================
              Separate from the gift card message above — this is a
              note for Lusik herself, not the recipient. Things like
              "please rush — birthday on the 14th", "no perfume in
              the package, baby has sensitive skin", "the name is
              pronounced O-len, not OH-len, in case that matters."
              Capped at 280 chars (server enforces too). Optional —
              empty string is fine, customers who don't need to say
              anything just skip this box.
              ============================================================ */}
          <CollapsibleCard eyebrow="Optional" title="A short note for Lusik" className="mb-4">
            <label className="block">
              <p className="text-xs opacity-65 mb-3 leading-snug">
                Anything she should know? Pronunciations, rush requests, sensitivities, special timing. She reads every one.
              </p>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value.slice(0, CUSTOMER_NOTES_MAX))}
                maxLength={CUSTOMER_NOTES_MAX}
                rows={3}
                placeholder="e.g. Please ship before the 14th — baby shower is the 16th. Thank you!"
                className="w-full px-3 py-2.5 text-sm resize-none"
                style={{ border: "1px solid var(--border-strong)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
                aria-label="Optional note for Lusik"
              />
              <span className="text-[0.6rem] opacity-55 mt-1 block tabular-nums">{customerNotes.length}/{CUSTOMER_NOTES_MAX}</span>
            </label>
          </CollapsibleCard>

          {/* ============================================================
              OPTIONAL: ONE-YEAR REMINDER
              ============================================================
              Single checkbox, default off. Almost-no-friction add. Useful
              for gift-givers (so they remember next year's baby shower)
              and self-purchases alike. Sent at most once, ~11 months
              after the order. */}
          <CollapsibleCard eyebrow="Optional" title="Gentle reminder" className="mb-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={giftReminderOptIn}
                onChange={(e) => setGiftReminderOptIn(e.target.checked)}
                className="mt-0.5"
                aria-describedby="gift-reminder-help"
              />
              <span className="text-xs leading-snug">
                Send me one email next year if I might want another.
                <span id="gift-reminder-help" className="block opacity-65 mt-0.5">
                  We'll send it once, about 11 months from now. Not a marketing list — one email, with an unsubscribe link.
                </span>
              </span>
            </label>
          </CollapsibleCard>

          {/* ============================================================
              OPTIONAL: SOCIAL-SHARE CONSENT
              ============================================================
              Default-off opt-in. The customer ticks the headline box,
              chooses any subset of platforms, and (optionally) types a
              handle for each platform they ticked. Handles are tracked
              per-platform because almost nobody uses the same username
              everywhere. Unticking the headline collapses everything
              and zeroes the submitted payload, so "unchecked" stays the
              legally-clean default. */}
          <CollapsibleCard eyebrow="Optional" title="Share your story" className="mb-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={socialAllow}
                onChange={(e) => setSocialAllow(e.target.checked)}
                className="mt-0.5 w-4 h-4 flex-shrink-0"
                style={{ accentColor: "var(--accent)" }}
              />
              <span className="text-sm leading-snug">
                <span style={{ fontWeight: 500 }}>If you'd like, Lusik can share a photo of your finished piece.</span>
                <span className="block text-xs opacity-65 mt-1 leading-relaxed">
                  Just the blanket or bib — never your baby or anyone else. Tick the platforms you're on, and (if you'd like to be tagged) leave your handle for each one. Change your mind any time by emailing hello@lusikandsons.com.
                </span>
              </span>
            </label>

            {socialAllow && (
              <div className="mt-4 pt-4" style={{ borderTop: "1px dashed rgba(176,136,66,0.3)" }}>
                <p className="text-[0.6rem] tracking-[0.25em] uppercase opacity-70 mb-2">Which platforms?</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {SOCIAL_CONSENT_PLATFORMS.map((p) => {
                    const checked = socialPlatforms.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer transition"
                        style={{
                          background: checked ? "rgba(176,136,66,0.12)" : "#FFFFFF",
                          border: `1px solid ${checked ? "var(--accent)" : "rgba(26,22,18,0.15)"}`,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSocialPlatform(p.id)}
                          className="w-3.5 h-3.5"
                          style={{ accentColor: "var(--accent)" }}
                        />
                        <span className="text-sm">{p.label}</span>
                      </label>
                    );
                  })}
                </div>

                {socialPlatforms.length > 0 && (
                  <div className="mt-1">
                    <p className="text-[0.6rem] tracking-[0.25em] uppercase opacity-70 mb-2">Where should she tag you? <span className="normal-case tracking-normal opacity-70">(optional)</span></p>
                    <div className="space-y-2">
                      {SOCIAL_CONSENT_PLATFORMS
                        .filter((p) => socialPlatforms.includes(p.id))
                        .map((p) => (
                          <label key={p.id} className="flex items-center gap-3">
                            <span className="text-xs w-20 flex-shrink-0 opacity-80" style={{ fontWeight: 500 }}>{p.label}</span>
                            <input
                              type="text"
                              value={socialHandles[p.id] ?? ""}
                              onChange={(e) => updateSocialHandle(p.id, e.target.value)}
                              maxLength={64}
                              autoComplete="off"
                              autoCapitalize="off"
                              autoCorrect="off"
                              spellCheck={false}
                              placeholder="@yourname"
                              className="flex-1 px-3 py-2 text-sm"
                              style={{ border: "1px solid var(--border-strong)", background: "var(--bg-surface)", color: "var(--text-primary)" }}
                              aria-label={`Your ${p.label} handle, optional`}
                            />
                          </label>
                        ))}
                    </div>
                    <span className="text-[0.65rem] opacity-55 mt-2 block italic">
                      Leave any of these blank — Lusik will share without tagging if she isn't sure which account is yours.
                    </span>
                  </div>
                )}
              </div>
            )}
          </CollapsibleCard>

          {/* Inline Pay button is desktop-only; mobile uses the sticky
              bottom bar (rendered at the end of this component). Both
              stay disabled until the shipping ZIP is in (when shipping
              is paid) — the ZIP is what prices the shipping option. */}
          <button
            onClick={handleCheckout}
            disabled={busy || cart.length === 0 || zipNeeded}
            className="hidden lg:flex w-full py-4 text-sm tracking-[0.2em] uppercase items-center justify-center gap-2 transition"
            style={{
              background: (busy || zipNeeded) ? "rgba(26,22,18,0.5)" : "#1A1612",
              color: "#F5EFE3",
              cursor: busy ? "wait" : zipNeeded ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Connecting to Stripe…" : zipNeeded ? "Enter ZIP to continue" : "Pay with Stripe"}
            {!busy && !zipNeeded && <ArrowRight size={16} strokeWidth={1.5} />}
          </button>

          {/* Accepted-payment row — Stripe handles all of these, but
              customers don't know that until they see the icons. */}
          <PaymentMethodsRow className="mt-4" />

          <p className="text-xs opacity-70 mt-4 leading-relaxed">
            Or order the old-fashioned way: <button onClick={() => window.open("https://instagram.com", "_blank", "noopener,noreferrer")} className="underline">message us on Instagram</button>, <button onClick={() => window.open("mailto:hello@lusikandsons.com")} className="underline">write an email</button>, or call <a href="tel:+17608742333" className="underline">(760) 874-2333</a>.
          </p>
        </div>

        <div className="min-w-0 order-first lg:order-none">
          <h2 className="text-xs tracking-[0.3em] uppercase mb-6 opacity-70">Order summary</h2>
          <div className="mb-6" style={{ borderTop: "1px solid rgba(26,22,18,0.08)" }}>
            {cart.map((item) => (
              <div key={item.id} className="flex gap-3 py-4 items-start" style={{ borderBottom: "1px solid rgba(26,22,18,0.08)" }}>
                <div className="relative shrink-0">
                  <CartItemThumb src={item.image || PRODUCT.gallery[0]} alt={item.name} width={64} height={80} className="w-16 h-20 object-cover" style={{ background: "var(--bg-subtle)", border: item.isCustom ? "1px solid rgba(176,136,66,0.3)" : "none" }} />
                  {item.isCustom && (
                    <span className="absolute -top-1 -right-1 text-[0.5rem] tracking-[0.15em] uppercase px-1 py-0.5" style={{ background: "var(--accent)", color: "#F5EFE3", fontWeight: 500 }}>Custom</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-base leading-tight" style={{ fontWeight: 400 }}>{item.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {item.colorHex && <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: item.colorHex, border: "1px solid rgba(26,22,18,0.15)" }} />}
                    <p className="text-xs opacity-70 truncate">{item.subtitle} · Qty {item.qty}</p>
                  </div>
                </div>
                <p className="text-sm tabular-nums shrink-0" style={{ fontWeight: 500 }}>${(item.price * item.qty).toFixed(2)}</p>
              </div>
            ))}
          </div>
          <div className="pt-2 space-y-1 text-sm">
            <div className="flex justify-between"><span className="opacity-70">Subtotal</span><span className="tabular-nums">${subtotal.toFixed(2)}</span></div>
            {bundle.cents > 0 && (
              <div className="flex justify-between">
                <span className="opacity-70">Bundle savings ({bundle.units} pieces)</span>
                <span className="tabular-nums" style={{ color: "var(--accent)", fontWeight: 500 }}>−${bundle.dollars.toFixed(2)}</span>
              </div>
            )}
            {bundle.enabled && bundle.cents === 0 && cart.length > 0 && (
              <p className="text-[0.65rem] opacity-55 italic leading-relaxed">
                Add another piece and save ${bundle.perExtraDollars.toFixed(2)} — every additional piece takes another ${bundle.perExtraDollars.toFixed(2)} off.
              </p>
            )}
            {giftIsGift && giftWrap && (
              <div className="flex justify-between"><span className="opacity-70">Gift wrap</span><span className="tabular-nums">+${(CONFIG.GIFT_WRAP_PRICE_CENTS / 100).toFixed(2)}</span></div>
            )}
            <div className="flex justify-between">
              <span className="opacity-70">Shipping</span>
              {freeShipping ? (
                <span className="tabular-nums" style={{ color: "var(--accent)", fontWeight: 500 }}>Free</span>
              ) : shipEstimate ? (
                <span className="tabular-nums">${shipEstimate.dollars.toFixed(2)}</span>
              ) : (
                <span className="opacity-70">Enter ZIP below</span>
              )}
            </div>
            <div className="flex justify-between"><span className="opacity-70">Tax</span><span className="opacity-70">Calculated at Stripe</span></div>
          </div>

          {/* Shipping ZIP — prices the zone-based rate before the Stripe
              hand-off (UPS-style zones from Cypress, CA: a SoCal order
              ships for less than a Florida one). Hidden once the order
              earns free shipping; required otherwise. */}
          {!freeShipping && (
            <div className="mt-5 p-4" style={{ background: "rgba(176,136,66,0.06)", border: "1px solid rgba(176,136,66,0.18)" }}>
              <label className="block mb-1.5">
                <span className="text-[0.6rem] tracking-[0.25em] uppercase opacity-70">Shipping ZIP code</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                value={shipZip}
                onChange={(e) => setShipZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                placeholder="90620"
                className="w-full px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[rgba(176,136,66,0.4)] tabular-nums"
                style={{ border: "1px solid rgba(26,22,18,0.15)" }}
                aria-label="Shipping ZIP code"
              />
              {/* City/state echo — confirms the typed ZIP is the one they
                  meant ("Buena Park, CA 90620") before it prices the zone.
                  Unknown ZIP = gentle nudge, never a blocker; failed
                  lookup = silence (the estimate below still works). */}
              {zipPlace && (
                <p className="text-xs mt-2" style={{ color: "var(--accent)", fontWeight: 500 }} aria-live="polite">
                  ✓ {zipPlace.city}, {zipPlace.state} {shipZip}
                </p>
              )}
              {zipUnrecognized && (
                <p className="text-xs mt-2 leading-relaxed" style={{ color: "#8B5A2B" }} aria-live="polite">
                  We don't recognize that ZIP — double-check it? You can still continue if it's right.
                </p>
              )}
              {shipEstimate ? (
                <p className="text-xs mt-2 leading-relaxed">
                  <span style={{ fontWeight: 500 }}>{shipEstimate.label} — ${shipEstimate.dollars.toFixed(2)}</span>
                  <span className="opacity-70"> · {shipEstimate.daysMin}–{shipEstimate.daysMax} business days transit once it ships.</span>
                </p>
              ) : (
                <p className="text-xs opacity-60 mt-2 leading-relaxed">
                  Shipping is priced by distance from Lusik's workshop in Buena Park, CA — ${SHIPPING_FROM_DOLLARS.toFixed(2)}–${SHIPPING_TO_DOLLARS.toFixed(2)} in the lower 48. Enter the ZIP this order ships to.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile sticky checkout bar — keeps the subtotal + Pay always
          visible while scrolling. The checkout page hides the bottom nav,
          so this sits flush at the bottom. Desktop uses the inline button. */}
      <div
        className="lg:hidden fixed left-0 right-0 bottom-0 z-40 px-5 pt-3"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          background: "var(--bg-surface, #FFFFFF)",
          borderTop: "1px solid var(--border-default)",
          boxShadow: "0 -6px 24px rgba(26,22,18,0.14)",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs tracking-[0.15em] uppercase opacity-70">
            {freeShipping
              ? "Subtotal · free shipping"
              : shipEstimate
                ? `Subtotal · +$${shipEstimate.dollars.toFixed(2)} shipping`
                : "Subtotal · shipping by ZIP"}
          </span>
          <span className="text-lg tabular-nums" style={{ fontWeight: 600, color: "var(--text-primary)" }}>${subtotal.toFixed(2)}</span>
        </div>
        <button
          onClick={handleCheckout}
          disabled={busy || cart.length === 0 || zipNeeded}
          className="w-full py-3.5 text-sm tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition"
          style={{ background: (busy || zipNeeded) ? "rgba(26,22,18,0.5)" : "#1A1612", color: "#F5EFE3", borderRadius: 999, cursor: busy ? "wait" : zipNeeded ? "not-allowed" : "pointer" }}
        >
          {busy ? "Connecting to Stripe…" : zipNeeded ? "Enter ZIP to continue" : "Pay with Stripe"}
          {!busy && !zipNeeded && <ArrowRight size={16} strokeWidth={1.5} />}
        </button>
      </div>
    </div>
  );
}
