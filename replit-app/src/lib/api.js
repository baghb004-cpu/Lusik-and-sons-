// ============================================================
// api — the existing Netlify Functions backend (LusikAPI.swift's
// JS sibling). The server owns all pricing/authorization; this
// client sends keys and quantities, never trusted amounts.
// ============================================================

// RELATIVE base: the backend is same-origin-only (no CORS), so the
// app's dev/preview server proxies /.netlify/* to production —
// see vite.config.js.
const FUNCTIONS_BASE = "/.netlify/functions";

/**
 * POST /create-checkout-session → the Stripe-hosted checkout URL.
 * Body shape mirrors the website's CheckoutView (and the iOS
 * CheckoutRequest) exactly — same field names, same shapes;
 * `ship_zip` drives the server's zone-priced shipping.
 *
 * Return-URL note (DECISION RECORDED in the roadmap): the server
 * builds Stripe's success/cancel URLs from the request Origin, but
 * only for allowlisted origins (production site, deploy previews,
 * localhost). Local dev therefore gets the in-app ?order=success
 * return end-to-end; a Replit-hosted origin falls back to the
 * website's success page until the Replit domain joins the server's
 * allowlist (_lib/origin.mjs — a website PR with explicit approval).
 */
export async function createCheckoutSession(body) {
  const res = await fetch(`${FUNCTIONS_BASE}/create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.url) {
    throw new Error(data?.error || "Checkout unavailable. Please try again.");
  }
  return data.url;
}

/** The /chat Function exists but the assistant isn't configured yet
 *  (no ANTHROPIC_API_KEY server-side) — the UI falls back to the real
 *  channels (SMS + email). */
export class ChatOfflineError extends Error {
  constructor() {
    super("The assistant isn't online yet.");
    this.name = "ChatOfflineError";
  }
}

/**
 * POST /chat → the assistant's reply (netlify/functions/chat.mjs, the
 * same Anthropic proxy the website uses — the key never reaches any
 * client). The full visible history goes up each turn (the server
 * holds no state); `sessionId` feeds its per-session daily cap.
 */
export async function sendChat(messages, sessionId) {
  const res = await fetch(`${FUNCTIONS_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, sessionId }),
  });
  if (res.status === 503) throw new ChatOfflineError();
  const data = await res.json().catch(() => null);
  if (!res.ok || typeof data?.reply !== "string") {
    throw new Error(data?.error || "The assistant is having trouble right now. Please try again in a moment.");
  }
  return data.reply;
}

/**
 * POST /waitlist → { ok: true } (netlify/functions/waitlist.mjs).
 * Public + IP-rate-limited server-side; `productKey` must match the
 * web CATALOG key, so the admin Notify sweep sees app and website
 * signups as one list per product.
 */
export async function joinWaitlist(email, productKey, productName) {
  const res = await fetch(`${FUNCTIONS_BASE}/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, product_key: productKey, product_name: productName }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok !== true) {
    throw new Error(data?.error || "We couldn't add you just now — please try again, or write to hello@lusikandsons.com.");
  }
}
