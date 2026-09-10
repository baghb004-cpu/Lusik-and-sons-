// ============================================================
// capabilityTier — the pure "which tier is this device?" resolver
// ============================================================
// The capability ladder (SITE_OVERHAUL_HANDOFF.md, section 11.1) puts
// every visitor in one of three tiers and lets every asset class read
// that one decision instead of sniffing on its own:
//
//   full  4G or better, 4 GB+ RAM, a desktop or a recent phone
//   lean  3G, Save-Data / prefers-reduced-data, 2 to 3 GB RAM, two
//         cores or fewer, a nearly-dead battery, or a measured slow
//         first image
//   core  2G, under 2 GB RAM, or storage nearly full (the site still
//         works with JavaScript off entirely; that path is exercised
//         by the core-2g Playwright project, not by this resolver)
//
// This file is plain JavaScript on purpose: the browser wiring in
// capability.ts imports it, AND the Node unit test in
// netlify/functions/_lib/__tests__/capability-tier.test.mjs imports it
// directly (CI runs Node 20, which cannot load .ts). Keep it free of
// DOM access so both can.
//
// A user's own choice always wins (the "Lighter version" toggle in the
// footer, or ?tier= in the URL for testing). Never trap a visitor in a
// tier they did not pick.
// ============================================================

export const TIERS = Object.freeze(["full", "lean", "core"]);
export const TIER_STORAGE_KEY = "lusik_tier_v1";          // the visitor's own choice (persists)
export const TIER_SESSION_KEY = "lusik_tier_session_v1";  // ?tier= override (this tab only)

/** @returns {"full"|"lean"|"core"|null} */
export function normalizeTier(value) {
  return typeof value === "string" && TIERS.includes(value) ? value : null;
}

/**
 * Resolve a tier from the signals a browser can read.
 *
 * @param {object} [s]
 * @param {{effectiveType?: string, saveData?: boolean, reducedData?: boolean, rtt?: number, downlink?: number}} [s.network]
 * @param {{memoryGb?: number, cores?: number}} [s.device]
 * @param {{freeMb?: number}} [s.storage]
 * @param {{level?: number, charging?: boolean}} [s.power]
 * @param {number} [s.firstImageMs]  measured load time of the first product photo
 * @param {string|null} [override]   a user/test choice; wins outright when valid
 * @returns {{tier: "full"|"lean"|"core", reasons: string[]}}
 */
export function resolveTier(s = {}, override = null) {
  const chosen = normalizeTier(override);
  if (chosen) return { tier: chosen, reasons: ["override"] };

  const net = s.network || {};
  const dev = s.device || {};
  const sto = s.storage || {};
  const pow = s.power || {};
  const et = String(net.effectiveType || "").toLowerCase();
  const reasons = [];

  // ---- core: the page must stay small and still ----
  if (/(^|-)2g$/.test(et)) reasons.push(`network:${et}`);
  if (isNum(dev.memoryGb) && dev.memoryGb < 2) reasons.push("memory:<2gb");
  if (isNum(sto.freeMb) && sto.freeMb < 20) reasons.push("storage:<20mb");
  if (reasons.length) return { tier: "core", reasons };

  // ---- lean: full layout, lighter assets, less motion ----
  if (et === "3g") reasons.push("network:3g");
  if (net.saveData) reasons.push("network:save-data");
  if (net.reducedData) reasons.push("pref:reduced-data");
  if (isNum(net.rtt) && net.rtt >= 400) reasons.push("network:rtt>=400");
  if (isNum(net.downlink) && net.downlink > 0 && net.downlink < 1) reasons.push("network:downlink<1mbps");
  if (isNum(dev.memoryGb) && dev.memoryGb <= 3) reasons.push("memory:<=3gb");
  if (isNum(dev.cores) && dev.cores <= 2) reasons.push("cpu:<=2cores");
  if (isNum(sto.freeMb) && sto.freeMb < 100) reasons.push("storage:<100mb");
  if (pow.charging === false && isNum(pow.level) && pow.level < 0.15) reasons.push("battery:<15%");
  if (isNum(s.firstImageMs) && s.firstImageMs > 2500) reasons.push("measured:slow-first-image");
  if (reasons.length) return { tier: "lean", reasons };

  return { tier: "full", reasons: ["defaults"] };
}

function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}
