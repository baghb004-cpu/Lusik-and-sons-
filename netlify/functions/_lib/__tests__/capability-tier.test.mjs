// Capability ladder — the pure tier resolver (src/lib/capabilityTier.js).
// Node 20 in CI cannot import .ts, which is why the resolver is plain JS.
import { test } from "node:test";
import assert from "node:assert/strict";

const { resolveTier, normalizeTier, TIERS } = await import("../../../../src/lib/capabilityTier.js");

test("no signals at all resolves to full", () => {
  assert.equal(resolveTier().tier, "full");
  assert.equal(resolveTier({}).tier, "full");
});

test("a valid override wins over every signal; an invalid one is ignored", () => {
  const slow = { network: { effectiveType: "2g" } };
  assert.equal(resolveTier(slow, "full").tier, "full");
  assert.deepEqual(resolveTier(slow, "full").reasons, ["override"]);
  assert.equal(resolveTier(slow, "nonsense").tier, "core");
  assert.equal(normalizeTier("lean"), "lean");
  assert.equal(normalizeTier("LEAN"), null);
  assert.equal(normalizeTier(undefined), null);
  assert.deepEqual([...TIERS], ["full", "lean", "core"]);
});

test("core: 2G, under 2 GB of memory, or storage nearly full", () => {
  assert.equal(resolveTier({ network: { effectiveType: "slow-2g" } }).tier, "core");
  assert.equal(resolveTier({ network: { effectiveType: "2g" } }).tier, "core");
  assert.equal(resolveTier({ device: { memoryGb: 1 } }).tier, "core");
  assert.equal(resolveTier({ device: { memoryGb: 0.5 } }).tier, "core");
  assert.equal(resolveTier({ storage: { freeMb: 10 } }).tier, "core");
});

test("lean: 3G, save-data, reduced-data, high rtt, low downlink, 2 to 3 GB, two cores, low storage, dying battery, slow image", () => {
  assert.equal(resolveTier({ network: { effectiveType: "3g" } }).tier, "lean");
  assert.equal(resolveTier({ network: { saveData: true } }).tier, "lean");
  assert.equal(resolveTier({ network: { reducedData: true } }).tier, "lean");
  assert.equal(resolveTier({ network: { rtt: 450 } }).tier, "lean");
  assert.equal(resolveTier({ network: { downlink: 0.6 } }).tier, "lean");
  assert.equal(resolveTier({ device: { memoryGb: 2 } }).tier, "lean");
  assert.equal(resolveTier({ device: { cores: 2 } }).tier, "lean");
  assert.equal(resolveTier({ storage: { freeMb: 60 } }).tier, "lean");
  assert.equal(resolveTier({ power: { level: 0.1, charging: false } }).tier, "lean");
  assert.equal(resolveTier({ firstImageMs: 3000 }).tier, "lean");
});

test("full: a healthy phone or desktop, a charging low battery, a fast image", () => {
  assert.equal(resolveTier({ network: { effectiveType: "4g", rtt: 50, downlink: 10 }, device: { memoryGb: 8, cores: 8 }, storage: { freeMb: 5000 } }).tier, "full");
  assert.equal(resolveTier({ power: { level: 0.1, charging: true } }).tier, "full");
  assert.equal(resolveTier({ firstImageMs: 400 }).tier, "full");
  assert.equal(resolveTier({ network: { downlink: 0 } }).tier, "full"); // 0 = unknown, not slow
});

test("reasons name every signal that fired, worst tier first", () => {
  const r = resolveTier({ network: { effectiveType: "3g", saveData: true }, device: { cores: 2 } });
  assert.equal(r.tier, "lean");
  assert.deepEqual(r.reasons, ["network:3g", "network:save-data", "cpu:<=2cores"]);
  const c = resolveTier({ network: { effectiveType: "2g", saveData: true } });
  assert.deepEqual(c.reasons, ["network:2g"]);
});
