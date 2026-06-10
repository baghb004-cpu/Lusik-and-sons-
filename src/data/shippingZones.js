// ============================================================
// shippingZones — browser mirror of the zone-based shipping rates
// ============================================================
// DISPLAY ONLY. The server copy in
// netlify/functions/_lib/shipping-zones.mjs is what Stripe checkout
// actually charges; this mirror drives the ZIP estimates shown on
// the product page (ShippingEstimator) and the checkout page. The
// two files are kept in lockstep by shipping-zones-drift.test.mjs —
// same mirror-plus-drift-test pattern as trusted-products and the
// free-shipping threshold. Change a rate or prefix range in BOTH
// files together.
//
// Zones approximate the UPS Ground chart from our origin (Cypress,
// CA 90630): zone 2 = Southern California, stepping up with distance
// to zone 8 = East Coast, plus an AK/HI/territories bucket.
// ============================================================

export const ZIP_PREFIX_ZONES = Object.freeze([
  // AK / HI / U.S. territories
  ["995", "999", "AKHI"],
  ["967", "969", "AKHI"],
  ["006", "009", "AKHI"],
  // Zone 2 — Southern + Central-Coast California
  ["900", "935", "2"],
  // Zone 3 — Central Valley CA, Las Vegas
  ["936", "939", "3"],
  ["889", "893", "3"],
  // Zone 4 — Northern CA, Reno, Arizona
  ["940", "961", "4"],
  ["894", "899", "4"],
  ["850", "865", "4"],
  // Zone 5 — Mountain West, NM, CO, El Paso, OR, ID, WY
  ["840", "847", "5"],
  ["870", "884", "5"],
  ["800", "816", "5"],
  ["798", "799", "5"],
  ["885", "885", "5"],
  ["970", "979", "5"],
  ["832", "838", "5"],
  ["820", "831", "5"],
  // Zone 6 — WA, MT, KS, OK, most of Texas
  ["980", "994", "6"],
  ["590", "599", "6"],
  ["660", "679", "6"],
  ["730", "749", "6"],
  ["750", "797", "6"],
  // Zone 7 — the central corridor
  ["680", "693", "7"],
  ["570", "577", "7"],
  ["580", "588", "7"],
  ["500", "528", "7"],
  ["630", "658", "7"],
  ["716", "729", "7"],
  ["700", "714", "7"],
]);

export const DEFAULT_ZONE = "8";

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

// UPS zone for a ZIP, or null when it isn't a usable 5-digit code.
export function upsZoneForZip(zip) {
  const z = typeof zip === "string" ? zip.trim() : "";
  if (!/^\d{5}(-\d{4})?$/.test(z)) return null;
  const prefix = z.slice(0, 3);
  for (const [lo, hi, zone] of ZIP_PREFIX_ZONES) {
    if (prefix >= lo && prefix <= hi) return zone;
  }
  return DEFAULT_ZONE;
}

// Display estimate for a ZIP: { zone, dollars, daysMin, daysMax,
// label } or null when the ZIP isn't valid yet (UI keeps waiting).
export function estimateShippingForZip(zip) {
  const zone = upsZoneForZip(zip);
  if (zone === null) return null;
  const [daysMin, daysMax] = ZONE_TRANSIT_DAYS[zone];
  return {
    zone,
    dollars: ZONE_RATE_CENTS[zone] / 100,
    daysMin,
    daysMax,
    label: zone === "AKHI"
      ? "UPS to Alaska / Hawaii / territories"
      : `UPS Ground (zone ${zone})`,
  };
}

// The advertised price band ("from $9.99") for teaser copy.
export const SHIPPING_FROM_DOLLARS = ZONE_RATE_CENTS["2"] / 100;
export const SHIPPING_TO_DOLLARS   = ZONE_RATE_CENTS["8"] / 100;
