// ============================================================
// Shipping-zones drift + correctness guard
// ============================================================
// The zone table lives twice on purpose:
//   - Server: _lib/shipping-zones.mjs — what Stripe checkout charges.
//   - Browser: src/data/shippingZones.js — the ZIP estimates shown
//     on the product page + checkout.
//
// They MUST stay identical, or the customer sees one shipping price
// and gets charged another. This test enforces lockstep plus the
// behavioral contract of the lookup itself.
//
// When it fails: reconcile src/data/shippingZones.js with
// netlify/functions/_lib/shipping-zones.mjs and commit both together.
// ============================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ZIP_PREFIX_ZONES,
  DEFAULT_ZONE,
  ZONE_RATE_CENTS,
  ZONE_TRANSIT_DAYS,
  upsZoneForZip,
  rateForZip,
  buildShippingOptionsForZip,
} from "../shipping-zones.mjs";

const browser = await import("../../../../src/data/shippingZones.js");

test("zone table, rates, and transit days are identical on server and browser", () => {
  assert.deepEqual(
    browser.ZIP_PREFIX_ZONES.map((r) => [...r]),
    ZIP_PREFIX_ZONES.map((r) => [...r]),
    "ZIP_PREFIX_ZONES drift between src/data/shippingZones.js and _lib/shipping-zones.mjs",
  );
  assert.equal(browser.DEFAULT_ZONE, DEFAULT_ZONE, "DEFAULT_ZONE drift");
  assert.deepEqual({ ...browser.ZONE_RATE_CENTS }, { ...ZONE_RATE_CENTS }, "ZONE_RATE_CENTS drift");
  assert.deepEqual({ ...browser.ZONE_TRANSIT_DAYS }, { ...ZONE_TRANSIT_DAYS }, "ZONE_TRANSIT_DAYS drift");
});

test("browser estimate matches the server rate for sample ZIPs", () => {
  for (const zip of ["90630", "94103", "85001", "80202", "75201", "63101", "33101", "10001", "99501"]) {
    const est = browser.estimateShippingForZip(zip);
    const rate = rateForZip(zip);
    assert.ok(est, `browser estimate missing for ${zip}`);
    assert.equal(est.zone, rate.zone, `zone mismatch for ${zip}`);
    assert.equal(Math.round(est.dollars * 100), rate.amountCents, `price mismatch for ${zip}`);
  }
});

test("zone lookup maps known ZIPs to the expected UPS zone", () => {
  const cases = [
    ["90630", "2"],    // Cypress, CA (origin)
    ["92101", "2"],    // San Diego
    ["93650", "3"],    // Fresno
    ["89109", "3"],    // Las Vegas
    ["94103", "4"],    // San Francisco
    ["95814", "4"],    // Sacramento
    ["85001", "4"],    // Phoenix
    ["84101", "5"],    // Salt Lake City
    ["87102", "5"],    // Albuquerque
    ["80202", "5"],    // Denver
    ["97201", "5"],    // Portland
    ["98101", "6"],    // Seattle
    ["75201", "6"],    // Dallas
    ["77002", "6"],    // Houston
    ["73102", "6"],    // Oklahoma City
    ["63101", "7"],    // St. Louis
    ["70112", "7"],    // New Orleans
    ["50309", "7"],    // Des Moines
    ["60601", "8"],    // Chicago (default band)
    ["33101", "8"],    // Miami
    ["10001", "8"],    // New York
    ["30303", "8"],    // Atlanta
    ["99501", "AKHI"], // Anchorage
    ["96813", "AKHI"], // Honolulu
    ["00901", "AKHI"], // San Juan PR
  ];
  for (const [zip, zone] of cases) {
    assert.equal(upsZoneForZip(zip), zone, `wrong zone for ${zip}`);
  }
});

test("invalid ZIPs return null from the lookup and fall back safely in rateForZip", () => {
  for (const bad of ["", "123", "abcde", "9063", "90630-12", null, undefined, 90630]) {
    assert.equal(upsZoneForZip(bad), null, `expected null zone for ${String(bad)}`);
  }
  const fallback = rateForZip("");
  assert.equal(fallback.zone, DEFAULT_ZONE, "fallback must use the default (most expensive ground) zone");
  assert.equal(fallback.quotedFromZip, false);
  assert.equal(fallback.amountCents, ZONE_RATE_CENTS[DEFAULT_ZONE]);
});

test("rates increase with distance and every zone has a rate + transit window", () => {
  const ground = ["2", "3", "4", "5", "6", "7", "8"];
  for (let i = 1; i < ground.length; i++) {
    assert.ok(
      ZONE_RATE_CENTS[ground[i]] > ZONE_RATE_CENTS[ground[i - 1]],
      `zone ${ground[i]} must cost more than zone ${ground[i - 1]}`,
    );
  }
  assert.ok(ZONE_RATE_CENTS.AKHI > ZONE_RATE_CENTS["8"], "AK/HI must cost more than zone 8");
  for (const zone of [...ground, "AKHI"]) {
    const days = ZONE_TRANSIT_DAYS[zone];
    assert.ok(Array.isArray(days) && days.length === 2 && days[0] >= 1 && days[1] >= days[0],
      `bad transit window for zone ${zone}`);
  }
});

test("buildShippingOptionsForZip: free at/above the threshold, zone-priced below it", () => {
  const free = buildShippingOptionsForZip("33101", 15000, 15000);
  assert.equal(free.length, 1);
  assert.equal(free[0].shipping_rate_data.fixed_amount.amount, 0);
  assert.match(free[0].shipping_rate_data.display_name, /free/i);

  const paidFL = buildShippingOptionsForZip("33101", 4000, 15000);
  assert.equal(paidFL.length, 1);
  assert.equal(paidFL[0].shipping_rate_data.fixed_amount.amount, ZONE_RATE_CENTS["8"]);

  const paidCA = buildShippingOptionsForZip("90630", 4000, 15000);
  assert.equal(paidCA[0].shipping_rate_data.fixed_amount.amount, ZONE_RATE_CENTS["2"]);
  assert.ok(
    paidFL[0].shipping_rate_data.fixed_amount.amount > paidCA[0].shipping_rate_data.fixed_amount.amount,
    "Florida must be charged more than California",
  );
});
