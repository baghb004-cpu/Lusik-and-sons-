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

const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * Generic Resend send. Returns true on 2xx, false otherwise.
 * Never throws — callers shouldn't have to wrap in try/catch.
 */
export async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set; skipping send to", to);
    return false;
  }
  const from = process.env.RESEND_FROM_EMAIL || "Lusik & Sons <onboarding@resend.dev>";
  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
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
function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  const social       = pending?.social_consent ?? null;

  // Compact subject line — order number, total, brief item count.
  const itemSummary = items.length === 1
    ? items[0].productName
    : `${items.length} items`;
  const subject = `New order ${orderNumber} · ${dollars(order.total_cents)} · ${itemSummary}${isGift ? " · gift" : ""}`;

  // -------- HTML body --------
  // Single-column, basic email-safe HTML. No external CSS, no
  // images — everything inline so it renders identically in
  // Apple Mail, Gmail, Outlook web, mobile clients.
  const accent = "#B08842";
  const ink    = "#1A1612";
  const muted  = "#6B655D";

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
      ${giftHidePrices ? `<div style="font-size:13px;color:${ink};"><strong>⚠ Hide prices from the packing slip.</strong></div>` : ""}
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

  const baseUrl = process.env.URL || "https://lusikandsons.com";
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#F5EFE3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${ink};">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:${accent};font-weight:600;margin-bottom:8px;">New order</div>
    <h1 style="font-size:28px;font-weight:500;margin:0 0 4px 0;letter-spacing:-0.01em;">${esc(orderNumber)}</h1>
    <div style="color:${muted};font-size:14px;">${dollars(order.total_cents)} · ${new Date(order.created_at ?? Date.now()).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}</div>

    ${giftBlock}

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
      <a href="${baseUrl}/#admin" style="display:inline-block;padding:12px 20px;background:${ink};color:#F5EFE3;text-decoration:none;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;font-weight:500;">
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
    isGift ? `★ THIS IS A GIFT${giftMessage ? `\n  Message: "${giftMessage}"` : ""}${giftHidePrices ? "\n  ⚠ Hide prices from packing slip" : ""}\n` : "",
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
    `Open admin panel: ${baseUrl}/#admin`,
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
  const accent = "#B08842";
  const ink    = "#1A1612";
  const cream  = "#F5EFE3";
  const muted  = "#6B655D";

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
        ${pending?.gift?.hide_prices ? `<div style="margin-top:10px;font-size:13px;">We'll keep prices off the packing slip as requested.</div>` : ""}
      </div>
    </div>
  ` : "";

  const baseUrl = process.env.URL || "https://lusikandsons.com";
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
      <a href="mailto:hello@lusikandsons.com" style="color:${accent};text-decoration:none;">hello@lusikandsons.com</a>
      ${" · "}
      <a href="tel:+17608742333" style="color:${accent};text-decoration:none;">(760) 874-2333</a>
    </p>

    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #E8E1D2;font-size:12px;color:${muted};line-height:1.6;">
      <em>Made by hand in Cypress, California.</em><br>
      Lusik &amp; Sons · <a href="${baseUrl}" style="color:${muted};text-decoration:underline;">lusikandsons.com</a>
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
    isGift ? `GIFT DETAILS\n  Shipping to${recipientName ? ` ${recipientName}` : ""} in ${ship.city ?? ""}, ${ship.state ?? ship.region ?? ""}.${giftMessage ? `\n  Your message: "${giftMessage}"` : ""}${pending?.gift?.hide_prices ? `\n  We'll keep prices off the packing slip as requested.` : ""}\n` : "",
    `ORDER ${orderNumber}`,
    itemLines,
    `  Total: ${dollars(order.total_cents)}`,
    "",
    `If anything is wrong, reach out now before Lusik begins stitching:`,
    `  hello@lusikandsons.com`,
    `  (760) 874-2333`,
    "",
    `Made by hand in Cypress, California.`,
    `${baseUrl}`,
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

  const accent  = "#B08842";
  const ink     = "#1A1612";
  const cream   = "#F5EFE3";
  const muted   = "#6B655D";
  const baseUrl = process.env.URL || "https://lusikandsons.com";

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
      <a href="${baseUrl}/" style="display:inline-block;padding:12px 22px;background:${ink};color:${cream};text-decoration:none;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;font-weight:500;">
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
      <a href="mailto:hello@lusikandsons.com" style="color:${accent};text-decoration:none;">hello@lusikandsons.com</a>
      ${" · "}
      <a href="tel:+17608742333" style="color:${accent};text-decoration:none;">(760) 874-2333</a>
    </p>

    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #E8E1D2;font-size:12px;color:${muted};line-height:1.6;">
      <em>Made by hand in Cypress, California.</em><br>
      Lusik &amp; Sons · <a href="${baseUrl}" style="color:${muted};text-decoration:underline;">lusikandsons.com</a>
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
    `  ${baseUrl}`,
    "",
    `Order ${orderNumber} ships in the next day or two. You'll get a`,
    `tracking number by email when it goes out.`,
    "",
    `If anything looks off in the photo, tell us before it ships:`,
    `  hello@lusikandsons.com`,
    `  (760) 874-2333`,
    "",
    `Made by hand in Cypress, California.`,
    `${baseUrl}`,
  ].join("\n");

  return await sendEmail({ to, subject, html, text });
}

// Mirror of the browser-side getTrackingUrl helper. Kept here
// (rather than imported across the JS/server boundary) because
// _lib/ functions can't reach into index.html, and the URL
// shapes don't change often. Keep this in sync if a carrier
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

  const accent = "#B08842";
  const ink    = "#1A1612";
  const cream  = "#F5EFE3";
  const muted  = "#6B655D";

  const baseUrl = process.env.URL || "https://lusikandsons.com";

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
          <a href="${baseUrl}/" style="color:${accent};text-decoration:none;font-weight:500;">View your order →</a>
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
      <a href="mailto:hello@lusikandsons.com" style="color:${accent};text-decoration:none;">hello@lusikandsons.com</a>
      ${" · "}
      <a href="tel:+17608742333" style="color:${accent};text-decoration:none;">(760) 874-2333</a>
    </p>

    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #E8E1D2;font-size:12px;color:${muted};line-height:1.6;">
      <em>Made by hand in Cypress, California.</em><br>
      Lusik &amp; Sons · <a href="${baseUrl}" style="color:${muted};text-decoration:underline;">lusikandsons.com</a>
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
    hasPhoto ? `A photo of your finished piece is in your account at ${baseUrl}` : "",
    "",
    `WHEN IT ARRIVES`,
    `  If anything looks wrong — damaged in transit, a stitch you weren't expecting,`,
    `  the wrong name — email us within 14 days with a photo and Lusik will repair`,
    `  or remake it.`,
    "",
    `Questions or another order?`,
    `  hello@lusikandsons.com`,
    `  (760) 874-2333`,
    "",
    `Made by hand in Cypress, California.`,
    `${baseUrl}`,
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

  const accent  = "#B08842";
  const ink     = "#1A1612";
  const cream   = "#F5EFE3";
  const muted   = "#6B655D";
  const baseUrl = process.env.URL || "https://lusikandsons.com";

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
      <a href="mailto:hello@lusikandsons.com?subject=Refund question - ${encodeURIComponent(orderNumber)}" style="color:${accent};text-decoration:none;">hello@lusikandsons.com</a>
      ${" · "}
      <a href="tel:+17608742333" style="color:${accent};text-decoration:none;">(760) 874-2333</a>
    </p>

    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #E8E1D2;font-size:12px;color:${muted};line-height:1.6;">
      <em>Made by hand in Cypress, California.</em><br>
      Lusik &amp; Sons · <a href="${baseUrl}" style="color:${muted};text-decoration:underline;">lusikandsons.com</a>
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
    `  hello@lusikandsons.com`,
    `  (760) 874-2333`,
    "",
    `Made by hand in Cypress, California.`,
    `${baseUrl}`,
  ].filter(Boolean).join("\n");

  return await sendEmail({ to, subject, html, text });
}
