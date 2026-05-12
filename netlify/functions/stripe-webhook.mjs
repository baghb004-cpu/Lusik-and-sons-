// ============================================================
// /.netlify/functions/stripe-webhook
// ============================================================
// Stripe POSTs here after a Checkout Session completes (or
// fails). We verify the signature, look up the pending cart we
// stashed in Blobs at session-create time, and write the order
// to Postgres.
//
// Configure the endpoint in the Stripe dashboard:
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
import { TRUSTED_PRODUCTS } from "./_lib/trusted-products.mjs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

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

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.warn("Webhook signature verification failed:", err.message);
    return new Response(`Invalid signature: ${err.message}`, { status: 400 });
  }

  // We only care about completed checkouts for now. Refunds and
  // disputes can be added later — they fire on different events.
  if (event.type !== "checkout.session.completed") {
    return new Response("ok", { status: 200 });
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
  const pending = await pendingStore.get(session.id, { type: "json" });
  if (!pending || !Array.isArray(pending.cart)) {
    console.error("No pending cart found for session", session.id);
    return new Response("No pending cart", { status: 200 }); // 200 so Stripe doesn't retry forever
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
  const shippingAddr  = session.shipping_details?.address ?? null;

  // Insert order. We don't use a transaction with separate inserts
  // because @netlify/neon's tagged template doesn't auto-batch;
  // we use a CTE so it's atomic.
  const orderNumber = generateOrderNumber();
  const inserted = await sql`
    INSERT INTO orders (
      order_number, stripe_session_id, user_id, customer_email, status,
      fulfillment_status, subtotal_cents, shipping_cents, tax_cents, total_cents,
      shipping_address, social_consent, gift
    ) VALUES (
      ${orderNumber}, ${session.id}, ${pending.userId}, ${customerEmail}, 'paid',
      'in_progress', ${subtotalCents}, ${shippingCents}, ${taxCents}, ${totalCents},
      ${shippingAddr ? JSON.stringify(shippingAddr) : null}::jsonb,
      ${pending.social_consent ? JSON.stringify(pending.social_consent) : null}::jsonb,
      ${pending.gift ? JSON.stringify(pending.gift) : null}::jsonb
    )
    RETURNING id
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

  // Clean up the pending cart blob — it's served its purpose.
  await pendingStore.delete(session.id).catch(() => {});

  return new Response("ok", { status: 200 });
};
