// ============================================================
// Email helper — Resend transactional emails
// ============================================================
// One thin wrapper around Resend's HTTP API plus one composer
// that builds the admin-order-notification email body. Used by
// the Stripe webhook to notify Lusik when a new order lands.
//
// Why Resend specifically:
//   - 100 emails/day on the free tier (more than Lusik will
//     hit at current volume); 3,000/month free.
//   - HTTP API, no SMTP. Works directly from a Netlify Function
//     with a single fetch() call — no extra npm dependency.
//   - Modern deliverability (DKIM + SPF on their managed domain
//     before Lusik's own domain is verified).
//
// Required env vars (set in Netlify dashboard → Site →
// Environment):
//   RESEND_API_KEY            — from resend.com/api-keys
//   ADMIN_NOTIFICATION_EMAIL  — where order notifications land
//                               (e.g. hello@lusikandsons.com)
//   RESEND_FROM_EMAIL         — sender address; must be on a
//                               domain verified with Resend OR
//                               use Resend's onboarding default
//                               "onboarding@resend.dev" for
//                               first-deploy testing (will land
//                               in spam until domain is verified)
//
// Setup steps the human has to do once:
//   1. Sign up at resend.com (free, no card required)
//   2. Generate an API key, paste into Netlify env vars
//   3. Add lusikandsons.com as a domain in Resend → verify the
//      DNS records they give you (TXT/CNAME on the domain
//      hosting). Until verified, emails go from resend.dev.
//
// All functions in this file return a Promise<boolean> rather
// than throwing — email is a NICE-TO-HAVE on the order path,
// not a blocker. If the API key is missing or the send fails,
// we log and move on; the order is still recorded and Lusik
// can see it in the admin panel either way.
// ============================================================

import { CONTACT } from "./contact.mjs";

const RESEND_API_URL = "https://api.resend.com/emails";

// Shared brand palette. Previously redeclared inside every composer;
// hoisting it here means a color change ripples through every email
// in one edit, and composers don't drift apart as new ones are added.
export const PALETTE = Object.freeze({
  accent: "#B08842",
  ink:    "#1A1612",
  cream:  "#F5EFE3",
  muted:  "#6B655D",
});

// Resolves the public site URL at call time so a deploy can change
// the Netlify-injected URL env var without rebuilding.
export function baseUrl() {
  return process.env.URL || "https://lusikandsons.com";
}

/**
 * Generic Resend send. Returns true on 2xx, false otherwise.
 * Never throws — callers shouldn't have to wrap in try/catch.
 *
 * `attachments` (optional): [{ filename, content }] with base64
 * content — Resend's native shape, used for the embroidery-order
 * .pes file. `replyTo` (optional) sets Resend's reply_to so a
 * plain reply in the mail client reaches the requester.
 */
export async function sendEmail({ to, subject, html, text, attachments, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set; skipping send to", to);
    return false;
  }
  const from = process.env.RESEND_FROM_EMAIL || "Lusik & Sons <hello@lusikandsons.com>";
  try {
    const payload = { from, to, subject, html, text };
    if (attachments?.length) payload.attachments = attachments;
    if (replyTo) payload.reply_to = replyTo;
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("[email] Resend returned", res.status, errText);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[email] send failed:", err?.message ?? err);
    return false;
  }
}

// HTML-escape user-controlled strings before interpolating into
// the email body. Resend won't sanitize for us, and a customer
// name with "<" in it shouldn't break the layout.
export function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Sanitize a user-controlled string before placing it in a Resend
// `subject` field (which becomes part of the SMTP envelope).
// Strips CR/LF + other control characters so a string containing
// "\r\nBcc: attacker@evil.com" cannot smuggle a header. Resend's
// HTTP API likely also rejects this shape, but we don't want to
// trust that downstream.
//
// Hard cap at 200 chars — Subject lines beyond ~78 chars get
// wrapped or truncated by most clients anyway, and this caps the
// damage from a 50KB string burning Resend bandwidth.
export function headerSafe(s, max = 200) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[\r\n\x00-\x1f\x7f]+/g, " ").trim().slice(0, max);
}

function dollars(cents) {
  return `$${((cents ?? 0) / 100).toFixed(2)}`;
}

// Build a tight one-line description for an order item, mostly
// for the email subject line and the line-items list. Pulls
// design metadata when present (blanket variants), falls back
// to product_name otherwise.
function summarizeItem(item) {
  const meta = item.customMetadata ?? item.custom_metadata ?? {};
  const parts = [];
  if (meta.alphabet_label) parts.push(meta.alphabet_label);
  if (meta.layout_short_label || meta.layout_label) {
    parts.push(meta.layout_short_label ?? meta.layout_label);
  }
  if (meta.block_color_name) {
    parts.push(`${meta.block_color_name} cube`);
  }
  if (meta.letter_color_name && !meta.letter_colors_multi) {
    parts.push(`${meta.letter_color_name} letters`);
  }
  if (meta.letter_colors_multi) {
    parts.push(`multi-color letters (${meta.letter_colors_multi})`);
  }
  if (meta.custom_line_1 || meta.custom_line_2) {
    const bits = [meta.custom_line_1, meta.custom_line_2].filter(Boolean).map((s) => `"${s}"`).join(" / ");
    parts.push(`personalization: ${bits}`);
  }
  return parts.join(" · ");
}

/**
 * Send the admin-order-notification email to Lusik when a new
 * order has been recorded.
 *
 * `order`  — the row that was just inserted into the orders table
 * `items`  — the line items (each has productName, variantLabel,
 *            quantity, unitPriceCents, customMetadata)
 * `pending` — the original cart payload stashed at checkout-create
 *             time (used for gift options + social-share consent)
 */
export async function sendAdminOrderEmail({ order, items, pending }) {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!to) {
    console.warn("[email] ADMIN_NOTIFICATION_EMAIL not set; skipping admin notification");
    return false;
  }

  const orderNumber  = order.order_number ?? order.id;
  const customerName = pending?.cart?.[0]?.customer_name
                    ?? order.shipping_address?.name
                    ?? "";
  const customerEmail = order.customer_email ?? "";
  const shipping     = order.shipping_address ?? {};
  const isGift       = pending?.gift?.is_gift === true;
  const giftMessage  = pending?.gift?.message ?? "";
  const giftHidePrices = pending?.gift?.hide_prices === true;
  const giftWrap     = pending?.gift?.wrap === true;
  const social       = pending?.social_consent ?? null;
  const customerNotes = typeof pending?.customer_notes === "string" ? pending.customer_notes : "";

  // Compact subject line — order number, total, brief item count.
  const itemSummary = items.length === 1
    ? items[0].productName
    : `${items.length} items`;
  const subject = `New order ${orderNumber} · ${dollars(order.total_cents)} · ${itemSummary}${isGift ? " · gift" : ""}`;

  // -------- HTML body --------
  // Single-column, basic email-safe HTML. No external CSS, no
  // images — everything inline so it renders identically in
  // Apple Mail, Gmail, Outlook web, mobile clients.
  const { accent, ink, muted } = PALETTE;

  const itemRows = items.map((it) => {
    const variant = summarizeItem(it) || it.variantLabel || "";
    return `
      <tr>
        <td style="padding:10px 0;border-top:1px solid #E8E1D2;vertical-align:top;">
          <div style="font-weight:600;color:${ink};">${esc(it.productName)} ${it.quantity > 1 ? `× ${it.quantity}` : ""}</div>
          ${variant ? `<div style="font-size:13px;color:${muted};margin-top:4px;line-height:1.5;">${esc(variant)}</div>` : ""}
        </td>
        <td style="padding:10px 0;border-top:1px solid #E8E1D2;text-align:right;vertical-align:top;color:${ink};font-weight:500;white-space:nowrap;">
          ${dollars(it.unitPriceCents * it.quantity)}
        </td>
      </tr>
    `;
  }).join("");

  const giftBlock = isGift ? `
    <div style="margin:20px 0;padding:14px 16px;background:#FAF1DF;border-left:3px solid ${accent};">
      <div style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:${accent};font-weight:600;margin-bottom:8px;">This is a gift</div>
      ${giftMessage ? `<div style="font-style:italic;color:${ink};margin-bottom:8px;line-height:1.5;">"${esc(giftMessage)}"</div>` : ""}
      ${giftWrap ? `<div style="font-size:13px;color:${ink};margin-bottom:4px;"><strong>★ Gift wrap requested</strong> — tissue + twine.</div>` : ""}
      ${giftHidePrices ? `<div style="font-size:13px;color:${ink};"><strong>⚠ Hide prices from the packing slip.</strong></div>` : ""}
    </div>
  ` : "";

  const customerNotesBlock = customerNotes ? `
    <div style="margin:20px 0;padding:14px 16px;background:#F0F1F3;border-left:3px solid ${ink};">
      <div style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:${ink};font-weight:600;margin-bottom:8px;">Note from the customer</div>
      <div style="font-size:13px;color:${ink};line-height:1.6;">${esc(customerNotes)}</div>
    </div>
  ` : "";

  const socialBlock = social?.allowed ? `
    <div style="margin:20px 0;padding:14px 16px;background:#F4F7F2;border-left:3px solid #5B7A4E;">
      <div style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#5B7A4E;font-weight:600;margin-bottom:8px;">Social-share consent</div>
      <div style="font-size:13px;color:${ink};line-height:1.6;">
        Opted in to: <strong>${esc((social.platforms ?? []).join(", ") || "—")}</strong>
        ${social.handles && Object.keys(social.handles).length > 0
          ? `<div style="margin-top:6px;">Handles: ${Object.entries(social.handles).map(([k, v]) => `${esc(k)} <strong>${esc(v)}</strong>`).join(" · ")}</div>`
          : ""}
      </div>
    </div>
  ` : "";

  const shippingBlock = shipping && (shipping.line1 || shipping.address_line1 || shipping.city) ? `
    <div style="margin-top:20px;">
      <div style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:${muted};font-weight:600;margin-bottom:6px;">Ship to</div>
      <div style="color:${ink};line-height:1.6;">
        ${customerName ? `${esc(customerName)}<br>` : ""}
        ${esc(shipping.line1 ?? shipping.address_line1 ?? "")}
        ${(shipping.line2 ?? shipping.address_line2) ? `<br>${esc(shipping.line2 ?? shipping.address_line2)}` : ""}
        <br>${esc(shipping.city ?? "")}, ${esc(shipping.state ?? shipping.region ?? "")} ${esc(shipping.postal_code ?? shipping.zip ?? "")}
        ${shipping.country ? `<br>${esc(shipping.country)}` : ""}
      </div>
    </div>
  ` : "";

  const url = baseUrl();
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#F5EFE3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${ink};">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:${accent};font-weight:600;margin-bottom:8px;">New order</div>
    <h1 style="font-size:28px;font-weight:500;margin:0 0 4px 0;letter-spacing:-0.01em;">${esc(orderNumber)}</h1>
    <div style="color:${muted};font-size:14px;">${dollars(order.total_cents)} · ${new Date(order.created_at ?? Date.now()).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}</div>

    ${giftBlock}
    ${customerNotesBlock}

    <h2 style="font-size:14px;letter-spacing:0.2em;text-transform:uppercase;color:${muted};font-weight:600;margin:28px 0 12px 0;">Items</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td style="padding:14px 0 0 0;border-top:2px solid ${ink};color:${ink};font-weight:600;">Total</td>
          <td style="padding:14px 0 0 0;border-top:2px solid ${ink};text-align:right;color:${ink};font-weight:600;">${dollars(order.total_cents)}</td>
        </tr>
      </tfoot>
    </table>

    <h2 style="font-size:14px;letter-spacing:0.2em;text-transform:uppercase;color:${muted};font-weight:600;margin:28px 0 12px 0;">Customer</h2>
    <div style="color:${ink};line-height:1.6;">
      ${customerName ? `${esc(customerName)}<br>` : ""}
      <a href="mailto:${esc(customerEmail)}" style="color:${accent};text-decoration:none;">${esc(customerEmail)}</a>
    </div>
    ${shippingBlock}

    ${socialBlock}

    <div style="margin-top:36px;padding-top:20px;border-top:1px solid #E8E1D2;">
      <a href="${url}/#admin" style="display:inline-block;padding:12px 20px;background:${ink};color:#F5EFE3;text-decoration:none;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;font-weight:500;">
        Open admin panel →
      </a>
    </div>

    <div style="margin-top:32px;font-size:11px;color:${muted};line-height:1.6;">
      This is an automated order notification from your Lusik & Sons site.<br>
      Sent to ${esc(to)} because it's the address in your ADMIN_NOTIFICATION_EMAIL env var.
    </div>
  </div>
</body></html>`;

  // -------- Plain-text fallback --------
  const itemLines = items.map((it) => {
    const variant = summarizeItem(it) || it.variantLabel || "";
    const qty = it.quantity > 1 ? ` × ${it.quantity}` : "";
    const price = dollars(it.unitPriceCents * it.quantity);
    return `  • ${it.productName}${qty} — ${price}${variant ? `\n    ${variant}` : ""}`;
  }).join("\n");

  const text = [
    `NEW ORDER — ${orderNumber}`,
    `${dollars(order.total_cents)} · ${new Date(order.created_at ?? Date.now()).toLocaleString()}`,
    "",
    isGift ? `★ THIS IS A GIFT${giftMessage ? `\n  Message: "${giftMessage}"` : ""}${giftWrap ? "\n  ★ Gift wrap requested" : ""}${giftHidePrices ? "\n  ⚠ Hide prices from packing slip" : ""}\n` : "",
    customerNotes ? `NOTE FROM THE CUSTOMER\n  ${customerNotes}\n` : "",
    `ITEMS`,
    itemLines,
    `  Total: ${dollars(order.total_cents)}`,
    "",
    `CUSTOMER`,
    customerName ? `  ${customerName}` : "",
    `  ${customerEmail}`,
    "",
    shipping && (shipping.line1 || shipping.address_line1) ? `SHIP TO
  ${shipping.line1 ?? shipping.address_line1 ?? ""}${(shipping.line2 ?? shipping.address_line2) ? `\n  ${shipping.line2 ?? shipping.address_line2}` : ""}
  ${shipping.city ?? ""}, ${shipping.state ?? shipping.region ?? ""} ${shipping.postal_code ?? shipping.zip ?? ""}` : "",
    "",
    social?.allowed ? `SOCIAL-SHARE CONSENT
  Opted in to: ${(social.platforms ?? []).join(", ")}${
    social.handles && Object.keys(social.handles).length > 0
      ? `\n  Handles: ${Object.entries(social.handles).map(([k, v]) => `${k} ${v}`).join(" · ")}`
      : ""
  }` : "",
    "",
    `Open admin panel: ${url}/#admin`,
  ].filter(Boolean).join("\n");

  return await sendEmail({ to, subject, html, text });
}

/**
 * Send the customer order-confirmation email. Different goal
 * from the admin notification: this one's about warmth and
 * setting expectations. The customer already got Stripe's
 * generic receipt; ours fills in what Stripe can't say —
 * "Lusik has your order, here's what comes next."
 *
 * `order`, `items`, `pending` — same shapes as the admin email.
 * `customerName` — string or null. Used to greet the customer
 *                   by name when available.
 */
export async function sendCustomerOrderConfirmation({ order, items, pending, customerName }) {
  const customerEmail = order.customer_email;
  if (!customerEmail) {
    console.warn("[email] customer email missing; skipping customer confirmation");
    return false;
  }

  const orderNumber = order.order_number ?? order.id;
  const isGift = pending?.gift?.is_gift === true;
  const giftMessage = pending?.gift?.message ?? "";
  const ship = order.shipping_address ?? {};
  const recipientName = ship.name || (isGift ? "your recipient" : null);
  const greeting = customerName ? `Hi ${customerName.split(" ")[0]},` : "Hi there,";

  const subject = isGift
    ? `Your gift order is in — Lusik is starting`
    : `Lusik is starting on your order`;

  // -------- HTML body --------
  const { accent, ink, cream, muted } = PALETTE;

  const itemRows = items.map((it) => {
    const variant = summarizeItem(it) || it.variantLabel || "";
    const qty = it.quantity > 1 ? ` × ${it.quantity}` : "";
    return `
      <div style="padding:14px 0;border-top:1px solid #E8E1D2;">
        <div style="font-weight:600;color:${ink};">${esc(it.productName)}${qty}</div>
        ${variant ? `<div style="font-size:13px;color:${muted};margin-top:4px;line-height:1.5;">${esc(variant)}</div>` : ""}
      </div>
    `;
  }).join("");

  const giftRecap = isGift ? `
    <div style="margin:24px 0;padding:16px 18px;background:#FAF1DF;border-left:3px solid ${accent};">
      <div style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:${accent};font-weight:600;margin-bottom:10px;">Gift details we have</div>
      <div style="font-size:14px;color:${ink};line-height:1.6;">
        Shipping to${recipientName ? ` <strong>${esc(recipientName)}</strong>` : ""} in ${esc(ship.city ?? "")}, ${esc(ship.state ?? ship.region ?? "")}.
        ${giftMessage ? `<div style="margin-top:10px;font-style:italic;">Your message: "${esc(giftMessage)}"</div>` : ""}
        ${pending?.gift?.wrap ? `<div style="margin-top:10px;font-size:13px;">Gift wrap added — wrap in tissue and twine before shipping.</div>` : ""}
        ${pending?.gift?.hide_prices ? `<div style="margin-top:10px;font-size:13px;">We'll keep prices off the packing slip as requested.</div>` : ""}
      </div>
    </div>
  ` : "";

  const url = baseUrl();
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${ink};line-height:1.6;">
  <div style="max-width:560px;margin:0 auto;padding:36px 24px;">

    <div style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:${accent};font-weight:600;margin-bottom:14px;">Lusik &amp; Sons</div>

    <h1 style="font-size:30px;font-weight:500;margin:0 0 14px 0;letter-spacing:-0.01em;line-height:1.2;">
      Thank you, ${esc(customerName ? customerName.split(" ")[0] : "")}— Lusik is starting on your order.
    </h1>

    <p style="font-size:16px;color:${ink};margin:0 0 6px 0;">
      ${esc(greeting)}
    </p>
    <p style="font-size:16px;color:${ink};margin:0 0 22px 0;">
      ${isGift
        ? "Lusik has your gift order. She'll start hand-stitching within a day or two."
        : "Lusik has your order. She'll start hand-stitching within a day or two."}
    </p>

    <div style="margin:24px 0;padding:18px 20px;background:#FFFFFF;border:1px solid #E8E1D2;">
      <div style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:${muted};font-weight:600;margin-bottom:12px;">What happens next</div>
      <ul style="margin:0;padding:0 0 0 20px;font-size:14px;color:${ink};">
        <li style="margin-bottom:8px;">Each blanket is hand cross-stitched — usually 5 to 10 business days before it's ready.</li>
        <li style="margin-bottom:8px;">Before it ships, we'll email you a photo of the finished piece. Small keepsake for now and forever.</li>
        <li style="margin-bottom:0;">When it ships, you'll get a tracking number from the carrier (USPS, UPS, or FedEx).</li>
      </ul>
    </div>

    ${giftRecap}

    <div style="margin:24px 0 8px 0;">
      <div style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:${muted};font-weight:600;margin-bottom:4px;">Order ${esc(orderNumber)}</div>
      ${itemRows}
      <div style="padding:14px 0;border-top:2px solid ${ink};display:flex;justify-content:space-between;color:${ink};font-weight:600;">
        <span>Total</span>
        <span>${dollars(order.total_cents)}</span>
      </div>
    </div>

    <p style="margin:28px 0 6px 0;font-size:14px;color:${muted};">
      If anything is wrong — a name spelling, a color, second thoughts — please reach out now, before Lusik begins stitching:
    </p>
    <p style="margin:0 0 28px 0;font-size:14px;color:${ink};">
      <a href="mailto:${CONTACT.email}" style="color:${accent};text-decoration:none;">${CONTACT.email}</a>
      ${" · "}
      <a href="tel:${CONTACT.phoneTel}" style="color:${accent};text-decoration:none;">${CONTACT.phoneDisplay}</a>
    </p>

    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #E8E1D2;font-size:12px;color:${muted};line-height:1.6;">
      <em>Made by hand in Southern California.</em><br>
      Lusik &amp; Sons · <a href="${url}" style="color:${muted};text-decoration:underline;">lusikandsons.com</a>
    </div>

  </div>
</body></html>`;

  // -------- Plain-text fallback --------
  const itemLines = items.map((it) => {
    const variant = summarizeItem(it) || it.variantLabel || "";
    const qty = it.quantity > 1 ? ` × ${it.quantity}` : "";
    return `  • ${it.productName}${qty}${variant ? `\n    ${variant}` : ""}`;
  }).join("\n");

  const text = [
    `LUSIK & SONS`,
    "",
    `Thank you — Lusik is starting on your order.`,
    "",
    greeting,
    "",
    isGift
      ? "Lusik has your gift order. She'll start hand-stitching within a day or two."
      : "Lusik has your order. She'll start hand-stitching within a day or two.",
    "",
    `What happens next:`,
    `  • Each blanket is hand cross-stitched — usually 5 to 10 business days before it's ready.`,
    `  • Before it ships, we'll email a photo of the finished piece.`,
    `  • When it ships, you'll get a tracking number.`,
    "",
    isGift ? `GIFT DETAILS\n  Shipping to${recipientName ? ` ${recipientName}` : ""} in ${ship.city ?? ""}, ${ship.state ?? ship.region ?? ""}.${giftMessage ? `\n  Your message: "${giftMessage}"` : ""}${pending?.gift?.wrap ? `\n  Gift wrap will be added before shipping.` : ""}${pending?.gift?.hide_prices ? `\n  We'll keep prices off the packing slip as requested.` : ""}\n` : "",
    `ORDER ${orderNumber}`,
    itemLines,
    `  Total: ${dollars(order.total_cents)}`,
    "",
    `If anything is wrong, reach out now before Lusik begins stitching:`,
    `  ${CONTACT.email}`,
    `  ${CONTACT.phoneDisplay}`,
    "",
    `Made by hand in Southern California.`,
    `${url}`,
  ].filter(Boolean).join("\n");

  return await sendEmail({ to: customerEmail, subject, html, text });
}

/**
 * Send the "Lusik just finished your piece" email — fired the
 * first time Lusik uploads a finished-piece photo for an order.
 * orders.finished_photo_emailed_at gates this so re-uploads or
 * replacements don't re-trigger the email.
 *
 * Why we don't embed the photo: the photo is gated behind a
 * customer-auth check (only the order's user_id, or an admin,
 * can fetch it via order-photo-get). Embedding in an email
 * would either require a signed-token bypass or making the
 * URL public — both add complexity for limited gain, and most
 * email clients strip images from unknown senders by default
 * anyway. Instead we send a tasteful "view your finished
 * blanket →" CTA that takes the customer to their account
 * page, where the photo is rendered with their other order
 * details.
 *
 * `order` — the orders row (post-upload; finished_photo_key is
 *           set; shipping_address.name is the recipient when present)
 */
export async function sendFinishedPhotoNotification({ order }) {
  const to = order.customer_email;
  if (!to) {
    console.warn("[email] customer email missing on finished-photo notification; skipping");
    return false;
  }

  const orderNumber  = order.order_number ?? order.id;
  const ship         = order.shipping_address ?? {};
  const customerName = ship.name ?? null;
  const greeting     = customerName ? `Hi ${customerName.split(" ")[0]},` : "Hi there,";
  const isGift       = order.gift?.is_gift === true;

  // Slightly different subject + first line for gifts vs.
  // self-purchases. The buyer of a gift hasn't seen the
  // physical piece — they're forwarding the experience.
  const subject = isGift
    ? `A photo of the finished gift — ${orderNumber}`
    : `Lusik just finished your blanket`;

  const { accent, ink, cream, muted } = PALETTE;
  const url = baseUrl();

  const openingLine = isGift
    ? "Lusik just finished the blanket you ordered. Here's a photo before it ships."
    : "Lusik just finished your blanket. Here's a photo before it ships out.";

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${ink};line-height:1.6;">
  <div style="max-width:560px;margin:0 auto;padding:36px 24px;">

    <div style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:${accent};font-weight:600;margin-bottom:14px;">From Lusik &amp; Sons</div>

    <h1 style="font-size:30px;font-weight:500;margin:0 0 14px 0;letter-spacing:-0.01em;line-height:1.2;">
      ${isGift ? "The gift you ordered is ready." : "Your blanket is ready."}
    </h1>

    <p style="font-size:16px;color:${ink};margin:0 0 6px 0;">${esc(greeting)}</p>
    <p style="font-size:16px;color:${ink};margin:0 0 22px 0;">${esc(openingLine)}</p>

    <div style="margin:24px 0;padding:24px;background:#FFFFFF;border:1px solid #E8E1D2;text-align:center;">
      <div style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:${accent};font-weight:600;margin-bottom:14px;">Photo of your finished piece</div>
      <p style="font-size:14px;color:${ink};margin:0 0 18px 0;line-height:1.6;">
        We've added it to your order page — sign in and have a look. It stays there as a small keepsake, available any time you'd like to see it again.
      </p>
      <a href="${url}/" style="display:inline-block;padding:12px 22px;background:${ink};color:${cream};text-decoration:none;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;font-weight:500;">
        View the photo →
      </a>
    </div>

    <p style="margin:24px 0 6px 0;font-size:14px;color:${muted};">
      Order <span style="color:${ink};font-weight:500;">${esc(orderNumber)}</span> ${isGift ? "ships to the address you provided" : "ships to your address"} in the next day or two. You'll get a tracking number by email when it goes out.
    </p>

    <p style="margin:18px 0 6px 0;font-size:14px;color:${muted};">
      One last chance — if anything looks off in the photo, tell us before it ships:
    </p>
    <p style="margin:0 0 28px 0;font-size:14px;color:${ink};">
      <a href="mailto:${CONTACT.email}" style="color:${accent};text-decoration:none;">${CONTACT.email}</a>
      ${" · "}
      <a href="tel:${CONTACT.phoneTel}" style="color:${accent};text-decoration:none;">${CONTACT.phoneDisplay}</a>
    </p>

    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #E8E1D2;font-size:12px;color:${muted};line-height:1.6;">
      <em>Made by hand in Southern California.</em><br>
      Lusik &amp; Sons · <a href="${url}" style="color:${muted};text-decoration:underline;">lusikandsons.com</a>
    </div>

  </div>
</body></html>`;

  const text = [
    `LUSIK & SONS`,
    "",
    isGift ? `The gift you ordered is ready.` : `Your blanket is ready.`,
    "",
    greeting,
    "",
    openingLine,
    "",
    `A photo of your finished piece is on your order page. Sign in and have`,
    `a look — it stays there as a small keepsake, available any time:`,
    `  ${url}`,
    "",
    `Order ${orderNumber} ships in the next day or two. You'll get a`,
    `tracking number by email when it goes out.`,
    "",
    `If anything looks off in the photo, tell us before it ships:`,
    `  ${CONTACT.email}`,
    `  ${CONTACT.phoneDisplay}`,
    "",
    `Made by hand in Southern California.`,
    `${url}`,
  ].join("\n");

  return await sendEmail({ to, subject, html, text });
}

// Mirror of the browser-side getTrackingUrl helper (src/lib/tracking.ts).
// Kept here (rather than imported across the JS/server boundary)
// because _lib/ functions can't reach into the browser bundle, and
// the URL shapes don't change often. Keep this in sync if a carrier
// changes their public tracking URL pattern.
function getTrackingUrl(carrier, trackingNumber) {
  if (!trackingNumber || !carrier) return null;
  const c = carrier.toLowerCase();
  if (c.includes("usps"))  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`;
  if (c.includes("ups"))   return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?tracknumbers=${encodeURIComponent(trackingNumber)}`;
  return null;
}

/**
 * Send the "your order shipped" email to the customer. Fired
 * by the admin-orders Function the first time Lusik flips an
 * order's fulfillment_status to "shipped." The orders.shipped_at
 * column gates this — once set, the email isn't re-fired even
 * if Lusik toggles status back and forth.
 *
 * `order` — the orders row (post-update, with carrier + tracking
 *           number set; shipping_address.name has the recipient)
 */
export async function sendShippedNotification({ order }) {
  const to = order.customer_email;
  if (!to) {
    console.warn("[email] customer email missing on shipped notification; skipping");
    return false;
  }

  const orderNumber  = order.order_number ?? order.id;
  const ship         = order.shipping_address ?? {};
  const customerName = ship.name ?? null;
  const greeting     = customerName ? `Hi ${customerName.split(" ")[0]},` : "Hi there,";
  const carrier      = order.carrier ?? "";
  const tracking     = order.tracking_number ?? "";
  const trackUrl     = getTrackingUrl(carrier, tracking);
  const hasPhoto     = !!order.finished_photo_key;

  const subject = tracking
    ? `Your order is on its way — ${orderNumber}`
    : `Your order has shipped — ${orderNumber}`;

  const { accent, ink, cream, muted } = PALETTE;

  const url = baseUrl();

  const trackingBlock = tracking ? `
    <div style="margin:22px 0;padding:18px 20px;background:#FFFFFF;border:1px solid #E8E1D2;">
      <div style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:${muted};font-weight:600;margin-bottom:10px;">Tracking</div>
      <div style="font-size:14px;color:${ink};line-height:1.6;margin-bottom:12px;">
        ${esc(carrier)} · <span style="font-family:'SF Mono',Monaco,Consolas,monospace;font-size:13px;">${esc(tracking)}</span>
      </div>
      ${trackUrl ? `
        <a href="${trackUrl}" style="display:inline-block;padding:10px 18px;background:${ink};color:${cream};text-decoration:none;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;font-weight:500;">
          Track package →
        </a>` : `<div style="font-size:13px;color:${muted};">Tracking link available from ${esc(carrier)}.</div>`
      }
    </div>
  ` : "";

  const photoBlock = hasPhoto ? `
    <div style="margin:22px 0;padding:16px 18px;background:#FAF1DF;border-left:3px solid ${accent};">
      <div style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:${accent};font-weight:600;margin-bottom:8px;">A photo of your finished piece</div>
      <div style="font-size:14px;color:${ink};line-height:1.6;">
        Lusik snapped a photo of the finished blanket before packing it up. You can see it any time on your order in your account:
        <div style="margin-top:10px;">
          <a href="${url}/" style="color:${accent};text-decoration:none;font-weight:500;">View your order →</a>
        </div>
      </div>
    </div>
  ` : "";

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${ink};line-height:1.6;">
  <div style="max-width:560px;margin:0 auto;padding:36px 24px;">

    <div style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:${accent};font-weight:600;margin-bottom:14px;">Lusik &amp; Sons</div>

    <h1 style="font-size:30px;font-weight:500;margin:0 0 14px 0;letter-spacing:-0.01em;line-height:1.2;">
      ${tracking ? "Your order is on its way." : "Your order has shipped."}
    </h1>

    <p style="font-size:16px;color:${ink};margin:0 0 6px 0;">${esc(greeting)}</p>
    <p style="font-size:16px;color:${ink};margin:0 0 22px 0;">
      Lusik finished your piece and ${tracking ? "handed it to" : "shipped it with"} ${esc(carrier || "the carrier")}. ${tracking ? "Most ground shipments land within 3 to 5 business days." : ""}
    </p>

    ${trackingBlock}

    ${photoBlock}

    <div style="margin:24px 0;padding:18px 20px;background:#FFFFFF;border:1px solid #E8E1D2;">
      <div style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:${muted};font-weight:600;margin-bottom:10px;">When it arrives</div>
      <div style="font-size:14px;color:${ink};line-height:1.6;">
        If anything looks wrong — damaged in transit, a stitch you weren't expecting, the wrong name — email us within 14 days with a photo and Lusik will repair or remake it. We stand behind every piece that leaves her table.
      </div>
    </div>

    <p style="margin:24px 0 6px 0;font-size:14px;color:${muted};">
      Questions, or want to order another?
    </p>
    <p style="margin:0 0 28px 0;font-size:14px;color:${ink};">
      <a href="mailto:${CONTACT.email}" style="color:${accent};text-decoration:none;">${CONTACT.email}</a>
      ${" · "}
      <a href="tel:${CONTACT.phoneTel}" style="color:${accent};text-decoration:none;">${CONTACT.phoneDisplay}</a>
    </p>

    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #E8E1D2;font-size:12px;color:${muted};line-height:1.6;">
      <em>Made by hand in Southern California.</em><br>
      Lusik &amp; Sons · <a href="${url}" style="color:${muted};text-decoration:underline;">lusikandsons.com</a>
    </div>

  </div>
</body></html>`;

  const text = [
    `LUSIK & SONS`,
    "",
    tracking ? `Your order is on its way.` : `Your order has shipped.`,
    "",
    greeting,
    "",
    `Lusik finished your piece and ${tracking ? "handed it to" : "shipped it with"} ${carrier || "the carrier"}.${tracking ? " Most ground shipments land within 3 to 5 business days." : ""}`,
    "",
    tracking ? `TRACKING\n  ${carrier} ${tracking}${trackUrl ? `\n  ${trackUrl}` : ""}` : "",
    "",
    hasPhoto ? `A photo of your finished piece is in your account at ${url}` : "",
    "",
    `WHEN IT ARRIVES`,
    `  If anything looks wrong — damaged in transit, a stitch you weren't expecting,`,
    `  the wrong name — email us within 14 days with a photo and Lusik will repair`,
    `  or remake it.`,
    "",
    `Questions or another order?`,
    `  ${CONTACT.email}`,
    `  ${CONTACT.phoneDisplay}`,
    "",
    `Made by hand in Southern California.`,
    `${url}`,
  ].filter(Boolean).join("\n");

  return await sendEmail({ to, subject, html, text });
}

/**
 * Send the customer a refund confirmation email. Triggered by
 * the `charge.refunded` Stripe webhook — fires whenever any
 * refund is applied to a charge, including partials. The
 * `refunded_cents` row gate in the webhook prevents duplicates
 * for the same Stripe refund event.
 *
 * `order`         — the orders row AFTER the refund-update write
 * `refundedCents` — TOTAL refunded against the charge (cumulative)
 * `isFullRefund`  — true when refundedCents >= original total
 */
export async function sendRefundNotification({ order, refundedCents, isFullRefund }) {
  const to = order.customer_email;
  if (!to) {
    console.warn("[email] customer email missing on refund notification; skipping");
    return false;
  }

  const orderNumber  = order.order_number ?? order.id;
  const ship         = order.shipping_address ?? {};
  const customerName = ship.name ?? null;
  const greeting     = customerName ? `Hi ${customerName.split(" ")[0]},` : "Hi there,";

  const subject = isFullRefund
    ? `Your refund — ${orderNumber}`
    : `A partial refund on your order — ${orderNumber}`;

  const { accent, ink, cream, muted } = PALETTE;
  const url = baseUrl();

  const headline = isFullRefund
    ? "We've refunded your order."
    : "We've applied a partial refund.";
  const bodyLine = isFullRefund
    ? `We've issued a full refund of ${dollars(refundedCents)} on order ${esc(orderNumber)}. The amount typically appears back on your card within 5 to 10 business days, depending on your bank.`
    : `We've applied a partial refund of ${dollars(refundedCents)} on order ${esc(orderNumber)}. The amount typically appears back on your card within 5 to 10 business days, depending on your bank.`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${ink};line-height:1.6;">
  <div style="max-width:560px;margin:0 auto;padding:36px 24px;">

    <div style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:${accent};font-weight:600;margin-bottom:14px;">Lusik &amp; Sons</div>

    <h1 style="font-size:28px;font-weight:500;margin:0 0 14px 0;letter-spacing:-0.01em;line-height:1.2;">
      ${esc(headline)}
    </h1>

    <p style="font-size:16px;color:${ink};margin:0 0 6px 0;">${esc(greeting)}</p>
    <p style="font-size:16px;color:${ink};margin:0 0 22px 0;">${bodyLine}</p>

    <div style="margin:24px 0;padding:18px 20px;background:#FFFFFF;border:1px solid #E8E1D2;">
      <div style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:${muted};font-weight:600;margin-bottom:8px;">
        ${isFullRefund ? "Refund details" : "Partial refund details"}
      </div>
      <div style="font-size:14px;color:${ink};line-height:1.7;">
        <div>Order: <strong>${esc(orderNumber)}</strong></div>
        <div>Original total: <strong>${dollars(order.total_cents)}</strong></div>
        <div>${isFullRefund ? "Refunded" : "Refunded so far"}: <strong>${dollars(refundedCents)}</strong></div>
        ${!isFullRefund ? `<div>Remaining balance: <strong>${dollars((order.total_cents ?? 0) - refundedCents)}</strong></div>` : ""}
      </div>
    </div>

    <p style="margin:24px 0 6px 0;font-size:14px;color:${muted};">
      Questions? It can take a few business days for the refund to show in your account — banks vary. If it's been longer than ten business days and you still don't see it:
    </p>
    <p style="margin:0 0 28px 0;font-size:14px;color:${ink};">
      <a href="mailto:${CONTACT.email}?subject=Refund question - ${encodeURIComponent(orderNumber)}" style="color:${accent};text-decoration:none;">${CONTACT.email}</a>
      ${" · "}
      <a href="tel:${CONTACT.phoneTel}" style="color:${accent};text-decoration:none;">${CONTACT.phoneDisplay}</a>
    </p>

    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #E8E1D2;font-size:12px;color:${muted};line-height:1.6;">
      <em>Made by hand in Southern California.</em><br>
      Lusik &amp; Sons · <a href="${url}" style="color:${muted};text-decoration:underline;">lusikandsons.com</a>
    </div>

  </div>
</body></html>`;

  const text = [
    `LUSIK & SONS`,
    "",
    headline,
    "",
    greeting,
    "",
    isFullRefund
      ? `We've issued a full refund of ${dollars(refundedCents)} on order ${orderNumber}.`
      : `We've applied a partial refund of ${dollars(refundedCents)} on order ${orderNumber}.`,
    "",
    `The amount typically appears back on your card within 5 to 10 business`,
    `days, depending on your bank.`,
    "",
    `Order: ${orderNumber}`,
    `Original total: ${dollars(order.total_cents)}`,
    `${isFullRefund ? "Refunded" : "Refunded so far"}: ${dollars(refundedCents)}`,
    isFullRefund ? "" : `Remaining balance: ${dollars((order.total_cents ?? 0) - refundedCents)}`,
    "",
    `If you don't see the refund after ten business days:`,
    `  ${CONTACT.email}`,
    `  ${CONTACT.phoneDisplay}`,
    "",
    `Made by hand in Southern California.`,
    `${url}`,
  ].filter(Boolean).join("\n");

  return await sendEmail({ to, subject, html, text });
}

// ============================================================
// sendGiftReminderEmail — one-year-later reminder
// ============================================================
// Fired by the daily gift-reminder scheduled function for orders
// that opted in at checkout and are now ~11 months old. One-shot:
// orders.gift_reminder_sent_at is stamped after a successful send.
//
// The wording is gentle on purpose. We're emailing someone who
// hasn't heard from us in a year. "It's been a while, here's a
// link if you want another" — not a sale, not urgency, no promo
// code. The unsubscribe link is prominent.
// ============================================================
export async function sendGiftReminderEmail({ order, unsubscribeUrl }) {
  const to = order.customer_email;
  if (!to) {
    console.warn("[email] customer email missing on gift reminder; skipping");
    return false;
  }

  const ship         = order.shipping_address ?? {};
  const customerName = ship.name ?? null;
  const greeting     = customerName ? `Hi ${customerName.split(" ")[0]},` : "Hi there,";
  const isGift       = order.gift?.is_gift === true;

  const { accent, ink, cream, muted } = PALETTE;
  const url = baseUrl();

  const subject = isGift
    ? "A small reminder from Lusik & Sons"
    : "Has it really been a year?";

  const openingLine = isGift
    ? "It's been about a year since you ordered a hand-stitched piece as a gift. If another little one is on the way — yours, a friend's, family — Lusik is still at the same table, stitching the same way."
    : "It's been about a year since your blanket left Lusik's hands. If there's another baby on the horizon — yours, a friend's, family — she's still at the same table, stitching the same way.";

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${ink};line-height:1.6;">
  <div style="max-width:560px;margin:0 auto;padding:36px 24px;">

    <div style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:${accent};font-weight:600;margin-bottom:14px;">From Lusik &amp; Sons</div>

    <h1 style="font-size:30px;font-weight:500;margin:0 0 18px 0;letter-spacing:-0.01em;line-height:1.2;">
      It's been a year.
    </h1>

    <p style="font-size:16px;color:${ink};margin:0 0 6px 0;">${esc(greeting)}</p>
    <p style="font-size:16px;color:${ink};margin:0 0 22px 0;">${esc(openingLine)}</p>

    <p style="font-size:16px;color:${ink};margin:0 0 28px 0;">
      No promo code, no rush. Just a note in case it's useful.
    </p>

    <div style="margin:24px 0 28px 0;">
      <a href="${url}/" style="display:inline-block;padding:14px 26px;background:${ink};color:${cream};text-decoration:none;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;font-weight:500;">
        Visit the shop →
      </a>
    </div>

    <div style="margin-top:36px;padding-top:20px;border-top:1px solid #E8E1D2;font-size:12px;color:${muted};line-height:1.6;">
      <em>Made by hand in Southern California.</em><br>
      Lusik &amp; Sons · <a href="${url}" style="color:${muted};text-decoration:underline;">lusikandsons.com</a>
    </div>

    <div style="margin-top:18px;font-size:11px;color:${muted};line-height:1.6;">
      You're getting this one email because you ticked the box at checkout last year.
      We won't send another. <a href="${esc(unsubscribeUrl)}" style="color:${muted};text-decoration:underline;">Unsubscribe anyway</a>.
    </div>

  </div>
</body></html>`;

  const text = [
    `LUSIK & SONS`,
    `It's been a year.`,
    "",
    greeting,
    openingLine,
    "",
    `No promo code, no rush. Just a note in case it's useful.`,
    "",
    `Visit the shop: ${url}/`,
    "",
    `Made by hand in Southern California.`,
    `${url}`,
    "",
    `You're getting this one email because you ticked the box at checkout last year. We won't send another.`,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  return await sendEmail({ to, subject, html, text });
}

// ============================================================
// signReminderToken / verifyReminderToken
// ============================================================
// HMAC capability tokens for the gift-reminder unsubscribe link.
// The email recipient shouldn't have to sign in to opt out, and
// a stranger shouldn't be able to spoof an unsubscribe against
// someone else's order. A self-validating signed URL solves both.
//
// REMINDER_SECRET must be set explicitly. Older revisions of this
// file fell back to STRIPE_WEBHOOK_SECRET, but cross-domain secret
// reuse is a footgun: rotating Stripe's webhook secret (a routine
// operational hygiene step) would silently invalidate every
// outstanding unsubscribe URL — emails sent months earlier would
// suddenly 400 with no diagnostic. Explicit-only means the failure
// mode is "set the env var" once, not "you broke a year of links."
// ============================================================
import { createHmac, timingSafeEqual } from "node:crypto";

function reminderSecret() {
  return process.env.REMINDER_SECRET ?? "";
}

// Surface a loud warning at module load when the secret is unset.
// Without this, sign/verify return empty strings silently and every
// unsubscribe link 400s with no diagnostic in the logs.
if (!process.env.REMINDER_SECRET) {
  console.warn("[email] REMINDER_SECRET is not set — gift-reminder unsubscribe links will not work. Set it in Netlify → Site → Environment to a long random string.");
}

function b64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function signReminderToken(orderId) {
  const secret = reminderSecret();
  if (!secret) return "";
  return b64url(createHmac("sha256", secret).update(String(orderId)).digest());
}

export function verifyReminderToken(orderId, token) {
  const secret = reminderSecret();
  if (!secret || !token) return false;
  const expected = signReminderToken(orderId);
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  try { return timingSafeEqual(a, b); } catch { return false; }
}

// ============================================================
// sendWaitlistAvailableEmail — "the thing you waited for is here"
// ============================================================
// Fired by admin-waitlist-notify when Lusik clicks Notify on a
// product that's now live. One-shot per (email, product_key):
// product_waitlist.notified_at is stamped after a successful send
// and the UNIQUE index prevents re-emails on duplicate signups.
//
// Args:
//   to           — recipient email
//   productName  — display name ("Hand-stitched bib", etc.)
//   productUrl   — where to point the CTA (PDP, home anchor, etc.)
//
// Tone: short and warm. The recipient asked us to email them;
// we're keeping the promise. No promo code, no urgency.
// ============================================================
export async function sendWaitlistAvailableEmail({ to, productName, productUrl }) {
  if (!to) {
    console.warn("[email] waitlist email missing recipient; skipping");
    return false;
  }

  const { accent, ink, cream, muted } = PALETTE;
  const url = baseUrl();
  const href    = productUrl || `${url}/`;

  // productName is admin-controlled but the admin types it via the
  // admin UI — a stored XSS / SMTP-injection vector if a future
  // refactor lets a customer populate it (or if an admin session
  // gets compromised). headerSafe strips CR/LF/control chars and
  // caps length so the value is safe in the Resend subject field.
  const safeProductName = headerSafe(productName);
  const subject = `${safeProductName} is ready.`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${ink};line-height:1.6;">
  <div style="max-width:560px;margin:0 auto;padding:36px 24px;">

    <div style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:${accent};font-weight:600;margin-bottom:14px;">From Lusik &amp; Sons</div>

    <h1 style="font-size:30px;font-weight:500;margin:0 0 18px 0;letter-spacing:-0.01em;line-height:1.2;">
      ${esc(productName)} is ready.
    </h1>

    <p style="font-size:16px;color:${ink};margin:0 0 22px 0;">
      You asked us to email you when this was available — it is. Lusik is taking orders now.
    </p>

    <div style="margin:24px 0 28px 0;">
      <a href="${esc(href)}" style="display:inline-block;padding:14px 26px;background:${ink};color:${cream};text-decoration:none;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;font-weight:500;">
        Have a look →
      </a>
    </div>

    <p style="font-size:14px;color:${muted};margin:0 0 24px 0;">
      Made by hand, made-to-order. Each piece takes 5–10 business days before it ships.
    </p>

    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #E8E1D2;font-size:12px;color:${muted};line-height:1.6;">
      <em>Made by hand in Southern California.</em><br>
      Lusik &amp; Sons · <a href="${url}" style="color:${muted};text-decoration:underline;">lusikandsons.com</a>
    </div>

    <div style="margin-top:18px;font-size:11px;color:${muted};line-height:1.6;">
      You're getting this because you signed up for the ${esc(productName)} waitlist. This is a one-time send — we won't email you again from this list.
    </div>

  </div>
</body></html>`;

  const text = [
    `LUSIK & SONS`,
    `${productName} is ready.`,
    "",
    `You asked us to email you when this was available — it is. Lusik is taking orders now.`,
    "",
    `Have a look: ${href}`,
    "",
    `Made by hand, made-to-order. Each piece takes 5–10 business days before it ships.`,
    "",
    `Lusik & Sons · ${url}`,
    "",
    `You're getting this because you signed up for the ${productName} waitlist. This is a one-time send — we won't email you again from this list.`,
  ].join("\n");

  return await sendEmail({ to, subject, html, text });
}

// ============================================================
// sendCartAbandonmentRecovery — "we held your spot" email
// ============================================================
// Sent by the stripe-webhook when a checkout.session.expired
// event fires AND we still have the pending cart blob (meaning
// the customer didn't complete payment — successful payments
// delete the blob first). One-shot: the blob is deleted after
// this send, so even if Stripe re-fires the event we won't
// double-email.
//
// Tone: gentle, no urgency, no discount code. Hand-craft brand —
// "we still have your spot" reads better than "20% off, ends
// tonight!" Lists the items they were buying so a tap on the CTA
// feels like picking up where they left off.
//
// Args:
//   to         — recipient email (from pending.customerEmail or
//                Stripe's customer_details.email)
//   items      — array of { productName, variantLabel, quantity,
//                unitPriceCents } shaped like the order-confirmation
//                items. Built from the trusted-products map.
//   totalCents — sum of items (no shipping/tax — we don't know
//                what they would have picked)
// ============================================================
export async function sendCartAbandonmentRecovery({ to, items, totalCents }) {
  if (!to) {
    console.warn("[email] cart-recovery missing recipient; skipping");
    return false;
  }
  if (!Array.isArray(items) || items.length === 0) {
    console.warn("[email] cart-recovery has no items; skipping");
    return false;
  }

  const { accent, ink, cream, muted } = PALETTE;
  const url = baseUrl();
  const subject = `We saved your spot.`;

  const itemRows = items.map((it) => {
    const qty = it.quantity > 1 ? ` <span style="color:${muted};">× ${it.quantity}</span>` : "";
    const variant = it.variantLabel ? `<div style="font-size:13px;color:${muted};margin-top:4px;line-height:1.5;">${esc(it.variantLabel)}</div>` : "";
    return `
      <div style="padding:14px 0;border-top:1px solid #E8E1D2;">
        <div style="font-weight:600;color:${ink};">${esc(it.productName)}${qty}</div>
        ${variant}
      </div>
    `;
  }).join("");

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${ink};line-height:1.6;">
  <div style="max-width:560px;margin:0 auto;padding:36px 24px;">

    <div style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:${accent};font-weight:600;margin-bottom:14px;">From Lusik &amp; Sons</div>

    <h1 style="font-size:30px;font-weight:500;margin:0 0 18px 0;letter-spacing:-0.01em;line-height:1.2;">
      We saved your spot.
    </h1>

    <p style="font-size:16px;color:${ink};margin:0 0 22px 0;">
      You started a checkout with us and didn't finish — no worries. Here's what was in your cart.
    </p>

    <div style="margin:24px 0;border-bottom:1px solid #E8E1D2;">
      ${itemRows}
      <div style="padding:14px 0;border-top:1px solid #E8E1D2;display:flex;justify-content:space-between;">
        <span style="color:${muted};">Subtotal</span>
        <span style="font-weight:600;">${dollars(totalCents)}</span>
      </div>
    </div>

    <div style="margin:24px 0 28px 0;">
      <a href="${esc(url)}/" style="display:inline-block;padding:14px 26px;background:${ink};color:${cream};text-decoration:none;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;font-weight:500;">
        Pick up where you left off →
      </a>
    </div>

    <p style="font-size:14px;color:${muted};margin:0 0 12px 0;">
      Made-to-order, by hand — every piece takes 5–10 business days before it ships. If you have a question or need a different color combination than the picker showed you, just reply to this email.
    </p>

    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #E8E1D2;font-size:12px;color:${muted};line-height:1.6;">
      <em>Made by hand in Southern California.</em><br>
      Lusik &amp; Sons · <a href="${url}" style="color:${muted};text-decoration:underline;">lusikandsons.com</a>
    </div>

    <div style="margin-top:18px;font-size:11px;color:${muted};line-height:1.6;">
      You're getting this because you started a checkout on lusikandsons.com. This is a one-time send — we won't email you again about this cart.
    </div>

  </div>
</body></html>`;

  const text = [
    `LUSIK & SONS`,
    `We saved your spot.`,
    "",
    `You started a checkout with us and didn't finish — no worries. Here's what was in your cart:`,
    "",
    ...items.map((it) => `  • ${it.productName}${it.quantity > 1 ? ` × ${it.quantity}` : ""}${it.variantLabel ? `\n      ${it.variantLabel}` : ""}`),
    "",
    `  Subtotal: ${dollars(totalCents)}`,
    "",
    `Pick up where you left off: ${url}/`,
    "",
    `Made-to-order, by hand — every piece takes 5–10 business days before it ships. If you have a question or need a different combination than the picker showed you, just reply to this email.`,
    "",
    `Lusik & Sons · ${url}`,
    "",
    `You're getting this because you started a checkout on lusikandsons.com. This is a one-time send — we won't email you again about this cart.`,
  ].join("\n");

  return await sendEmail({ to, subject, html, text });
}

/**
 * Send the embroidery-order / quote-request email to Lusik.
 * Fired by the embroidery-order Function when the /embroidery
 * order desk submits. The machine-ready .pes file rides along as
 * an attachment when the browser engine produced one; when it
 * didn't (old browser, engine error), the email says so and the
 * design parameters are enough to digitize manually.
 *
 * `order` — validated payload from embroidery-order.mjs:
 *   { ref, account, contact{name,email,phone}, productName,
 *     panelLabel, areaMm[w,h], modeLine, textStitched, threadName,
 *     threadHex, fabricName, fabricHex, notes, stats|null }
 * `pesBase64` — base64 .pes bytes or null.
 */
export async function sendEmbroideryOrderEmail({ order, pesBase64 }) {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!to) {
    console.warn("[email] ADMIN_NOTIFICATION_EMAIL not set; skipping embroidery order email");
    return false;
  }
  const { accent, ink, cream, muted } = PALETTE;
  const isCompany = order.account === "company";
  const kind = isCompany ? "Embroidery order" : "Embroidery quote request";
  const subject = headerSafe(
    `🧵 ${kind} ${order.ref} — "${order.textStitched}" on ${order.productName}`
  );

  const row = (label, value) => `
    <tr>
      <td style="padding:6px 12px 6px 0;color:${muted};font-size:13px;white-space:nowrap;vertical-align:top;">${esc(label)}</td>
      <td style="padding:6px 0;color:${ink};font-size:14px;">${value}</td>
    </tr>`;

  const swatch = (hex, name) =>
    `<span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${esc(hex)};border:1px solid rgba(0,0,0,.2);vertical-align:middle;margin-right:6px;"></span>${esc(name)} <span style="color:${muted};font-size:12px;">${esc(hex)}</span>`;

  const statsLine = order.stats
    ? `${order.stats.stitchCount} stitches · ${order.stats.widthMm} × ${order.stats.heightMm} mm · ${order.stats.jumps} trims`
    : null;

  const contactBits = [
    order.contact.name ? esc(order.contact.name) : null,
    order.contact.email ? `<a href="mailto:${esc(order.contact.email)}" style="color:${accent};">${esc(order.contact.email)}</a>` : null,
    order.contact.phone ? esc(order.contact.phone) : null,
  ].filter(Boolean).join(" · ");

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:${cream};font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:12px;letter-spacing:2px;color:${accent};text-transform:uppercase;">Lusik &amp; Sons — Embroidery desk</div>
    <h1 style="font-size:22px;color:${ink};margin:8px 0 4px;">${esc(kind)} ${esc(order.ref)}</h1>
    <div style="color:${muted};font-size:13px;margin-bottom:20px;">${isCompany
      ? "Billed to the Tuxedos Online company account."
      : "Public request — reply with a price before stitching."}</div>

    <div style="background:#fff;border-radius:12px;padding:20px 24px;">
      <table style="border-collapse:collapse;width:100%;">
        ${row("Stitch text", `<b style="font-size:16px;">${esc(order.textStitched)}</b>`)}
        ${row("Design", esc(order.modeLine))}
        ${row("Product", esc(order.productName))}
        ${row("Placement", `${esc(order.panelLabel)} · about ${order.areaMm[0]} × ${order.areaMm[1]} mm`)}
        ${row("Thread", swatch(order.threadHex, order.threadName))}
        ${row("Fabric", swatch(order.fabricHex, order.fabricName))}
        ${statsLine ? row("Machine file", `${esc(order.ref)}.pes attached — ${esc(statsLine)}`) : ""}
        ${order.notes ? row("Notes", esc(order.notes)) : ""}
        ${contactBits ? row("Contact", contactBits) : ""}
      </table>
      ${pesBase64 ? "" : `<div style="margin-top:14px;padding:10px 14px;background:${cream};border-radius:8px;color:${muted};font-size:13px;">No .pes attached — the browser couldn't run the stitch engine. The parameters above are complete; digitize manually.</div>`}
    </div>

    <div style="margin-top:18px;font-size:11px;color:${muted};line-height:1.6;">
      Sent by the /embroidery order desk on lusikandsons.com.
    </div>
  </div>
</body></html>`;

  const text = [
    `LUSIK & SONS — EMBROIDERY DESK`,
    `${kind} ${order.ref}`,
    "",
    `Stitch text: ${order.textStitched}`,
    `Design:      ${order.modeLine}`,
    `Product:     ${order.productName}`,
    `Placement:   ${order.panelLabel} · about ${order.areaMm[0]} x ${order.areaMm[1]} mm`,
    `Thread:      ${order.threadName} ${order.threadHex}`,
    `Fabric:      ${order.fabricName} ${order.fabricHex}`,
    statsLine ? `Machine file: ${order.ref}.pes attached — ${statsLine}` : `No .pes attached — digitize manually from the parameters above.`,
    order.notes ? `Notes:       ${order.notes}` : null,
    contactBits ? `Contact:     ${[order.contact.name, order.contact.email, order.contact.phone].filter(Boolean).join(" · ")}` : null,
    "",
    isCompany ? "Billed to the Tuxedos Online company account." : "Public request — reply with a price before stitching.",
  ].filter((l) => l !== null).join("\n");

  return await sendEmail({
    to,
    subject,
    html,
    text,
    replyTo: order.contact.email || undefined,
    attachments: pesBase64
      ? [{ filename: `${order.ref}.pes`, content: pesBase64 }]
      : undefined,
  });
}
