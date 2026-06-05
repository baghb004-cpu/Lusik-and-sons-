// ============================================================
// /.netlify/functions/create-checkout-session
// ============================================================
// Browser POSTs the cart here. We validate, build a Stripe
// Checkout Session, stash the cart for the webhook, and return
// the Stripe-hosted checkout URL.
//
// Replaces the Supabase Edge Function of the same name.
//
// Auth: optional. Logged-in users get user_id stamped on their
// order; guests check out without. (Same behavior as before.)
// ============================================================

import Stripe          from "stripe";
import { getStore }    from "@netlify/blobs";
import { TRUSTED_PRODUCTS } from "./_lib/trusted-products.mjs";
import { FREE_SHIPPING_THRESHOLD_CENTS, GIFT_WRAP_PRICE_CENTS } from "./_lib/pricing.mjs";
import { ipFromRequest, checkRateLimit } from "./_lib/rate-limit.mjs";
import { findInventoryViolation } from "./_lib/inventory.mjs";
import { sql }         from "./_lib/db.mjs";
import { json }        from "./_lib/json.mjs";
import { isAllowedOrigin } from "./_lib/origin.mjs";

// Per-IP daily ceiling on checkout-session creation. A real
// customer abandons + retries a few times across a day at worst;
// a botnet hammering this endpoint racks up Stripe session IDs
// (free, but spammy) and uses our function-invocation budget.
// Authenticated users still get the same limit — the bucket
// protects the function tier, not the user — but signed-in
// callers are already enumerable by Lusik, so we can be lenient.
const MAX_CHECKOUT_STARTS_PER_IP_PER_DAY = 30;

// Lazy-init the Stripe client INSIDE the handler so a missing
// STRIPE_SECRET_KEY env var returns a clean JSON 503 instead of
// throwing at module load (which would surface as a Netlify-
// wrapped 502 with no diagnostic body).
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    const err = new Error("STRIPE_SECRET_KEY env var is not set in this Netlify environment.");
    err.code = "ENV_MISSING_STRIPE_SECRET_KEY";
    throw err;
  }
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

// ============================================================
// SHIPPING POLICY
// ============================================================
// Free U.S. shipping at or above FREE_SHIPPING_THRESHOLD_CENTS
// (imported from _lib/pricing.mjs). The cart-drawer progress bar
// promises it; this is where we make it real on the Stripe side.
// The browser's matching constant lives in CONFIG.FREE_SHIPPING_*
// in src/data/config.js and is guarded against drift by pricing-drift.test.mjs.
// ============================================================

// Paid shipping options offered below the threshold. Mirrors
// SHIPPING_CARRIERS in src/data/shippingCarriers.ts. Stripe shows these on its
// hosted checkout page; the customer picks one.
const SHIPPING_CARRIERS = [
  { name: "USPS Ground Advantage", amountCents:  999, daysMin: 3, daysMax: 5 },
  { name: "UPS Ground",            amountCents: 1499, daysMin: 2, daysMax: 5 },
  { name: "FedEx Home Delivery",   amountCents: 1699, daysMin: 2, daysMax: 5 },
];

function buildShippingOptions(subtotalCents) {
  if (subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS) {
    // Single free option. Including a "free" entry rather than no
    // shipping at all keeps the checkout page consistent (always
    // shows a "Shipping" line) and lets the customer see they
    // earned it.
    return [{
      shipping_rate_data: {
        type: "fixed_amount",
        fixed_amount: { amount: 0, currency: "usd" },
        display_name: "Free U.S. shipping",
        delivery_estimate: {
          minimum: { unit: "business_day", value: 3 },
          maximum: { unit: "business_day", value: 5 },
        },
      },
    }];
  }
  return SHIPPING_CARRIERS.map((c) => ({
    shipping_rate_data: {
      type: "fixed_amount",
      fixed_amount: { amount: c.amountCents, currency: "usd" },
      display_name: c.name,
      delivery_estimate: {
        minimum: { unit: "business_day", value: c.daysMin },
        maximum: { unit: "business_day", value: c.daysMax },
      },
    },
  }));
}

// Where Stripe sends the customer after pay/cancel. We append the
// ?order=success|cancelled flag that the app's post-checkout
// handler already understands.
//
// Origin VALIDATION is load-bearing for security here: an attacker
// can send any Origin header they want, and without a check Stripe
// Allowlist implementation lives in _lib/origin.mjs so the unit
// tests can import the SAME function the production code uses
// instead of re-implementing it (and drifting silently).

function buildReturnUrls(originHeader) {
  const fallback = process.env.URL || "https://lusikandsons.com";
  const origin = isAllowedOrigin(originHeader) ? originHeader : fallback;
  return {
    success_url: `${origin}/?order=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${origin}/?order=cancelled`,
  };
}

export default async (req, context) => {
  try {
    return await handle(req, context);
  } catch (err) {
    console.error("create-checkout-session crashed:", err);
    const isProd = process.env.CONTEXT === "production";
    return json(500, {
      error: "Function crashed before reaching Stripe.",
      ...(isProd ? {} : {
        code:    err?.code    || "UNCAUGHT",
        message: err?.message || String(err),
      }),
    });
  }
};

async function handle(req, context) {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // Rate-limit BEFORE doing any work. The check is a single Blobs
  // read+write — cheaper than parsing JSON or initializing Stripe,
  // so abusive callers pay the smallest possible cost. Deny when
  // no IP could be recovered: better one rejected checkout than a
  // bypass for an attacker who can strip headers.
  const ip = ipFromRequest(req, context);
  const rl = await checkRateLimit({
    bucket: "checkout-start",
    ip,
    limit: MAX_CHECKOUT_STARTS_PER_IP_PER_DAY,
  });
  if (!rl.ok) {
    return json(429, { error: "Too many checkout attempts from this network today. Please try again later or email hello@lusikandsons.com." });
  }

  const stripe = getStripe();

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const { cart, social_consent: rawSocial, gift: rawGift, gift_reminder_opt_in, customer_notes: rawCustomerNotes } = body ?? {};
  if (!Array.isArray(cart) || cart.length === 0) {
    return json(400, { error: "Cart is empty" });
  }

  // Idempotency key from the browser — forwarded to Stripe so a retry
  // of the same POST (network blip, double-tap, refresh after a hung
  // response) returns the original Checkout Session URL instead of
  // creating a second one. Stripe retains the response for 24h keyed
  // by this value. We accept up to 255 chars (Stripe's limit) of
  // printable ASCII; anything malformed is silently dropped, which
  // degrades to non-idempotent behavior — same risk as today, no
  // regression. Required printable-ASCII whitelist avoids smuggling
  // newlines into Stripe's HTTP header.
  const rawKey = typeof body?.idempotency_key === "string" ? body.idempotency_key : "";
  const idempotencyKey =
    rawKey.length > 0 && rawKey.length <= 255 && /^[\x21-\x7e]+$/.test(rawKey)
      ? rawKey
      : null;

  // Sanitize the optional gift + social_consent payloads. The browser
  // can send anything here; without bounds an attacker could write a
  // multi-MB gift message into orders.gift JSONB (bloating row size,
  // the admin email render, and the customer's portable export). We
  // coerce types, cap strings, and whitelist platform IDs.
  const SOCIAL_PLATFORMS = new Set(["instagram", "tiktok", "facebook", "youtube"]);
  const gift = (() => {
    if (!rawGift || typeof rawGift !== "object") return null;
    const isGift = rawGift.is_gift === true;
    return {
      is_gift:     isGift,
      message:     isGift && typeof rawGift.message === "string"
                     ? rawGift.message.slice(0, 500)
                     : "",
      hide_prices: isGift && rawGift.hide_prices === true,
      wrap:        isGift && rawGift.wrap === true,
    };
  })();
  const social_consent = (() => {
    if (!rawSocial || typeof rawSocial !== "object") return null;
    const allowed = rawSocial.allowed === true;
    if (!allowed) return { allowed: false, platforms: [], handles: {}, consented_at: null };
    const platforms = Array.isArray(rawSocial.platforms)
      ? rawSocial.platforms.filter((p) => typeof p === "string" && SOCIAL_PLATFORMS.has(p))
      : [];
    const rawHandles = rawSocial.handles && typeof rawSocial.handles === "object" ? rawSocial.handles : {};
    const handles = {};
    for (const p of platforms) {
      const h = rawHandles[p];
      if (typeof h === "string" && h.trim().length > 0) {
        handles[p] = h.trim().slice(0, 64);
      }
    }
    return {
      allowed:      true,
      platforms,
      handles,
      consented_at: typeof rawSocial.consented_at === "string"
                      ? rawSocial.consented_at.slice(0, 40)
                      : null,
    };
  })();

  // Optional customer note for Lusik — distinct from gift.message
  // (which goes on the recipient's card). Strips control chars
  // (CRLF, etc.) so the value can't smuggle SMTP headers if it
  // ever flows into the admin email subject, and caps at 280 chars
  // — matches the browser-side cap and bounds storage costs.
  const customer_notes = (() => {
    if (typeof rawCustomerNotes !== "string") return null;
    const cleaned = rawCustomerNotes
      .replace(/[\r\n\x00-\x1f\x7f]+/g, " ")
      .trim()
      .slice(0, 280);
    return cleaned.length > 0 ? cleaned : null;
  })();

  // userId and customerEmail are derived from the Identity JWT when
  // present — NEVER from the request body. A signed-in customer
  // can't impersonate someone else by sending a different userId,
  // and a guest can't plant an order against a victim's email and
  // have it auto-attach when the victim later signs up.
  const identityUser = context?.clientContext?.user;
  const userId = identityUser?.sub ?? null;
  const bodyEmail = typeof body?.customerEmail === "string" ? body.customerEmail.trim() : "";
  // Trust JWT email when authenticated. For guests, accept a
  // syntactically valid email from the body so Stripe can send
  // them a receipt — but no body email gets stamped on a user_id.
  let customerEmail = identityUser?.email ?? null;
  if (!customerEmail && bodyEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bodyEmail)) {
    customerEmail = bodyEmail;
  }

  // Build Stripe line items from the trusted price map. Any item
  // whose productKey isn't in the map fails the whole checkout —
  // safer than silently dropping line items.
  const lineItems = [];
  for (const item of cart) {
    const key = item.productKey;
    const trusted = TRUSTED_PRODUCTS[key];
    if (!trusted) {
      return json(400, { error: `Unknown product key: ${key}` });
    }
    // Clamp qty defensively: positive integer, ceiling 99. Without
    // the upper bound a client could send qty: 999999, which Stripe
    // would either reject (returning a 502 from this function with
    // no clean recovery for the customer) or accept and charge a
    // surprising 6-figure amount. 99 mirrors the per-item cap that
    // saved-cart already enforces in the browser.
    const rawQty = Number.isInteger(item.qty) && item.qty > 0 ? item.qty : 1;
    const qty = Math.min(99, rawQty);

    // Compose a single line description from whatever variant info
    // the browser passed (subtitle + size + colorHex). This shows
    // up on Stripe's hosted checkout page and on the receipt.
    const desc = [trusted.variant, item.subtitle, item.size, item.colorHex]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 500); // Stripe caps description length

    lineItems.push({
      quantity: qty,
      price_data: {
        currency: "usd",
        unit_amount: trusted.priceCents,
        product_data: {
          name: trusted.name,
          description: desc || undefined,
          metadata: {
            productKey: key,
            isCustom: String(!!item.isCustom),
          },
        },
      },
    });
  }

  // ---- Handmade-stock safety cap (overselling guard) ----
  // The authoritative check: reject the checkout BEFORE creating a
  // Stripe session if the cart would push any product past its limit.
  // Because pricing/quantity are already locked to the trusted map +
  // clamped qty above, the client cannot bypass this by tampering.
  //
  // Fail-OPEN on a DB error (log + continue): a transient database
  // hiccup must not block every customer's checkout. The window for
  // an actual oversell during such an error is tiny for a low-volume
  // handmade shop, and order_items still records the truth.
  try {
    const violation = await findInventoryViolation(sql, cart);
    if (violation) {
      const { remaining } = violation;
      return json(409, {
        error: remaining <= 0
          ? "One of the items in your bag just sold out — these are handmade in small batches. Please remove it and check back soon; you can ask us to email you when it's back."
          : `Only ${remaining} of one item in your bag ${remaining === 1 ? "is" : "are"} still available right now. Please lower the quantity to continue.`,
        code: "INVENTORY_LIMIT",
        group: violation.group,
        remaining,
      });
    }
  } catch (invErr) {
    console.error("Inventory check failed (allowing checkout):", invErr?.message || invErr);
  }

  const returnUrls = buildReturnUrls(req.headers.get("origin"));

  // Compute subtotal from the TRUSTED prices we just built into
  // line items (NOT from anything the browser sent). This is the
  // number that decides whether free shipping applies. Gift wrap
  // is an add-on charged on top — it doesn't count toward the
  // free-shipping threshold, otherwise wrapping a $145 order would
  // push it over $150 and we'd be eating the shipping cost just
  // because the customer ticked a box.
  const subtotalCents = lineItems.reduce(
    (sum, li) => sum + li.price_data.unit_amount * li.quantity,
    0,
  );
  const shippingOptions = buildShippingOptions(subtotalCents);

  // Gift wrap add-on. Hardcoded price + name so the browser can't
  // talk us into a free or discounted wrap. Appended after the
  // subtotal computation so it doesn't affect free shipping.
  if (gift?.wrap === true && GIFT_WRAP_PRICE_CENTS > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: GIFT_WRAP_PRICE_CENTS,
        product_data: {
          name: "Gift wrap",
          description: "Soft tissue and twine, with the card tucked inside.",
          metadata: { productKey: "gift-wrap", isCustom: "false" },
        },
      },
    });
  }

  // Create the Checkout Session.
  //
  // Automatic tax is off by default — turning it on requires
  // completing Stripe Tax setup in the dashboard (origin address,
  // product tax codes, activation). Set STRIPE_AUTOMATIC_TAX=true
  // in Netlify env vars once that's done. Until then, Stripe
  // will collect a flat 0 tax and you can configure it yourself.
  const automaticTaxEnabled = String(process.env.STRIPE_AUTOMATIC_TAX || "").toLowerCase() === "true";

  // Surface the underlying Stripe error to the browser in dev
  // (netlify dev / branch deploys / deploy previews) so debugging
  // doesn't require pulling logs. Production keeps the friendly
  // generic message to avoid leaking implementation details.
  const isProd = process.env.CONTEXT === "production";

  let session;
  try {
    // The Stripe SDK accepts a second `{ idempotencyKey }` arg on
    // any POST. When the same key is replayed within 24h with an
    // identical body, Stripe returns the original response (the
    // same session.id + url) instead of creating a duplicate. We
    // only attach the option when we received a well-formed key
    // from the browser; without it, behavior is identical to before.
    const stripeOpts = idempotencyKey ? { idempotencyKey } : undefined;
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Intentionally omit `payment_method_types` so hosted Checkout
      // uses dynamic payment methods configured in the Stripe
      // Dashboard — that's how a Checkout Session surfaces Apple Pay,
      // Google Pay, and Link in addition to card, with Stripe handling
      // Apple Pay domain registration itself (no Apple Developer
      // account needed). NOTE: `automatic_payment_methods` is a
      // PaymentIntent/SetupIntent param and is rejected by the
      // Checkout Sessions API — the correct lever here is simply to
      // not pin payment_method_types at all. One-tap wallets are the
      // biggest conversion lever for our mostly-mobile (Instagram)
      // traffic vs. the old card-only flow.
      line_items: lineItems,
      customer_email: customerEmail || undefined,
      success_url: returnUrls.success_url,
      cancel_url:  returnUrls.cancel_url,
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: shippingOptions,
      ...(automaticTaxEnabled ? { automatic_tax: { enabled: true } } : {}),
      // Stripe metadata has a 500-char-per-value cap, so we don't
      // shove the cart in here. Instead we stash it in Blobs keyed
      // by session.id and the webhook looks it up.
      metadata: {
        userId: userId ?? "",
        // Stamp the subtotal + whether free shipping applied so
        // the order admin can audit later without recomputing.
        subtotalCents: String(subtotalCents),
        freeShippingApplied: String(subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS),
        automaticTaxEnabled: String(automaticTaxEnabled),
      },
    }, stripeOpts);
  } catch (err) {
    // Log fields for the Netlify Functions log viewer. err.raw can
    // include partial card data on some error types, so omit it in
    // production logs.
    console.error("Stripe session create failed:", {
      type:    err?.type,
      code:    err?.code,
      param:   err?.param,
      message: err?.message,
      ...(isProd ? {} : { raw: err?.raw }),
    });
    if (isProd) {
      return json(502, { error: "Payment provider rejected the request. Please try again." });
    }
    return json(502, {
      error:    "Stripe rejected the request — see fields below for what to fix.",
      type:     err?.type    ?? null,
      code:     err?.code    ?? null,
      param:    err?.param   ?? null,
      message:  err?.message ?? null,
    });
  }

  // Stash the cart + auth context for the webhook. Single source
  // of truth for what the customer just bought, keyed by Stripe's
  // session id. The webhook deletes the entry after persisting the
  // order, so this is short-lived ephemeral storage.
  //
  // Wrapped in its own try + 4-second hard timeout so a hung or
  // mis-configured Blobs call can't crash the whole function.
  // If the stash fails we still hand the Stripe URL back to the
  // browser — the customer can complete payment, and the only
  // loss is admin-side data the webhook would have read.
  try {
    const stashPromise = (async () => {
      const pending = getStore({ name: "pending-orders", consistency: "strong" });
      await pending.setJSON(session.id, {
        cart,
        userId: userId ?? null,
        customerEmail: customerEmail ?? null,
        social_consent: social_consent ?? null,
        gift: gift ?? null,
        gift_reminder_opt_in: gift_reminder_opt_in === true,
        customer_notes: customer_notes ?? null,
        createdAt: new Date().toISOString(),
      });
    })();
    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(new Error("Blobs setJSON timed out after 4s")), 4000)
    );
    await Promise.race([stashPromise, timeout]);
  } catch (blobErr) {
    // Log but don't fail the request — Stripe session is already
    // created, so the customer should be allowed through.
    console.error("Pending-order stash failed (continuing anyway):", blobErr?.message || blobErr);
  }

  return json(200, { url: session.url });
}
