// ============================================================
// capability — reads the device, picks the tier, tells the page
// ============================================================
// Browser wiring for the capability ladder (SITE_OVERHAUL_HANDOFF.md,
// section 11.1). On init it reads the signals the browser exposes
// (network type and Save-Data, memory and cores, the storage estimate,
// battery, a measured first-image time, screen and preference media
// queries), resolves a tier through the pure resolver in
// capabilityTier.js, and publishes it two ways:
//
//   <html data-tier="full|lean|core">   CSS reads this (index.css, the
//                                       "CAPABILITY LADDER" block)
//   window "capability:change" event    JS reads this (useTier, prefetch)
//
// app/layout.tsx also stamps a provisional data-tier from the cheap
// synchronous signals in an inline <script> before first paint, so the
// lean/core CSS applies during the slow hydration window; this module
// takes over after mount and refines.
//
// Slow signals (storage estimate, battery, the measured first image)
// arrive after the first resolution and may lower the tier; detection
// never raises a tier mid-session, so a page does not start loading
// heavier assets underneath the visitor.
//
// Precedence: the visitor's own choice (the footer's "Lighter version"
// toggle, localStorage) > a ?tier= test pin (consumed once into
// sessionStorage) > detection. Never trap a visitor in a tier they did
// not pick: clearing the choice returns to detection.
//
// SSR: every export is safe to import on the server; getTier() is
// "full" there and until initCapability() runs on the client.
// ============================================================
import { CONFIG } from "../data/config.js";
import {
  resolveTier,
  normalizeTier,
  TIER_STORAGE_KEY,
  TIER_SESSION_KEY,
} from "./capabilityTier.js";

export type Tier = "full" | "lean" | "core";
export const CAPABILITY_EVENT = "capability:change";

export interface CapabilitySignals {
  network?: { effectiveType?: string; saveData?: boolean; reducedData?: boolean; rtt?: number; downlink?: number };
  device?: { memoryGb?: number; cores?: number };
  storage?: { freeMb?: number; quotaMb?: number };
  power?: { level?: number; charging?: boolean };
  screen?: {
    width?: number; height?: number; dpr?: number; colorDepth?: number;
    hover?: boolean; reducedMotion?: boolean; contrastMore?: boolean; forcedColors?: boolean;
  };
  gpu?: { webgl2: boolean; webgl: boolean; renderer?: string; probeMs?: number };
  firstImageMs?: number;
}

export interface CapabilityState {
  tier: Tier;
  reasons: string[];
  override: Tier | null;
  signals: CapabilitySignals;
}

const RANK: Record<Tier, number> = { full: 0, lean: 1, core: 2 };
const ENABLED = CONFIG.TIERS?.ENABLED !== false;
const CHANGE_DEBOUNCE_MS = 2500; // a single rtt/downlink blip must not demote the tab for good

let state: CapabilityState = { tier: "full", reasons: ["ssr"], override: null, signals: {} };
let initialized = false;
let urlConsumed = false;
let memChoice: Tier | null = null; // the visitor's choice when storage is blocked
let changeTimer: ReturnType<typeof setTimeout> | undefined;

export function getTier(): Tier { return state.tier; }
export function getCapability(): CapabilityState { return { ...state, reasons: state.reasons.slice(), signals: state.signals }; }

/** What detection alone would pick right now (ignores every override). */
export function getDetectedTier(): Tier { return resolveTier(state.signals, null).tier as Tier; }

/** The visitor's own persisted choice (footer toggle), if any. */
export function getTierChoice(): Tier | null {
  if (memChoice) return memChoice;
  try { return normalizeTier(localStorage.getItem(TIER_STORAGE_KEY)) as Tier | null; } catch { return null; }
}

/** Store (or clear, with null) the visitor's own choice and re-resolve. */
export function setTierChoice(tier: Tier | null): void {
  if (!ENABLED || typeof window === "undefined") return;
  memChoice = tier;
  try {
    if (tier) localStorage.setItem(TIER_STORAGE_KEY, tier);
    else localStorage.removeItem(TIER_STORAGE_KEY);
    sessionStorage.removeItem(TIER_SESSION_KEY); // a manual choice replaces a ?tier= test pin
  } catch { /* storage blocked: memChoice carries the choice for this page's life */ }
  recompute({ allowRise: true });
}

export function subscribeTier(fn: (s: CapabilityState) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => fn(getCapability());
  window.addEventListener(CAPABILITY_EVENT, handler);
  return () => window.removeEventListener(CAPABILITY_EVENT, handler);
}

/**
 * The WebGL probe, for the 3D product engine to call when it mounts.
 * Memoised; never run eagerly (a context costs tens of milliseconds on the
 * phones the ladder protects) and never a tier input.
 */
export function getGpuSignal(): NonNullable<CapabilitySignals["gpu"]> {
  if (!state.signals.gpu) state.signals.gpu = probeGpu();
  return state.signals.gpu;
}

/** Idempotent. Call once on the client after mount (app/providers.tsx). */
export function initCapability(): void {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
  if (!ENABLED) { apply({ tier: "full", reasons: ["disabled"], override: null, signals: {} }); return; }

  state.signals = readSyncSignals();
  recompute({ allowRise: true });
  bindListeners();
  void refineAsync();
}

// ------------------------------------------------------------
// internals
// ------------------------------------------------------------
function readOverride(): Tier | null {
  const choice = getTierChoice();
  if (choice) return choice;
  try {
    if (!urlConsumed) {
      urlConsumed = true;
      const param = CONFIG.TIERS?.QUERY_PARAM || "tier";
      const fromUrl = normalizeTier(new URLSearchParams(window.location.search).get(param)) as Tier | null;
      if (fromUrl) sessionStorage.setItem(TIER_SESSION_KEY, fromUrl);
    }
    return normalizeTier(sessionStorage.getItem(TIER_SESSION_KEY)) as Tier | null;
  } catch { return null; }
}

function mq(query: string): boolean {
  try { return !!window.matchMedia?.(query).matches; } catch { return false; }
}

type NavWithExtras = Navigator & {
  connection?: { effectiveType?: string; saveData?: boolean; rtt?: number; downlink?: number; addEventListener?: (t: string, f: () => void) => void };
  deviceMemory?: number;
  getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener: (t: string, f: () => void) => void }>;
};

function readNetwork(): NonNullable<CapabilitySignals["network"]> {
  const conn = (navigator as NavWithExtras).connection;
  return {
    effectiveType: conn?.effectiveType,
    saveData: !!conn?.saveData,
    reducedData: mq("(prefers-reduced-data: reduce)"),
    rtt: conn?.rtt,
    downlink: conn?.downlink,
  };
}

function readSyncSignals(): CapabilitySignals {
  const nav = navigator as NavWithExtras;
  return {
    network: readNetwork(),
    device: { memoryGb: nav.deviceMemory, cores: nav.hardwareConcurrency },
    // Published for future consumers (image DPR caps, layout decisions);
    // not a tier input today.
    screen: {
      width: window.innerWidth, height: window.innerHeight,
      dpr: window.devicePixelRatio, colorDepth: window.screen?.colorDepth,
      hover: mq("(hover: hover)"),
      reducedMotion: mq("(prefers-reduced-motion: reduce)"),
      contrastMore: mq("(prefers-contrast: more)"),
      forcedColors: mq("(forced-colors: active)"),
    },
  };
}

function probeGpu(): NonNullable<CapabilitySignals["gpu"]> {
  try {
    const t0 = performance.now();
    const canvas = document.createElement("canvas");
    const gl2 = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
    const gl = gl2 || (canvas.getContext("webgl") as WebGLRenderingContext | null);
    let renderer: string | undefined;
    if (gl) {
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      if (info) renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    return { webgl2: !!gl2, webgl: !!gl, renderer, probeMs: Math.round(performance.now() - t0) };
  } catch {
    return { webgl2: false, webgl: false };
  }
}

async function refineAsync(): Promise<void> {
  // Measured truth: how long the first product photo actually takes.
  // Networks lie about effectiveType; a 2.5 s image does not. Observed,
  // not snapshotted, so a slow image still counts when it finishes late;
  // next/image URLs carry the photo path encoded (%2Fimg%2F).
  watchFirstImage();

  // Storage headroom (the ladder drops to lean under 100 MB, core under 20 MB).
  try {
    const est = await navigator.storage?.estimate?.();
    if (est && typeof est.quota === "number") {
      const quotaMb = est.quota / 1048576;
      const usageMb = (est.usage || 0) / 1048576;
      state.signals.storage = { quotaMb: Math.round(quotaMb), freeMb: Math.round(quotaMb - usageMb) };
    }
  } catch { /* unsupported */ }

  // Battery: below 15 percent and discharging drops one tier's worth of motion + 3D.
  try {
    const battery = await (navigator as NavWithExtras).getBattery?.();
    if (battery) {
      const sync = () => { state.signals.power = { level: battery.level, charging: battery.charging }; recompute({ allowRise: false }); };
      battery.addEventListener("levelchange", sync);
      battery.addEventListener("chargingchange", sync);
      state.signals.power = { level: battery.level, charging: battery.charging };
    }
  } catch { /* unsupported */ }

  recompute({ allowRise: false });
}

function watchFirstImage(): void {
  try {
    const isPhoto = (e: PerformanceResourceTiming) =>
      (e.initiatorType === "img" || e.initiatorType === "link") && /\/img\/|%2Fimg%2F/i.test(e.name);
    const take = (e: PerformanceResourceTiming) => {
      state.signals.firstImageMs = Math.round((e.responseEnd || e.duration) - (e.startTime || 0));
      recompute({ allowRise: false });
    };
    const already = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).find(isPhoto);
    if (already) { take(already); return; }
    const po = new PerformanceObserver((list) => {
      const hit = (list.getEntries() as PerformanceResourceTiming[]).find(isPhoto);
      if (hit) { take(hit); po.disconnect(); }
    });
    po.observe({ type: "resource", buffered: true });
  } catch { /* unsupported */ }
}

function bindListeners(): void {
  // A network change is confirmed with a second read a moment later, so a
  // single rtt/downlink blip cannot demote the tab for the rest of its life.
  const onNetworkChange = () => {
    if (changeTimer) clearTimeout(changeTimer);
    changeTimer = setTimeout(() => {
      state.signals = { ...state.signals, network: readNetwork() };
      recompute({ allowRise: false });
    }, CHANGE_DEBOUNCE_MS);
  };
  (navigator as NavWithExtras).connection?.addEventListener?.("change", onNetworkChange);
  try { window.matchMedia("(prefers-reduced-data: reduce)").addEventListener?.("change", onNetworkChange); } catch { /* unsupported */ }
}

function recompute({ allowRise }: { allowRise: boolean }): void {
  if (!ENABLED) return;
  const override = readOverride();
  const resolved = resolveTier(state.signals, override);
  let tier = resolved.tier as Tier;
  let reasons = resolved.reasons;
  // Detection may only lower the tier mid-session; the visitor's own choice may do anything.
  if (!allowRise && !override && RANK[tier] < RANK[state.tier]) {
    tier = state.tier;
    reasons = [...state.reasons.filter((r) => r !== "held:no-rise"), "held:no-rise"];
  }
  apply({ tier, reasons, override, signals: state.signals });
}

function apply(next: CapabilityState): void {
  const changed = next.tier !== state.tier || next.override !== state.override;
  state = next;
  if (changed || document.documentElement.dataset.tier !== next.tier) {
    const root = document.documentElement;
    root.dataset.tier = next.tier;
    if (next.override) root.dataset.tierOverride = next.override; else delete root.dataset.tierOverride;
  }
  if (changed) window.dispatchEvent(new CustomEvent(CAPABILITY_EVENT, { detail: getCapability() }));
}
