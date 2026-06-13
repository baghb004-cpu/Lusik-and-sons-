// ============================================================
// Business App — payment connector (official providers only)
// ============================================================
// OFFLINE config only. A business app can link to an OFFICIAL hosted
// checkout (Square / Clover / Stripe payment link). It NEVER handles,
// stores, or transmits card data — it just holds the official link the
// owner pastes. No custom card handling, ever.
// ============================================================

import { z } from "zod";

export const PAYMENT_PROVIDERS = ["none", "square", "clover", "stripe"] as const;

export const paymentConnectorSchema = z.object({
  provider: z.enum(PAYMENT_PROVIDERS).default("none"),
  // an OFFICIAL hosted checkout/payment link (not card data)
  checkoutUrl: z.string().default(""),
  note: z.string().default(""),
});
export type PaymentConnector = z.infer<typeof paymentConnectorSchema>;

const OFFICIAL_HOSTS = ["squareup.com", "square.link", "checkout.square.site", "clover.com", "stripe.com", "buy.stripe.com", "checkout.stripe.com"];

export interface PaymentCheck { ok: boolean; reason?: string }

/** Validate a connector: official hosted link only, never anything card-like. */
export function checkPaymentConnector(c: PaymentConnector): PaymentCheck {
  if (c.provider === "none") return { ok: true };
  const url = c.checkoutUrl.trim();
  if (!url) return { ok: false, reason: "Paste your official hosted checkout link (from Square/Clover/Stripe)." };
  let host = "";
  try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return { ok: false, reason: "That isn't a valid https link." }; }
  if (!url.startsWith("https://")) return { ok: false, reason: "The checkout link must be https." };
  if (!OFFICIAL_HOSTS.some((h) => host === h || host.endsWith("." + h))) return { ok: false, reason: `Use an official ${c.provider} hosted checkout link (e.g. ${OFFICIAL_HOSTS.join(", ")}).` };
  // Never accept anything that looks like raw card data smuggled into the link.
  if (/\b\d{13,19}\b/.test(url) || /(cvv|cvc|card[_-]?number|pan)=/i.test(url)) return { ok: false, reason: "That link looks like it contains card data — never put card numbers anywhere. Use the provider's hosted checkout." };
  return { ok: true };
}

export const PAYMENTS_DISCLOSURE =
  "Payments go through the provider's OWN secure checkout (Square/Clover/Stripe) — this app only stores your official checkout link and never sees, stores, or transmits card numbers.";
