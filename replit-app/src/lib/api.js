// ============================================================
// api — the existing Netlify Functions backend (LusikAPI.swift's
// JS sibling). The server owns all pricing/authorization; this
// client sends keys and quantities, never trusted amounts.
// ============================================================

const FUNCTIONS_BASE = "https://lusikandsons.com/.netlify/functions";

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
