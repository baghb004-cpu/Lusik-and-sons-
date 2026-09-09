// ============================================================
// LOOM TIER — how much engine this device gets
// ============================================================
// Plain JavaScript, not TypeScript, and deliberately so. The hand-off
// plan says everything under src/loom/ is TypeScript, but the repo has a
// stronger, load-bearing convention: pure logic that a Node 20 unit test
// must import is plain .js with JSDoc types (see src/lib/capabilityTier.js,
// leadTime.js, contrast.js). CI runs the unit suite on Node 20, which
// cannot import .ts. Rendering code under src/loom/ is .ts as specified;
// only the pure resolvers are .js. JSDoc keeps `npm run typecheck` honest.
//
// This does NOT sniff the device. The capability ladder (src/lib/capability.ts)
// already made that decision once for the whole site, and PR 16 left
// getGpuSignal() here for exactly this caller. Re-sniffing would be a second
// source of truth that could disagree with what the CSS is already doing.
//
//   high — full engine: shadows, DPR up to 2, full instance counts
//   mid  — DPR 1.5, no shadow maps, baked contact shadow, fewer strands
//   low  — poster only. The engine never loads; the 2D BlanketLayoutPreview
//          stays the live preview, so typing a name still shows something.
// ============================================================

/** @typedef {"high" | "mid" | "low"} LoomTier */
/** @typedef {"full" | "lean" | "core"} CapabilityTier */
/** @typedef {{ webgl2: boolean, webgl: boolean, renderer?: string, probeMs?: number }} GpuSignal */

/** A WebGL probe slower than this means a struggling GPU, whatever it reports. */
export const SLOW_PROBE_MS = 200;

/**
 * Resolve the Loom tier. Pure: same inputs, same answer, no globals.
 *
 * @param {object} input
 * @param {CapabilityTier} input.capabilityTier  what the site already decided
 * @param {GpuSignal | null | undefined} input.gpu  result of getGpuSignal(), or null if not probed
 * @param {LoomTier | null} [input.override]  ?loom=high|mid|low, for testing
 * @param {boolean} [input.contextLost]  a WebGL context was lost twice
 * @returns {{ tier: LoomTier, reasons: string[] }}
 */
export function resolveLoomTier({ capabilityTier, gpu, override = null, contextLost = false }) {
  const reasons = [];

  // The visitor's own choice wins, exactly as it does in the capability
  // ladder. Testing needs to be able to force `high` on a throttled profile.
  if (override === "high" || override === "mid" || override === "low") {
    return { tier: override, reasons: ["override"] };
  }

  // Two lost contexts is a driver saying no. Never a third attempt.
  if (contextLost) return { tier: "low", reasons: ["context-lost"] };

  // The site already decided this device cannot afford decoration.
  if (capabilityTier === "core") return { tier: "low", reasons: ["capability:core"] };

  // No probe yet — the caller must probe before mounting. Treat as low
  // rather than guessing high and blowing up a phone.
  if (!gpu) return { tier: "low", reasons: ["gpu-not-probed"] };

  if (!gpu.webgl2) {
    reasons.push(gpu.webgl ? "webgl1-only" : "no-webgl");
    return { tier: "low", reasons };
  }

  if (typeof gpu.probeMs === "number" && gpu.probeMs > SLOW_PROBE_MS) {
    reasons.push(`slow-probe:${Math.round(gpu.probeMs)}ms`);
    return { tier: "low", reasons };
  }

  // A lean device with a working WebGL 2 stack still gets the engine, just
  // the cheap configuration of it.
  if (capabilityTier === "lean") return { tier: "mid", reasons: ["capability:lean"] };

  // Software renderers report WebGL 2 and probe fast, then render at 4 fps.
  if (isSoftwareRenderer(gpu.renderer)) {
    reasons.push("software-renderer");
    return { tier: "mid", reasons };
  }

  return { tier: "high", reasons: ["capability:full"] };
}

/**
 * SwiftShader / llvmpipe / ANGLE's software backend all render correctly and
 * far too slowly. The strings are what the WEBGL_debug_renderer_info
 * extension reports; matching is deliberately loose.
 *
 * @param {string | undefined} renderer
 * @returns {boolean}
 */
export function isSoftwareRenderer(renderer) {
  if (!renderer) return false;
  const r = renderer.toLowerCase();
  return (
    r.includes("swiftshader") ||
    r.includes("llvmpipe") ||
    r.includes("software") ||
    r.includes("basic render") ||
    r.includes("microsoft basic")
  );
}

/**
 * Read the ?loom= override. Session-scoped like the capability ladder's
 * ?tier=, so a test can pin it without touching the visitor's stored choice.
 *
 * @param {string} [search] location.search, injectable for tests
 * @returns {LoomTier | null}
 */
export function readLoomOverride(search) {
  const raw = typeof search === "string"
    ? search
    : (typeof window !== "undefined" ? window.location.search : "");
  if (!raw) return null;
  const value = new URLSearchParams(raw).get("loom");
  return value === "high" || value === "mid" || value === "low" ? value : null;
}

/** Per-tier engine settings. The renderer reads these; nothing else decides. */
export const LOOM_SETTINGS = {
  high: { dprCap: 2,   shadows: true,  targetFps: 60, textureSize: 2048, fringeStrands: 96 },
  mid:  { dprCap: 1.5, shadows: false, targetFps: 30, textureSize: 1024, fringeStrands: 40 },
  low:  { dprCap: 1,   shadows: false, targetFps: 0,  textureSize: 0,    fringeStrands: 0 },
};
