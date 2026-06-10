// ============================================================
// SHIPPING_CARRIERS — for the order-tracking link builder
// ============================================================
// Used by `getTrackingUrl(carrier, trackingNumber)` to render
// the right tracking URL when Lusik fills in carrier + tracking
// number in the admin view. Browser-side mirror of the carrier
// list in netlify/functions/_lib/email.mjs.
//
// NOTE: the price/days fields are legacy display data from the
// old flat-rate checkout and are NOT what checkout charges —
// shipping is zone-priced by ZIP since June 2026 (see
// src/data/shippingZones.js + _lib/shipping-zones.mjs, kept in
// lockstep by shipping-zones-drift.test.mjs). Lusik still hands
// the finished piece to whichever of these carriers makes sense,
// so the tracking-URL ids/names stay load-bearing.
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
