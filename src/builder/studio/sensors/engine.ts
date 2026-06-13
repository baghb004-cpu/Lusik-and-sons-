// ============================================================
// Sensor Interaction — pure motion math (§30, Phase 7)
// ============================================================
// The deterministic core: turn raw device orientation into a clamped
// [-1,1] move vector (deadzone → sensitivity → invert → clamp),
// low-pass smoothing, and shake detection. Pure + tested; the runtime
// (and the generated module) just feed real sensor values in.
// ============================================================

import type { SensorProfile } from "./schemas.ts";

export interface Vec2 { x: number; y: number }
export interface Orientation { beta: number; gamma: number } // degrees: beta=front/back, gamma=left/right
export interface Accel { x: number; y: number; z: number }

const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));
const RANGE = 45; // degrees of tilt mapped to the full -1..1 range

function deadzone(v: number, dz: number): number {
  if (Math.abs(v) <= dz) return 0;
  // rescale so motion resumes smoothly just past the dead zone
  const sign = v < 0 ? -1 : 1;
  return sign * ((Math.abs(v) - dz) / (1 - dz));
}

/** Orientation → a clamped move vector per the profile. */
export function tiltToVector(o: Orientation, p: Pick<SensorProfile, "sensitivity" | "deadZone" | "invertX" | "invertY">): Vec2 {
  let x = clamp(o.gamma / RANGE);
  let y = clamp(o.beta / RANGE);
  x = deadzone(x, p.deadZone) * p.sensitivity;
  y = deadzone(y, p.deadZone) * p.sensitivity;
  if (p.invertX) x = -x;
  if (p.invertY) y = -y;
  return { x: clamp(x), y: clamp(y) };
}

/** Low-pass smoothing toward `next` (smoothing 0 = instant, →1 = very smooth). */
export function smooth(prev: Vec2, next: Vec2, smoothing: number): Vec2 {
  const s = Math.max(0, Math.min(0.95, smoothing));
  return { x: prev.x * s + next.x * (1 - s), y: prev.y * s + next.y * (1 - s) };
}

/** True when the acceleration change since last sample exceeds the threshold. */
export function detectShake(a: Accel, prev: Accel, threshold: number): boolean {
  const d = Math.sqrt((a.x - prev.x) ** 2 + (a.y - prev.y) ** 2 + (a.z - prev.z) ** 2);
  return d >= threshold;
}
