// ============================================================
// _lib/shipping-zones.mjs — distance-aware U.S. shipping rates
// ============================================================
// Zone-based shipping priced off the UPS Ground zone chart for our
// origin (Cypress, CA 90630). The destination ZIP's first 3 digits
// map to a UPS zone (2 = Southern California … 8 = East Coast,
// plus an AK/HI/territories bucket), and each zone has a flat rate
// chosen to track what UPS actually charges for a ~2 lb package —
// so a Florida order pays Florida shipping and a California order
// pays California shipping, instead of one flat fee that loses
// money on distance.
//
// SOURCE OF TRUTH: this file is what CHECKOUT charges. The browser
// has a mirror in src/data/shippingZones.js for DISPLAY only (the
// ZIP estimate on the product page + checkout); the two are kept in
// lockstep by shipping-zones-drift.test.mjs — same pattern as
// trusted-products / launch-promo. Change a rate or range here,
// change the mirror too (the test fails loudly otherwise).
//
// Accuracy disclaimer (deliberate): this is a static approximation
// of the UPS chart, not a live Rating-API call. It's within about
// a dollar of retail UPS Ground for the common cases, deterministic,
// and works with hosted Stripe Checkout (whose shipping options are
// fixed at session-creation time — the reason we collect the ZIP on
// our own checkout page first). If Lusik ever wants exact-to-the-
// cent rates, swap rateForZip() internals for a UPS Rating API call
// and keep the same exports.
// ============================================================

// Ordered [loPrefix, hiPrefix, zone] over the destination ZIP's
// first 3 digits. First match wins; anything unmatched falls to
// DEFAULT_ZONE (8 — the East Coast band), which can only ever
// OVER-charge an unmapped western ZIP, never undercharge Lusik.
export const ZIP_PREFIX_ZONES = Object.freeze([
  // AK / HI / U.S. territories — UPS Ground doesn't run there.
  ["995", "999", "AKHI"],   // Alaska
  ["967", "969", "AKHI"],   // Hawaii + Guam/AS APO band
  ["006", "009", "AKHI"],   // Puerto Rico / USVI
  // Zone 2 — Southern + Central-Coast California (≤150 mi)
  ["900", "935", "2"],
  // Zone 3 — Central Valley CA, Las Vegas
  ["936", "939", "3"],
  ["889", "893", "3"],
  // Zone 4 — Northern CA, Reno, Arizona
  ["940", "961", "4"],
  ["894", "899", "4"],
  ["850", "865", "4"],
  // Zone 5 — Mountain West, NM, CO, El Paso, OR, ID, WY
  ["840", "847", "5"],      // Utah
  ["870", "884", "5"],      // New Mexico
  ["800", "816", "5"],      // Colorado
  ["798", "799", "5"],      // El Paso TX
  ["885", "885", "5"],      // El Paso TX (885)
  ["970", "979", "5"],      // Oregon
  ["832", "838", "5"],      // Idaho
  ["820", "831", "5"],      // Wyoming
  // Zone 6 — WA, MT, KS, OK, most of Texas
  ["980", "994", "6"],      // Washington
  ["590", "599", "6"],      // Montana
  ["660", "679", "6"],      // Kansas
  ["730", "749", "6"],      // Oklahoma
  ["750", "797", "6"],      // Texas (Dallas/Houston/Austin/SA)
  // Zone 7 — the central corridor
  ["680", "693", "7"],      // Nebraska
  ["570", "577", "7"],      // South Dakota
  ["580", "588", "7"],      // North Dakota
  ["500", "528", "7"],      // Iowa
  ["630", "658", "7"],      // Missouri
  ["716", "729", "7"],      // Arkansas
  ["700", "714", "7"],      // Louisiana
  // Everything else (MN/WI/IL and all points east, incl. FL) falls
  // through to DEFAULT_ZONE 8.
]);

export const DEFAULT_ZONE = "8";

// Zone -> flat rate in cents. $9.99 close to home, stepping up with
// distance to $15.49 on the East Coast; AK/HI ship 2nd-day-air-ish.
export const ZONE_RATE_CENTS = Object.freeze({
  "2":    999,
  "3":   1049,
  "4":   1149,
  "5":   1249,
  "6":   1349,
  "7":   1449,
  "8":   1549,
  AKHI:  2499,
});

// Zone -> [min, max] business days of carrier transit (UPS Ground
// typicals from Orange County; AK/HI varies more).
export const ZONE_TRANSIT_DAYS = Object.freeze({
  "2":   [1, 2],
  "3":   [2, 3],
  "4":   [2, 3],
  "5":   [3, 4],
  "6":   [3, 4],
  "7":   [4, 5],
  "8":   [4, 5],
  AKHI:  [5, 7],
});

// UPS zone for a destination ZIP, or null when the ZIP isn't a
// usable 5-digit code (callers decide the fallback).
export function upsZoneForZip(zip) {
  const z = typeof zip === "string" ? zip.trim() : "";
  if (!/^\d{5}(-\d{4})?$/.test(z)) return null;
  const prefix = z.slice(0, 3);
  for (const [lo, hi, zone] of ZIP_PREFIX_ZONES) {
    if (prefix >= lo && prefix <= hi) return zone;
  }
  return DEFAULT_ZONE;
}

// Rate descriptor for a ZIP: { zone, amountCents, daysMin, daysMax,
// label }. Invalid/missing ZIP -> the DEFAULT_ZONE rate labeled as a
// flat rate (can only over-charge, never undercut — and the browser
// requires a ZIP before paid-shipping checkout, so this path is for
// direct API callers only).
export function rateForZip(zip) {
  const zone = upsZoneForZip(zip);
  const effective = zone ?? DEFAULT_ZONE;
  const [daysMin, daysMax] = ZONE_TRANSIT_DAYS[effective];
  return {
    zone: effective,
    quotedFromZip: zone !== null,
    amountCents: ZONE_RATE_CENTS[effective],
    daysMin,
    daysMax,
    label: effective === "AKHI"
      ? "UPS to Alaska / Hawaii / territories"
      : (zone !== null ? `UPS Ground (zone ${effective})` : "U.S. shipping (flat rate)"),
  };
}

// Stripe `shipping_options` for a checkout session. Free at/above
// the threshold (one $0 option keeps the Shipping line visible so
// the customer sees what they earned); otherwise the single zone-
// priced option for their ZIP.
export function buildShippingOptionsForZip(zip, subtotalCents, freeThresholdCents) {
  if (subtotalCents >= freeThresholdCents) {
    return [{
      shipping_rate_data: {
        type: "fixed_amount",
        fixed_amount: { amount: 0, currency: "usd" },
        display_name: "Free U.S. shipping",
        delivery_estimate: {
          minimum: { unit: "business_day", value: 3 },
          maximum: { unit: "business_day", value: 5 },
        },
      },
    }];
  }
  const rate = rateForZip(zip);
  return [{
    shipping_rate_data: {
      type: "fixed_amount",
      fixed_amount: { amount: rate.amountCents, currency: "usd" },
      display_name: rate.label,
      delivery_estimate: {
        minimum: { unit: "business_day", value: rate.daysMin },
        maximum: { unit: "business_day", value: rate.daysMax },
      },
    },
  }];
}
