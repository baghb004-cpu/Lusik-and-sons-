// ============================================================
// Sensor Interaction — preset profiles (pure data)
// ============================================================
import { sensorProfileSchema, type SensorProfile, type MotionRule } from "./schemas.ts";

const R = (id: string, when: MotionRule["when"], then: MotionRule["then"]): MotionRule => ({ id, when, then });

// Fallbacks every profile carries — motion is never required.
const FALLBACKS: MotionRule[] = [
  R("f1", "motion-disabled", "show-manual-controls"),
  R("f2", "reduced-motion", "disable-motion"),
  R("f3", "permission-denied", "use-touch"),
];

interface Spec { key: string; name: string; patch: Partial<SensorProfile>; rules: MotionRule[] }

const SPECS: Spec[] = [
  { key: "look", name: "360 viewer — tilt to look", patch: { enableGyro: true, enableAccel: false, sensitivity: 1, smoothing: 0.7 }, rules: [R("l1", "tilt-left", "look-up"), R("l2", "tilt-right", "look-up")] },
  { key: "rotate", name: "Product — tilt to rotate", patch: { enableGyro: true, sensitivity: 1.2, smoothing: 0.6 }, rules: [R("r1", "tilt-left", "move-left"), R("r2", "tilt-right", "move-right")] },
  { key: "move", name: "Mini game — tilt to move", patch: { enableGyro: true, sensitivity: 1.5, smoothing: 0.4, deadZone: 0.08 }, rules: [R("m1", "tilt-left", "move-left"), R("m2", "tilt-right", "move-right")] },
  { key: "shake", name: "Shake to start", patch: { enableGyro: false, enableAccel: true, shakeThreshold: 16 }, rules: [R("s1", "shake", "trigger-action")] },
  { key: "parallax", name: "Subtle parallax (hero)", patch: { enableGyro: true, sensitivity: 0.4, smoothing: 0.85, deadZone: 0.02 }, rules: [R("p1", "tilt-left", "move-left"), R("p2", "tilt-right", "move-right")] },
];

export function makeSensorPreset(key: string, id = `sensor-${Date.now()}`): SensorProfile | null {
  const spec = SPECS.find((s) => s.key === key);
  if (!spec) return null;
  return sensorProfileSchema.parse({ id, name: spec.name, ...spec.patch, rules: [...spec.rules, ...FALLBACKS] });
}

export const SENSOR_PRESET_LIST = SPECS.map((s) => ({ key: s.key, name: s.name }));
