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
