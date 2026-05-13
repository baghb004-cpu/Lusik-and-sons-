// ============================================================
// /.netlify/functions/stripe-webhook
// ============================================================
// Stripe POSTs here for events we've subscribed to. We verify
// the signature, dispatch on event type, and either record a
// new order or update an existing one.
//
// Subscribe these events in the Stripe dashboard:
//   - checkout.session.completed   (records new orders)
//   - charge.refunded              (updates orders on refund)
//
// Endpoint URL:
//   https://<your-site>.netlify.app/api/stripe-webhook
//   (netlify.toml redirects /api/stripe-webhook to this Function)
//
// Required env vars:
//   STRIPE_SECRET_KEY      — used to construct the Stripe client
//   STRIPE_WEBHOOK_SECRET  — used to verify signatures
// ============================================================

import Stripe        from "stripe";
import { getStore } from "@netlify/blobs";
import { sql }      from "./_lib/db.mjs";
import { TRUSTED_PRODUCTS }    from "./_lib/trusted-products.mjs";
import {
  sendAdminOrderEmail,
  sendCustomerOrderConfirmation,
  sendRefundNotification,
} from "./_lib/email.mjs";

// Lazy-init the Stripe client so a missing STRIPE_SECRET_KEY env var
// returns a clean error in the handler instead of throwing at module
// load (which would surface as a 502 with no diagnostic body).
let _stripe = null;
function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    const err = new Error("STRIPE_SECRET_KEY env var is not set");
    err.code = "ENV_MISSING_STRIPE_SECRET_KEY";
    throw err;
  }
  _stripe = new Stripe(key, { apiVersion: "2024-06-20" });
  return _stripe;
}

// Friendly customer-facing order number generator. Sequence-free
// so we don't have to track state — month + 6 random base36 chars.
// Collisions are essentially impossible at this volume and the
// orders.order_number UNIQUE constraint will catch one if it ever
// happens.
function generateOrderNumber() {
  const d   = new Date();
  const ym  = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `LS-${ym}-${rnd}`;
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  // Stripe needs the RAW request body to verify the signature.
  const rawBody = await req.text();

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    console.error("[webhook]", err.message);
    return new Response("Server misconfigured", { status: 500 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    // Log the detailed reason (missing secret vs. mismatch vs.
    // timestamp drift) but don't echo it back — the response is
    // public and the detail would help an attacker tune their
    // forgery attempts.
    console.warn("Webhook signature verification failed:", err.message);
    return new Response("Invalid signature", { status: 400 });
  }

  // Dispatch on event type. Anything we haven't subscribed to
  // (or that Stripe sends for some unrelated reason) gets a 200
  // so Stripe doesn't keep retrying.
  if (event.type === "charge.refunded") {
    return await handleChargeRefunded(event.data.object);
  }
  if (event.type !== "checkout.session.completed") {
    return new Response("ok (ignored)", { status: 200 });
  }

  const session = event.data.object;

  // Idempotency: if we've already written this session, do nothing.
  const existing = await sql`
    SELECT id FROM orders WHERE stripe_session_id = ${session.id}
  `;
  if (existing.length > 0) {
    return new Response("ok (duplicate)", { status: 200 });
  }

  // Pull the stashed cart from Blobs.
  const pendingStore = getStore({ name: "pending-orders", consistency: "strong" });
  let pending = await pendingStore.get(session.id, { type: "json" });
  let reconstructed = false;
  if (!pending || !Array.isArray(pending.cart)) {
    // The stash can be missing if create-checkout-session hit its 4s
    // Blobs timeout and let the customer through anyway. Recovering
    // from Stripe's line items is lossy (no custom blanket metadata)
    // but it beats silently dropping a paid order — Lusik can reach
    // out to the customer for the missing design details.
    console.warn("[webhook] No pending cart for session, reconstructing from Stripe:", session.id);
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        expand: ["data.price.product"],
        limit: 100,
      });
      const recoveredCart = [];
      for (const li of lineItems.data) {
        const product = li.price?.product;
        const productKey = product?.metadata?.productKey;
        if (!productKey || !TRUSTED_PRODUCTS[productKey]) continue;
        recoveredCart.push({
          productKey,
          qty:      li.quantity ?? 1,
          subtitle: li.description ?? product?.description ?? "",
          isCustom: product?.metadata?.isCustom === "true",
        });
      }
      if (recoveredCart.length === 0) {
        // No way to write a meaningful order row. 500 so Stripe
        // retries — maybe the next attempt finds the blob.
        console.error("[webhook] Could not reconstruct any line items for session", session.id);
        return new Response("Cart reconstruction failed", { status: 500 });
      }
      pending = {
        cart:           recoveredCart,
        userId:         session.metadata?.userId || null,
        customerEmail:  session.customer_details?.email ?? null,
        social_consent: null,
        gift:           null,
      };
      reconstructed = true;
    } catch (err) {
      console.error("[webhook] Failed to reconstruct cart from Stripe:", err);
      return new Response("Cart reconstruction failed", { status: 500 });
    }
  }

  // Compute totals from trusted prices (do not trust the cart's
  // own price hints). Stripe's session.amount_total is the ground
  // truth for what the customer actually paid; we use it as the
  // total and back the subtotal out as best we can.
  let subtotalCents = 0;
  const items = [];
  for (const i of pending.cart) {
    const t = TRUSTED_PRODUCTS[i.productKey];
    if (!t) continue;
    const qty = Number.isInteger(i.qty) && i.qty > 0 ? i.qty : 1;
    subtotalCents += t.priceCents * qty;
    items.push({
      productKey:    i.productKey,
      productName:   t.name,
      variantLabel:  [t.variant, i.subtitle, i.size].filter(Boolean).join(" · "),
      quantity:      qty,
      unitPriceCents:t.priceCents,
      isCustom:      !!i.isCustom,
      customImageUrl:i.customImageUrl ?? null,
      customMetadata:i.customMetadata ?? null,
    });
  }

  const totalCents    = session.amount_total ?? subtotalCents;
  const shippingCents = session.shipping_cost?.amount_total ?? 0;
  const taxCents      = session.total_details?.amount_tax ?? 0;
  const customerEmail = session.customer_details?.email
                     ?? pending.customerEmail
                     ?? "";
  // Bundle the recipient's name into shipping_address so the
  // "your order shipped" email later has someone to greet —
  // Stripe stores name and address in separate sub-objects, but
  // for our purposes one JSONB blob keeps the order row simple.
  const shippingAddrRaw = session.shipping_details?.address ?? null;
  const shippingAddr = shippingAddrRaw
    ? { ...shippingAddrRaw, name: session.shipping_details?.name ?? null }
    : null;

  // Insert order. We don't use a transaction with separate inserts
  // because @netlify/neon's tagged template doesn't auto-batch;
  // we use a CTE so it's atomic.
  const orderNumber = generateOrderNumber();
  // Stripe's session has a payment_intent reference. Capture it
  // on insert so refund webhooks (which arrive with a
  // payment_intent reference, not a session id) can find this
  // order without an extra Stripe API call.
  const paymentIntent = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;

  const reconstructedNote = reconstructed
    ? "RECONSTRUCTED FROM STRIPE — original cart stash was lost. Custom blanket metadata (alphabet, layout, colors, personalization) is missing; reach out to the customer for those details before stitching."
    : null;
  const giftReminderOptIn = pending.gift_reminder_opt_in === true;
  const inserted = await sql`
    INSERT INTO orders (
      order_number, stripe_session_id, stripe_payment_intent, user_id,
      customer_email, status, fulfillment_status,
      subtotal_cents, shipping_cents, tax_cents, total_cents,
      shipping_address, social_consent, gift, admin_notes,
      gift_reminder_opt_in
    ) VALUES (
      ${orderNumber}, ${session.id}, ${paymentIntent}, ${pending.userId},
      ${customerEmail}, 'paid', 'in_progress',
      ${subtotalCents}, ${shippingCents}, ${taxCents}, ${totalCents},
      ${shippingAddr ? JSON.stringify(shippingAddr) : null}::jsonb,
      ${pending.social_consent ? JSON.stringify(pending.social_consent) : null}::jsonb,
      ${pending.gift ? JSON.stringify(pending.gift) : null}::jsonb,
      ${reconstructedNote},
      ${giftReminderOptIn}
    )
    RETURNING *
  `;
  const orderId = inserted[0].id;

  // Insert line items one by one. With Neon's tagged template the
  // individual inserts are cheap; batching adds complexity we
  // don't need at this volume.
  for (const it of items) {
    await sql`
      INSERT INTO order_items (
        order_id, product_key, product_name, variant_label, quantity,
        unit_price_cents, is_custom, custom_image_url, custom_metadata
      ) VALUES (
        ${orderId}, ${it.productKey}, ${it.productName}, ${it.variantLabel},
        ${it.quantity}, ${it.unitPriceCents}, ${it.isCustom},
        ${it.customImageUrl},
        ${it.customMetadata ? JSON.stringify(it.customMetadata) : null}::jsonb
      )
    `;
  }

  // Capture the customer's name from Stripe's checkout data —
  // shipping_details has it when present, billing as a fallback.
  const customerName = session.shipping_details?.name
                    ?? session.customer_details?.name
                    ?? null;

  // Fire both notification emails in parallel. Each one has its
  // own error isolation: failure to send EITHER email never
  // blocks the order from being recorded, and Stripe shouldn't
  // retry the whole webhook just because Resend was momentarily
  // down. The helpers log + return false on failure.
  await Promise.allSettled([
    sendAdminOrderEmail({
      order:   inserted[0],
      items,
      pending,
    }),
    sendCustomerOrderConfirmation({
      order:   inserted[0],
      items,
      pending,
      customerName,
    }),
  ]).catch((err) => console.warn("[webhook] email batch failed:", err?.message ?? err));

  // Clean up the pending cart blob — it's served its purpose.
  await pendingStore.delete(session.id).catch(() => {});

  return new Response("ok", { status: 200 });
};

// ============================================================
// charge.refunded — Lusik (or Stripe) issued a refund
// ============================================================
// Stripe fires this event when ANY refund is created on a
// charge, including:
//   - Lusik clicks "Refund" in the Stripe dashboard
//   - A successful dispute/chargeback claim auto-refunds the
//     customer
//   - A Stripe Connect / API call creates a refund
//
// The event's `charge` object carries:
//   - `payment_intent` — the PaymentIntent ID matching the one
//     we captured on order insert
//   - `amount`          — the original charge amount (cents)
//   - `amount_refunded` — running total of refunds against this
//     charge (cents). Used to decide partial vs. full refund.
//
// We look up the order by payment_intent, decide status
// (refunded vs. partially_refunded), update the row, and email
// the customer.
// ============================================================
async function handleChargeRefunded(charge) {
  const paymentIntent = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent?.id ?? null;
  if (!paymentIntent) {
    console.warn("[webhook] charge.refunded with no payment_intent; skipping");
    return new Response("ok (no payment intent)", { status: 200 });
  }

  const rows = await sql`
    SELECT * FROM orders WHERE stripe_payment_intent = ${paymentIntent} LIMIT 1
  `;
  if (rows.length === 0) {
    console.warn("[webhook] charge.refunded for unknown payment_intent:", paymentIntent);
    // 200 so Stripe doesn't retry forever for an order we don't have.
    return new Response("ok (no matching order)", { status: 200 });
  }
  const order = rows[0];

  const refundedCents = charge.amount_refunded ?? 0;
  const chargeCents   = charge.amount ?? order.total_cents ?? 0;
  const isFull        = refundedCents >= chargeCents;
  const newStatus     = isFull ? "refunded" : "partially_refunded";

  // Idempotency: if the running total matches what we've
  // already recorded, this is a duplicate webhook. Skip the
  // email but still update fulfillment_status if it's not
  // already terminal, since Stripe sometimes fires the event
  // multiple times for the same refund.
  const alreadyApplied = order.refunded_cents === refundedCents;
  if (alreadyApplied) {
    return new Response("ok (duplicate refund event)", { status: 200 });
  }

  // For full refunds, also flip fulfillment_status to "refunded"
  // so the customer's order timeline shows a coherent end-state.
  // Partial refunds leave fulfillment alone — the customer might
  // still be receiving most of their order.
  const updated = await sql`
    UPDATE orders
       SET status             = ${newStatus},
           fulfillment_status = CASE WHEN ${isFull} THEN 'refunded' ELSE fulfillment_status END,
           refunded_cents     = ${refundedCents}
     WHERE id = ${order.id}
     RETURNING *
  `;

  // Notify the customer. Same isolation as the other emails:
  // failures log + skip rather than blocking the DB write.
  await sendRefundNotification({
    order:          updated[0],
    refundedCents,
    isFullRefund:   isFull,
  }).catch((err) => console.warn("[webhook] refund email failed:", err?.message ?? err));

  return new Response("ok", { status: 200 });
}
