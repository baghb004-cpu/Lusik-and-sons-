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
import { json }        from "./_lib/json.mjs";

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
// Free U.S. shipping at or above this threshold. The cart-drawer
// progress bar promises it; this is where we make it real on the
// Stripe side. MUST stay in sync with CONFIG.FREE_SHIPPING_*
// values in index.html — keep both updated when the promotion
// changes.
// ============================================================
const FREE_SHIPPING_THRESHOLD_CENTS = 15000;

// Paid shipping options offered below the threshold. Mirrors
// SHIPPING_CARRIERS in index.html. Stripe shows these on its
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
// ?order=success|cancelled flag that index.html's post-checkout
// handler already understands.
function buildReturnUrls(originHeader) {
  const origin = originHeader || process.env.URL || "https://lusikandsons.com";
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

  const stripe = getStripe();

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const { cart, social_consent: rawSocial, gift: rawGift, gift_reminder_opt_in } = body ?? {};
  if (!Array.isArray(cart) || cart.length === 0) {
    return json(400, { error: "Cart is empty" });
  }

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
    const qty = Number.isInteger(item.qty) && item.qty > 0 ? item.qty : 1;

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

  const returnUrls = buildReturnUrls(req.headers.get("origin"));

  // Compute subtotal from the TRUSTED prices we just built into
  // line items (NOT from anything the browser sent). This is the
  // number that decides whether free shipping applies.
  const subtotalCents = lineItems.reduce(
    (sum, li) => sum + li.price_data.unit_amount * li.quantity,
    0,
  );
  const shippingOptions = buildShippingOptions(subtotalCents);

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
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
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
    });
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
