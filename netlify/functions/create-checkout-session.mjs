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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

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
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const { cart, userId, customerEmail, social_consent } = body ?? {};
  if (!Array.isArray(cart) || cart.length === 0) {
    return json(400, { error: "Cart is empty" });
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

  // Create the Checkout Session.
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
      // Stripe metadata has a 500-char-per-value cap, so we don't
      // shove the cart in here. Instead we stash it in Blobs keyed
      // by session.id and the webhook looks it up.
      metadata: {
        userId: userId ?? "",
      },
    });
  } catch (err) {
    console.error("Stripe session create failed:", err);
    return json(502, { error: "Couldn't reach Stripe. Please try again." });
  }

  // Stash the cart + auth context for the webhook. Single source
  // of truth for what the customer just bought, keyed by Stripe's
  // session id. The webhook deletes the entry after persisting the
  // order, so this is short-lived ephemeral storage.
  const pending = getStore({ name: "pending-orders", consistency: "strong" });
  await pending.setJSON(session.id, {
    cart,
    userId: userId ?? null,
    customerEmail: customerEmail ?? null,
    social_consent: social_consent ?? null,
    createdAt: new Date().toISOString(),
  });

  return json(200, { url: session.url });
};
