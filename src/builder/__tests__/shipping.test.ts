import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  shippingConfigSchema,
  zipDatasetSchema,
  normalizeZip,
  lookupZip,
  evaluateShipping,
  parseZipCsv,
  trimEntries,
  type ShippingConfig,
  type ZipDataset,
} from "../data/index.ts";

const config = (): ShippingConfig =>
  shippingConfigSchema.parse({
    schemaVersion: 1,
    originZip: "90620",
    freeShippingOverCents: 15000,
    localDelivery: { zips: ["90620", "90621"], rateCents: 0, label: "Hand-delivered locally" },
    blockedZips: ["96799"],
    zones: [
      { id: "west", label: "West", prefixes: ["8", "9"], rateCents: 600 },
      { id: "socal", label: "SoCal", prefixes: ["90", "91"], rateCents: 400 },
    ],
    defaultRateCents: 1000,
    leadTimeNote: "5–10 business days",
  });

const dataset = (): ZipDataset =>
  zipDatasetSchema.parse({
    schemaVersion: 1,
    manifest: {
      id: "test-ca",
      name: "Test CA",
      kind: "zip-places",
      source: "test fixture",
      licenseNotes: "fixture — no restrictions",
      version: "2026-06-12",
      importedAt: "2026-06-12T00:00:00Z",
      updatedAt: "2026-06-12T00:00:00Z",
      coverage: "CA sample",
      limitations: "",
      rows: 2,
    },
    entries: [
      { zip: "90620", city: "Buena Park", state: "CA", alternates: ["Buena Park Mall"] },
      { zip: "94110", city: "San Francisco", state: "CA", alternates: [] },
    ],
  });

// ── schema law ──────────────────────────────────────────────
test("LICENSING GATE: a dataset without source or licenseNotes cannot be saved", () => {
  const d = dataset() as unknown as { manifest: Record<string, unknown> };
  const noLicense = structuredClone(d);
  noLicense.manifest.licenseNotes = "";
  assert.equal(zipDatasetSchema.safeParse(noLicense).success, false);
  const noSource = structuredClone(d);
  noSource.manifest.source = "";
  assert.equal(zipDatasetSchema.safeParse(noSource).success, false);
});

test("manifest.rows must match entries; duplicate zone ids refused", () => {
  const d = structuredClone(dataset()) as unknown as { manifest: { rows: number } };
  d.manifest.rows = 99;
  assert.equal(zipDatasetSchema.safeParse(d).success, false);

  const c = structuredClone(config()) as unknown as { zones: Array<{ id: string }> };
  c.zones[1].id = "west";
  assert.equal(shippingConfigSchema.safeParse(c).success, false);
});

test("the seeded builder/data/shipping.json validates", () => {
  const raw = JSON.parse(readFileSync(join(process.cwd(), "builder/data/shipping.json"), "utf8"));
  const parsed = shippingConfigSchema.safeParse(raw);
  assert.equal(parsed.success, true, JSON.stringify(!parsed.success && parsed.error.issues));
  assert.equal((parsed as { success: true; data: ShippingConfig }).data.originZip, "90620");
});

// ── lookup + evaluation ─────────────────────────────────────
test("normalizeZip: shapes, noise, ZIP+4", () => {
  assert.equal(normalizeZip(" 90620 "), "90620");
  assert.equal(normalizeZip("90620-1234"), "90620");
  assert.equal(normalizeZip("9062"), null);
  assert.equal(normalizeZip("abcde"), null);
});

test("evaluation order: blocked > local > free > zone > default", () => {
  const c = config();
  const d = dataset();
  assert.equal(evaluateShipping(c, d, "96799", 5000).kind, "blocked");
  // local delivery wins even over the free threshold
  assert.equal(evaluateShipping(c, d, "90620", 99999).kind, "local-delivery");
  assert.equal(evaluateShipping(c, d, "94110", 20000).kind, "free");
  const zone = evaluateShipping(c, d, "94110", 5000);
  assert.equal(zone.kind, "zone");
  assert.equal(zone.zoneId, "west");
  // longest prefix wins: 90xxx matches both "9" and "90" → socal
  const socal = evaluateShipping(c, d, "90630", 5000);
  assert.equal(socal.zoneId, "socal");
  assert.equal(socal.rateCents, 400);
});

test("FAIL-SOFT LAW: an unknown ZIP never blocks — quote continues, flagged unconfirmed", () => {
  const c = config();
  const d = dataset();
  const quote = evaluateShipping(c, d, "10001", 5000); // not in the CA dataset
  assert.equal(quote.placeConfirmed, false);
  assert.equal(quote.kind, "flat"); // never "blocked" — the default rate still computed
  assert.equal(quote.rateCents, 1000);
  assert.ok(quote.warnings.some((w) => /unconfirmed/.test(w)));

  // no default rate → honest "contact us", still not a refusal of service copy
  const noDefault = { ...c, defaultRateCents: null, zones: [] };
  const contact = evaluateShipping(noDefault, d, "10001", 5000);
  assert.equal(contact.kind, "contact");
  assert.ok(contact.warnings.some((w) => /write to us/.test(w)));
});

test("lookup returns alternates for multi-city ZIPs; no dataset = no confirmation, rules still fire", () => {
  const d = dataset();
  assert.deepEqual(lookupZip(d, "90620")?.alternates, ["Buena Park Mall"]);
  const quote = evaluateShipping(config(), null, "90630", 5000);
  assert.equal(quote.kind, "zone");
  assert.equal(quote.placeConfirmed, false);
  assert.equal(quote.warnings.length, 0); // no dataset = no scary warning either
});

// ── CSV import + trim ───────────────────────────────────────
test("parseZipCsv: header skipped, bad rows reported by line, duplicates merge to alternates", () => {
  const report = parseZipCsv(
    [
      "zip,city,state",
      "90620,Buena Park,CA",
      '"90620","La Palma","CA"',
      "94110,San Francisco,ca",
      "9999,Nowhere,CA",
      "90630,,CA",
      "90631,Whittier,California",
    ].join("\n")
  );
  assert.equal(report.entries.length, 2);
  const bp = report.entries.find((e) => e.zip === "90620")!;
  assert.deepEqual(bp.alternates, ["La Palma"]);
  assert.equal(report.entries.find((e) => e.zip === "94110")?.state, "CA"); // lowercased state fixed
  assert.deepEqual(report.skipped.map((s) => s.line), [5, 6, 7]);
});

test("trimEntries filters by state and prefix for per-site export", () => {
  const entries = dataset().entries;
  assert.equal(trimEntries(entries, { states: ["CA"] }).length, 2);
  assert.equal(trimEntries(entries, { states: ["NY"] }).length, 0);
  assert.equal(trimEntries(entries, { prefixes: ["906"] }).length, 1);
  assert.equal(trimEntries(entries, { states: ["ca"], prefixes: ["94"] }).length, 1);
});
