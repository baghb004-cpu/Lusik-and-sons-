// ============================================================
// /.netlify/functions/unsubscribe-gift-reminder
// ============================================================
// GET ?o=<orderId>&t=<token>  → flips orders.gift_reminder_opt_in
// to false on that order. Returns a small HTML confirmation page.
//
// The token is an HMAC of the orderId (see signReminderToken in
// _lib/email.mjs). No sign-in required — the link in the email
// IS the capability. If the token doesn't validate, return 400.
//
// Idempotent: clicking the link twice still works, second click
// just no-ops the UPDATE.
// ============================================================

import { sql }                              from "./_lib/db.mjs";
import { verifyReminderToken, PALETTE, baseUrl } from "./_lib/email.mjs";

export default async (req) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const orderId = url.searchParams.get("o") ?? "";
  const token   = url.searchParams.get("t") ?? "";

  // UUID-shape gate before SQL — defense in depth.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    return htmlResponse(400, "That unsubscribe link looks wrong.");
  }
  if (!verifyReminderToken(orderId, token)) {
    return htmlResponse(400, "That unsubscribe link couldn't be verified.");
  }

  // Idempotent flip. We don't 404 if the order's already opted out
  // — the customer's intent ("don't email me") is satisfied either way.
  await sql`
    UPDATE orders
       SET gift_reminder_opt_in = false
     WHERE id = ${orderId}
  `;

  return htmlResponse(200, "You're unsubscribed. We won't send the one-year reminder.");
};

function htmlResponse(status, message) {
  const url = baseUrl();
  const { accent, ink, cream, muted } = PALETTE;

  const body = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lusik &amp; Sons</title>
<style>
  body { margin: 0; background: ${cream}; color: ${ink};
         font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
         min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .card { max-width: 480px; text-align: center; }
  .eyebrow { font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase;
             color: ${accent}; font-weight: 600; margin-bottom: 14px; }
  h1 { font-size: 28px; font-weight: 500; margin: 0 0 18px 0; letter-spacing: -0.01em; line-height: 1.3; }
  p { font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; }
  a.button { display: inline-block; padding: 12px 22px; background: ${ink}; color: ${cream};
             text-decoration: none; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 500; }
  .footer { margin-top: 36px; font-size: 12px; color: ${muted}; }
</style>
</head><body>
  <div class="card">
    <div class="eyebrow">Lusik &amp; Sons</div>
    <h1>${escapeHtml(message)}</h1>
    <p>Thanks for letting us know.</p>
    <a class="button" href="${url}/">Back to the shop</a>
    <div class="footer">Made by hand in Cypress, California.</div>
  </div>
</body></html>`;

  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
