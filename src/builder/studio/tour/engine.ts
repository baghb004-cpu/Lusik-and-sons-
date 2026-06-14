// ============================================================
// Virtual Tour — pure camera/projection math (§30, Phase 6)
// ============================================================
// Shared by the WebGL viewer (for placing hotspot overlays) and tested
// here. Convention matches the viewer's fragment shader: camera forward
// is -Z; yaw rotates around Y, pitch around X; no roll.
// ============================================================

export interface V3 { x: number; y: number; z: number }
const D2R = Math.PI / 180;

/** Unit direction a (yaw,pitch) in degrees points to (camera forward at uv=0). */
export function dirFromYawPitch(yawDeg: number, pitchDeg: number): V3 {
  const y = yawDeg * D2R, p = pitchDeg * D2R;
  return { x: -Math.cos(p) * Math.sin(y), y: Math.sin(p), z: -Math.cos(p) * Math.cos(y) };
}

const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a: V3): V3 => { const m = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / m, y: a.y / m, z: a.z / m }; };

export interface Projected { x: number; y: number; visible: boolean } // x,y in [-1,1], y up

/** Project a sphere direction to normalized screen coords for the current
 *  camera. visible=false when it's behind the camera or far off-screen. */
export function projectToScreen(dir: V3, camYawDeg: number, camPitchDeg: number, fovDeg: number, aspect: number): Projected {
  const f = dirFromYawPitch(camYawDeg, camPitchDeg);
  const r = norm(cross(f, { x: 0, y: 1, z: 0 }));
  const u = cross(r, f);
  const cz = dot(dir, f);
  if (cz <= 0.0001) return { x: 0, y: 0, visible: false };
  const t = Math.tan((fovDeg * D2R) / 2);
  const x = dot(dir, r) / cz / (t * aspect);
  const y = dot(dir, u) / cz / t;
  return { x, y, visible: Math.abs(x) <= 1.15 && Math.abs(y) <= 1.15 };
}

/** Clamp pitch to keep the camera from flipping at the poles. */
export const clampPitch = (p: number) => Math.max(-89, Math.min(89, p));
/** Wrap yaw to (-180, 180]. */
export const wrapYaw = (y: number) => { let v = ((y + 180) % 360 + 360) % 360 - 180; if (v === -180) v = 180; return v; };
