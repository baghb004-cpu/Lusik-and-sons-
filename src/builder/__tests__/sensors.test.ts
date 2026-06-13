// Sensor Interaction (§30, Phase 7): the pure motion math (deadzone/invert/
// sensitivity/smoothing/shake) + presets + codegen (permission, fallbacks,
// reduced-motion, no storage/upload).
import { test } from "node:test";
import assert from "node:assert/strict";

import { sensorProfileSchema } from "../studio/sensors/schemas.ts";
import { tiltToVector, smooth, detectShake } from "../studio/sensors/engine.ts";
import { makeSensorPreset, SENSOR_PRESET_LIST } from "../studio/sensors/presets.ts";
import { generateSensorModule } from "../studio/sensors/codegen.ts";

const base = { sensitivity: 1, deadZone: 0.05, invertX: false, invertY: false };

test("tiltToVector: deadzone, sensitivity, invert, clamp", () => {
  assert.deepEqual(tiltToVector({ beta: 0, gamma: 0 }, base), { x: 0, y: 0 });
  // a tiny tilt inside the dead zone reads as zero
  assert.equal(tiltToVector({ beta: 1, gamma: 1 }, base).x, 0);
  // full tilt clamps to ±1
  const full = tiltToVector({ beta: 90, gamma: 90 }, base);
  assert.equal(full.x, 1); assert.equal(full.y, 1);
  // invert flips sign
  const inv = tiltToVector({ beta: 45, gamma: 45 }, { ...base, invertX: true });
  assert.ok(inv.x < 0 && inv.y > 0);
  // sensitivity scales (then clamps)
  assert.ok(tiltToVector({ beta: 0, gamma: 20 }, { ...base, sensitivity: 2 }).x > tiltToVector({ beta: 0, gamma: 20 }, base).x);
});

test("smooth blends toward next; high smoothing moves less per step", () => {
  const a = smooth({ x: 0, y: 0 }, { x: 1, y: 1 }, 0.8);
  assert.ok(a.x > 0 && a.x < 0.5); // lags
  const b = smooth({ x: 0, y: 0 }, { x: 1, y: 1 }, 0);
  assert.equal(b.x, 1); // instant
});

test("detectShake fires only past the threshold", () => {
  assert.equal(detectShake({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 16), false);
  assert.equal(detectShake({ x: 20, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 16), true);
});

test("presets are schema-valid and always include non-motion fallbacks", () => {
  for (const { key } of SENSOR_PRESET_LIST) {
    const p = makeSensorPreset(key, `t-${key}`);
    assert.ok(p, key);
    sensorProfileSchema.parse(p);
    assert.ok(p!.rules.some((r) => r.then === "show-manual-controls"), "has manual fallback");
    assert.ok(p!.rules.some((r) => r.when === "permission-denied"), "handles denied permission");
  }
});

test("codegen: permission-gated, fallback controls, reduced-motion, no storage/upload", () => {
  const p = makeSensorPreset("look", "s1")!;
  const { files } = generateSensorModule(p);
  const js = files["sensor-module/sensors.js"];
  const html = files["sensor-module/index.html"];
  assert.ok(js.includes("requestPermission")); // iOS permission flow
  assert.ok(js.includes("prefers-reduced-motion")); // respected
  assert.ok(!/fetch\(|XMLHttpRequest|localStorage|https?:\/\//.test(js)); // no upload/storage/CDN
  assert.ok(html.includes('class="controls"')); // mandatory manual fallback present
  assert.ok(/no sensor data is stored/i.test(files["sensor-module/PRIVACY_NOTES.md"]));
  assert.deepEqual(generateSensorModule(p).files, files); // deterministic
});
