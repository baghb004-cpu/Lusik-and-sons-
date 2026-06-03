// ============================================================
// SHIPPING_CARRIERS — for the order-tracking link builder
// ============================================================
// Used by `getTrackingUrl(carrier, trackingNumber)` to render
// the right tracking URL when Lusik fills in carrier + tracking
// number in the admin view. Browser-side mirror of the server
// list in netlify/functions/_lib/email.mjs and the SHIPPING
// rate options in create-checkout-session.mjs.
//
// shipping options, edit BOTH this file AND the equivalent
// server-side list. The pricing-drift test pattern (see
// _lib/__tests__/pricing-drift.test.mjs) could be extended to
// guard this if drift becomes a problem.
// ============================================================

export interface ShippingCarrier {
  id: string;
  name: string;
  price: number;
  days: string;
}

export const SHIPPING_CARRIERS: ShippingCarrier[] = [
  { id: "usps",  name: "USPS Ground Advantage", price:  9.99, days: "3–5 business days" },
  { id: "ups",   name: "UPS Ground",            price: 14.99, days: "2–5 business days" },
  { id: "fedex", name: "FedEx Home Delivery",   price: 16.99, days: "2–5 business days" },
];
