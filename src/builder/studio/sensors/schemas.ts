// ============================================================
// Creation Studio — Sensor Interaction data model (§30, Phase 7)
// ============================================================
// OPT-IN device motion (gyro/accelerometer/orientation) for websites
// and app screens. Motion is NEVER required — every profile ships with
// non-motion fallback controls and respects reduced-motion. No raw
// sensor data is stored or used for tracking.
// ============================================================

import { z } from "zod";

export const MOTION_EVENTS = ["tilt-left", "tilt-right", "tilt-up", "tilt-down", "shake", "motion-disabled", "reduced-motion", "permission-denied"] as const;
export const MOTION_ACTIONS = ["move-left", "move-right", "look-up", "look-down", "trigger-action", "show-manual-controls", "disable-motion", "use-touch"] as const;

export const motionRuleSchema = z.object({
  id: z.string().min(1),
  when: z.enum(MOTION_EVENTS),
  then: z.enum(MOTION_ACTIONS),
});
export type MotionRule = z.infer<typeof motionRuleSchema>;

export const sensorProfileSchema = z.object({
  schemaVersion: z.number().int().min(1).default(1),
  id: z.string().min(1),
  name: z.string().min(1).default("Motion profile"),
  enableGyro: z.boolean().default(true), // device orientation (tilt to look/move)
  enableAccel: z.boolean().default(false), // acceleration (shake)
  sensitivity: z.number().min(0.1).max(3).default(1),
  smoothing: z.number().min(0).max(0.95).default(0.6), // higher = smoother/laggier
  deadZone: z.number().min(0).max(0.5).default(0.05), // ignore tiny tilts
  invertX: z.boolean().default(false),
  invertY: z.boolean().default(false),
  shakeThreshold: z.number().min(5).max(40).default(16), // m/s^2 delta
  respectReducedMotion: z.boolean().default(true),
  rules: z.array(motionRuleSchema).default([]),
});
export type SensorProfile = z.infer<typeof sensorProfileSchema>;

export const SENSOR_DISCLOSURE =
  "This feature uses your device motion sensors to control the experience — for example, looking around by tilting your phone. Sensor data is used only while this screen is active and is not saved. You can turn motion off and use the on-screen controls instead.";
