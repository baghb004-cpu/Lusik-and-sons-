// ============================================================
// /.netlify/functions/stripe-webhook
// ============================================================
// Stripe POSTs here for events we've subscribed to. We verify
// the signature, dispatch on event type, and either record a
// new order or update an existing one.
//
// Subscribe these events in the Stripe dashboard:
//   - checkout.session.completed   (records new orders)
//   - checkout.session.expired     (sends cart-abandonment recovery email)
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
import { GIFT_WRAP_PRICE_CENTS } from "./_lib/pricing.mjs";
import {
  sendAdminOrderEmail,
  sendCustomerOrderConfirmation,
  sendRefundNotification,
  sendCartAbandonmentRecovery,
  sendEmail,
  esc,
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
    // Explicit tolerance of 300 seconds (Stripe's default, but spelled
    // out so the security model is reviewable). The signature carries
    // a fresh timestamp on every delivery and retry, so even a packet-
    // captured webhook can only be replayed within this window — and
    // each event type's idempotency path (ON CONFLICT for completed
    // orders, monotonic check for refunds, orders-exist check for
    // expired sessions) means a successful replay is inert anyway.
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
      300,
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
  if (event.type === "checkout.session.expired") {
    return await handleSessionExpired(event.data.object);
  }
  if (event.type === "payment_intent.payment_failed") {
    return await handlePaymentFailed(event.data.object);
  }
  if (event.type === "charge.dispute.created") {
    return await handleDisputeCreated(event.data.object);
  }
  if (event.type === "radar.early_fraud_warning.created") {
    return await handleFraudWarning(event.data.object);
  }
  if (event.type !== "checkout.session.completed") {
    return new Response("ok (ignored)", { status: 200 });
  }

  const session = event.data.object;

  // Idempotency is enforced atomically at INSERT time via
  // `ON CONFLICT (stripe_session_id) DO NOTHING RETURNING *`
  // (further down). Doing a SELECT-then-INSERT race-loses under
  // concurrent Stripe retries: two webhooks could both see "no
  // row," both try to insert, and the second one would crash on
  // the UNIQUE constraint with a 500 — which Stripe then retries
  // forever. The atomic version handles concurrency correctly.

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
      let recoveredGiftWrap = false;
      for (const li of lineItems.data) {
        const product = li.price?.product;
        const productKey = product?.metadata?.productKey;
        // Gift-wrap is an add-on line item, not a product entry in
        // TRUSTED_PRODUCTS. Detect it so Lusik knows to wrap the
        // package even when the pending blob was lost.
        if (productKey === "gift-wrap") {
          recoveredGiftWrap = true;
          continue;
        }
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
        // We can recover the wrap fact but not the message or
        // hide-prices flag — those only lived in the lost blob.
        // Marking is_gift = true is the conservative choice so
        // the admin email still surfaces "this is a gift."
        gift:           recoveredGiftWrap
                          ? { is_gift: true, message: "", hide_prices: false, wrap: true }
                          : null,
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

  // Refuse to insert an order row with zero trusted line items. Every
  // productKey in the cart was missing from TRUSTED_PRODUCTS (likely a
  // browser/server version skew where a renamed key shipped before the
  // trusted map deployed). 500 so Stripe retries — better to delay
  // than to write a $0 order Lusik can never fulfill.
  if (items.length === 0) {
    console.error("[webhook] No trusted items resolved for session", session.id, "— refusing to insert empty order");
    return new Response("No trusted items in cart", { status: 500 });
  }

  // Gift wrap is an add-on charge added by create-checkout-session
  // as a separate Stripe line item — not a row in pending.cart. To
  // keep subtotal + shipping + tax === total in the orders row, add
  // the wrap amount here when the flag is set.
  if (pending.gift?.wrap === true) {
    subtotalCents += GIFT_WRAP_PRICE_CENTS;
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
  // Atomic insert. ON CONFLICT (stripe_session_id) DO NOTHING +
  // RETURNING * means: if a concurrent webhook retry already wrote
  // this order, the second call gets an empty result instead of a
  // UNIQUE-violation crash. Empty result is the "duplicate" path —
  // skip everything (item inserts, emails, blob delete) and return
  // 200 so Stripe stops retrying.
  // Belt-and-suspenders sanitization for the customer note before
  // it lands in the DB. create-checkout-session already strips
  // control chars + caps length; we re-apply the same shape here so
  // any future code path that bypasses the function (e.g. a manual
  // pending-blob write during a backfill) can't smuggle bad data in.
  const customerNotes = (() => {
    const raw = pending.customer_notes;
    if (typeof raw !== "string") return null;
    const cleaned = raw.replace(/[\r\n\x00-\x1f\x7f]+/g, " ").trim().slice(0, 280);
    return cleaned.length > 0 ? cleaned : null;
  })();

  const inserted = await sql`
    INSERT INTO orders (
      order_number, stripe_session_id, stripe_payment_intent, user_id,
      customer_email, status, fulfillment_status,
      subtotal_cents, shipping_cents, tax_cents, total_cents,
      shipping_address, social_consent, gift, admin_notes,
      gift_reminder_opt_in, customer_notes
    ) VALUES (
      ${orderNumber}, ${session.id}, ${paymentIntent}, ${pending.userId},
      ${customerEmail}, 'paid', 'in_progress',
      ${subtotalCents}, ${shippingCents}, ${taxCents}, ${totalCents},
      ${shippingAddr ? JSON.stringify(shippingAddr) : null}::jsonb,
      ${pending.social_consent ? JSON.stringify(pending.social_consent) : null}::jsonb,
      ${pending.gift ? JSON.stringify(pending.gift) : null}::jsonb,
      ${reconstructedNote},
      ${giftReminderOptIn}, ${customerNotes}
    )
    ON CONFLICT (stripe_session_id) DO NOTHING
    RETURNING *
  `;
  if (inserted.length === 0) {
    // Another webhook delivery already wrote this order. Don't
    // re-insert line items, don't re-send emails, don't touch the
    // pending blob — the first call already handled all of that.
    return new Response("ok (duplicate)", { status: 200 });
  }
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

  // Monotonic guard. `charge.amount_refunded` is the CUMULATIVE
  // refunded total for the charge. We accept the event only when
  // it strictly grows the number we've recorded — which rejects
  // both (a) duplicate webhook deliveries of the same refund and
  // (b) out-of-order events that would otherwise lower a higher
  // recorded total. Using `===` for dedupe is wrong: if Lusik
  // issues two equal partial refunds back-to-back, the second
  // arrives with the SAME amount_refunded as the first plus
  // delta — only an inequality check catches "new total is
  // bigger" vs "old total again."
  const storedRefunded = order.refunded_cents ?? 0;
  if (refundedCents <= storedRefunded) {
    return new Response("ok (duplicate or out-of-order refund event)", { status: 200 });
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

// ============================================================
// checkout.session.expired — cart abandonment recovery
// ============================================================
// Stripe fires this event ~24 hours after a session is created
// if the customer never completed payment. The presence of the
// pending-orders blob for the session id means the order was
// never written (successful payments delete it). We use that as
// our "this customer abandoned" signal and send a single, gentle
// recovery email.
//
// One-shot: we delete the blob after sending so a re-fire of the
// event (which Stripe will retry on a non-2xx response) doesn't
// produce a second email.
// ============================================================
async function handleSessionExpired(session) {
  // Defensive race guard. Stripe normally won't fire `expired` for a
  // session that already completed — but webhook event delivery
  // ordering isn't guaranteed, and an `expired` event delivered
  // late (after `completed` already wrote the order) would otherwise
  // send a "we saved your spot" email to someone who already paid.
  // Check the orders table first; if a row exists for this session
  // we're past the point where recovery makes sense.
  const existing = await sql`
    SELECT id FROM orders WHERE stripe_session_id = ${session.id} LIMIT 1
  `;
  if (existing.length > 0) {
    return new Response("ok (already converted)", { status: 200 });
  }

  const pendingStore = getStore({ name: "pending-orders", consistency: "strong" });
  const pending = await pendingStore.get(session.id, { type: "json" });

  // No stash means either (a) the order was completed and the
  // success handler already cleaned up, or (b) the stash never
  // got written (4s Blobs timeout in create-checkout-session).
  // In either case there's nothing to recover.
  if (!pending || !Array.isArray(pending.cart) || pending.cart.length === 0) {
    return new Response("ok (no pending cart)", { status: 200 });
  }

  // Recipient. Pending has the email we stashed at session create;
  // fall back to Stripe's own customer_details in case the customer
  // typed an email on the hosted checkout page that we didn't have.
  const to = pending.customerEmail
          ?? session.customer_details?.email
          ?? null;
  if (!to) {
    // No way to reach them. Clean up the stash so the blob store
    // doesn't accumulate orphans forever and move on.
    await pendingStore.delete(session.id).catch(() => {});
    return new Response("ok (no recipient)", { status: 200 });
  }

  // Build a trusted-products summary of what was in the cart. We
  // intentionally don't trust prices in the blob — TRUSTED_PRODUCTS
  // is the source of truth, same as the order-completion path.
  let totalCents = 0;
  const items = [];
  for (const i of pending.cart) {
    const t = TRUSTED_PRODUCTS[i.productKey];
    if (!t) continue;
    const qty = Number.isInteger(i.qty) && i.qty > 0 ? i.qty : 1;
    totalCents += t.priceCents * qty;
    items.push({
      productName:   t.name,
      variantLabel:  [t.variant, i.subtitle, i.size].filter(Boolean).join(" · "),
      quantity:      qty,
      unitPriceCents:t.priceCents,
    });
  }

  // Nothing recognizable to remind them about — skip the email but
  // still clean up the stash.
  if (items.length === 0) {
    await pendingStore.delete(session.id).catch(() => {});
    return new Response("ok (no trusted items)", { status: 200 });
  }

  await sendCartAbandonmentRecovery({ to, items, totalCents })
    .catch((err) => console.warn("[webhook] cart-recovery email failed:", err?.message ?? err));

  // One-shot: delete the stash so we never double-email even if
  // Stripe retries the event for some reason.
  await pendingStore.delete(session.id).catch(() => {});

  return new Response("ok", { status: 200 });
}


// ----------------------------------------------------------------
// New webhook event handlers added 2026-05-17
// Each emails admin via Resend. No DB writes -- those can be
// added in a follow-up PR once the schema has a webhook_events table.
// ----------------------------------------------------------------

async function handlePaymentFailed(intent) {
  console.log("[webhook] payment_intent.payment_failed", intent.id);
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) return new Response("ok", { status: 200 });
  const amount = ((intent.amount || 0) / 100).toFixed(2);
  const currency = (intent.currency || "usd").toUpperCase();
  const reason = (intent.last_payment_error && intent.last_payment_error.message) || "no error message";
  const email = intent.receipt_email || "(unknown)";
  await sendEmail({
    to: adminEmail,
    subject: "Stripe payment failed (" + currency + " " + amount + ")",
    html: "<h2>Stripe payment failed</h2><p><b>Amount:</b> " + currency + " " + amount + "</p><p><b>Customer:</b> " + esc(email) + "</p><p><b>Reason:</b> " + esc(reason) + "</p><p><b>PaymentIntent:</b> " + esc(intent.id) + "</p><p>No order created -- this was a failed attempt.</p><p>See Stripe dashboard: https://dashboard.stripe.com/payments/" + esc(intent.id) + "</p>",
  });
  return new Response("ok", { status: 200 });
}

async function handleDisputeCreated(dispute) {
  console.log("[webhook] charge.dispute.created", dispute.id);
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) return new Response("ok", { status: 200 });
  const amount = ((dispute.amount || 0) / 100).toFixed(2);
  const currency = (dispute.currency || "usd").toUpperCase();
  const reason = dispute.reason || "unknown";
  const dueBy = (dispute.evidence_details && dispute.evidence_details.due_by) ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : "see Stripe dashboard";
  await sendEmail({
    to: adminEmail,
    subject: "URGENT: Stripe dispute opened (" + currency + " " + amount + ") -- respond within 7 days",
    html: "<h2>New Stripe dispute / chargeback</h2><p><b>Amount:</b> " + currency + " " + amount + "</p><p><b>Reason:</b> " + esc(reason) + "</p><p><b>Dispute ID:</b> " + esc(dispute.id) + "</p><p><b>Deadline:</b> " + esc(dueBy) + "</p><p>You typically have ~7 days to submit evidence.</p><p>See dispute: https://dashboard.stripe.com/disputes/" + esc(dispute.id) + "</p>",
  });
  return new Response("ok", { status: 200 });
}

async function handleFraudWarning(warning) {
  console.log("[webhook] radar.early_fraud_warning.created", warning.id);
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) return new Response("ok", { status: 200 });
  const fraudType = warning.fraud_type || "unknown";
  await sendEmail({
    to: adminEmail,
    subject: "Stripe Radar fraud warning -- review or refund",
    html: "<h2>Early fraud warning from Stripe Radar</h2><p>Refund within ~48h typically avoids the chargeback.</p><p><b>Fraud type:</b> " + esc(fraudType) + "</p><p><b>Charge:</b> " + esc(warning.charge) + "</p><p><b>Warning ID:</b> " + esc(warning.id) + "</p><p>See: https://dashboard.stripe.com/payments/" + esc(warning.charge) + "</p>",
  });
  return new Response("ok", { status: 200 });
}
