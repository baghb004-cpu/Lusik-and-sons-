// ============================================================
// LOOM TIER RESOLVER
// ============================================================
// The resolver decides whether a visitor's device gets the 3D engine at
// all. Getting it wrong in the generous direction means a phone tries to
// render a 60k-instance blanket and locks up; getting it wrong in the
// stingy direction means a desktop visitor never sees the product.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveLoomTier, isSoftwareRenderer, readLoomOverride, LOOM_SETTINGS, SLOW_PROBE_MS,
} from "../../../../src/loom/tier.js";

const GOOD_GPU = { webgl2: true, webgl: true, renderer: "Apple M2", probeMs: 12 };

test("a full-tier device with a healthy WebGL 2 stack gets the whole engine", () => {
  const { tier } = resolveLoomTier({ capabilityTier: "full", gpu: GOOD_GPU });
  assert.equal(tier, "high");
});

test("a lean device still gets the engine, in its cheap configuration", () => {
  const { tier, reasons } = resolveLoomTier({ capabilityTier: "lean", gpu: GOOD_GPU });
  assert.equal(tier, "mid");
  assert.ok(reasons.includes("capability:lean"));
});

test("a core device never loads the engine", () => {
  // The whole point of the capability ladder: one decision, respected here.
  const { tier } = resolveLoomTier({ capabilityTier: "core", gpu: GOOD_GPU });
  assert.equal(tier, "low");
});

test("no WebGL 2 means poster only, whatever the site tier says", () => {
  assert.equal(resolveLoomTier({ capabilityTier: "full", gpu: { webgl2: false, webgl: true } }).tier, "low");
  assert.equal(resolveLoomTier({ capabilityTier: "full", gpu: { webgl2: false, webgl: false } }).tier, "low");
});

test("a slow probe drops to poster even when the GPU claims WebGL 2", () => {
  const gpu = { ...GOOD_GPU, probeMs: SLOW_PROBE_MS + 1 };
  const { tier, reasons } = resolveLoomTier({ capabilityTier: "full", gpu });
  assert.equal(tier, "low");
  assert.ok(reasons.some((r) => r.startsWith("slow-probe")));
});

test("a probe exactly at the threshold is still allowed", () => {
  const gpu = { ...GOOD_GPU, probeMs: SLOW_PROBE_MS };
  assert.equal(resolveLoomTier({ capabilityTier: "full", gpu }).tier, "high");
});

test("software renderers report WebGL 2 and render at a crawl, so they get mid", () => {
  for (const renderer of [
    "Google SwiftShader",
    "llvmpipe (LLVM 15.0.7, 256 bits)",
    "Microsoft Basic Render Driver",
    "ANGLE (Software Adapter)",
  ]) {
    const { tier } = resolveLoomTier({ capabilityTier: "full", gpu: { ...GOOD_GPU, renderer } });
    assert.equal(tier, "mid", `${renderer} should not get the high tier`);
  }
  assert.equal(isSoftwareRenderer("Apple M2"), false);
  assert.equal(isSoftwareRenderer(undefined), false);
});

test("an unprobed GPU is treated as low, never guessed high", () => {
  // Mounting the engine before probing would be exactly the mistake the
  // capability ladder exists to prevent.
  assert.equal(resolveLoomTier({ capabilityTier: "full", gpu: null }).tier, "low");
  assert.equal(resolveLoomTier({ capabilityTier: "full", gpu: undefined }).tier, "low");
});

test("two lost contexts means stop trying", () => {
  const { tier, reasons } = resolveLoomTier({ capabilityTier: "full", gpu: GOOD_GPU, contextLost: true });
  assert.equal(tier, "low");
  assert.deepEqual(reasons, ["context-lost"]);
});

test("the override wins over every signal, in both directions", () => {
  // Forcing high on a throttled profile is how the tier gets tested at all.
  assert.equal(resolveLoomTier({ capabilityTier: "core", gpu: null, override: "high" }).tier, "high");
  assert.equal(resolveLoomTier({ capabilityTier: "full", gpu: GOOD_GPU, override: "low" }).tier, "low");
});

test("a junk override is ignored rather than trusted", () => {
  const { tier } = resolveLoomTier({ capabilityTier: "full", gpu: GOOD_GPU, override: "ultra" });
  assert.equal(tier, "high");
});

test("readLoomOverride only accepts the three real tiers", () => {
  assert.equal(readLoomOverride("?loom=high"), "high");
  assert.equal(readLoomOverride("?loom=mid"), "mid");
  assert.equal(readLoomOverride("?loom=low"), "low");
  assert.equal(readLoomOverride("?loom=ultra"), null);
  assert.equal(readLoomOverride("?tier=full"), null);
  assert.equal(readLoomOverride(""), null);
});

test("every tier has settings, and low is genuinely off", () => {
  for (const tier of ["high", "mid", "low"]) {
    assert.ok(LOOM_SETTINGS[tier], `${tier} has no settings`);
  }
  assert.equal(LOOM_SETTINGS.low.targetFps, 0, "low must not run a render loop");
  assert.equal(LOOM_SETTINGS.low.textureSize, 0, "low must not generate textures");
  assert.ok(LOOM_SETTINGS.mid.dprCap < LOOM_SETTINGS.high.dprCap);
  assert.equal(LOOM_SETTINGS.mid.shadows, false, "mid must not pay for shadow maps");
});
