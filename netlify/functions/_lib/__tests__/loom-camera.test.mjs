// ============================================================
// CAMERA POSES
// ============================================================
// The orbit itself needs three.js and a real camera, so it is exercised
// in the browser. What CAN be checked here is the pose table, and it is
// worth checking: a pose with a polar angle past 90 degrees puts the
// camera UNDER the table, which renders the blanket from beneath — a
// mistake that looks like a lighting bug and wastes an afternoon.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(here, "../../../../src/loom/core/camera.ts"), "utf8");

/** Pull the POSES literal out of the source without importing three. */
function poses() {
  const start = SRC.indexOf("export const POSES");
  assert.notEqual(start, -1, "POSES table not found — did it move or get renamed?");
  const end = SRC.indexOf("\n};", start);
  const body = SRC.slice(start, end);
  const out = {};
  for (const m of body.matchAll(/(\w+):\s*\{\s*target:\s*\[([^\]]+)\],\s*distance:\s*([\d.]+),\s*azimuth:\s*(-?[\d.]+),\s*polar:\s*([\d.]+)(?:,\s*fov:\s*([\d.]+))?/g)) {
    out[m[1]] = {
      target: m[2].split(",").map((n) => parseFloat(n)),
      distance: parseFloat(m[3]),
      azimuth: parseFloat(m[4]),
      polar: parseFloat(m[5]),
      fov: m[6] ? parseFloat(m[6]) : undefined,
    };
  }
  return out;
}

const POSES = poses();
const HALF_PI = Math.PI / 2;

test("the pose table parsed", () => {
  assert.ok(Object.keys(POSES).length >= 4, `only found ${Object.keys(POSES).join(", ")}`);
});

test("no pose puts the camera under the table", () => {
  for (const [name, pose] of Object.entries(POSES)) {
    assert.ok(pose.polar < HALF_PI, `${name}: polar ${pose.polar} is at or past horizontal — the camera would be below the cloth`);
    assert.ok(pose.polar > 0, `${name}: polar ${pose.polar} is degenerate (straight down the axis)`);
  }
});

test("every pose frames the piece from a sane distance", () => {
  // The blanket is about 2.2 units across. Closer than ~1.2 clips into it;
  // further than ~8 makes it a stamp in the middle of the canvas.
  for (const [name, pose] of Object.entries(POSES)) {
    assert.ok(pose.distance >= 1.2, `${name}: distance ${pose.distance} is inside the piece`);
    assert.ok(pose.distance <= 8, `${name}: distance ${pose.distance} is too far to read`);
  }
});

test("field of view stays in a photographic range", () => {
  for (const [name, pose] of Object.entries(POSES)) {
    if (pose.fov === undefined) continue;
    assert.ok(pose.fov >= 20 && pose.fov <= 55, `${name}: fov ${pose.fov} would distort the piece`);
  }
});

test("the default flat-lay pose looks down at the cloth, not across it", () => {
  // The product photos are a three-quarter top view; a near-horizontal
  // default would show the blanket edge-on.
  assert.ok(POSES.flat, "there is no `flat` pose");
  assert.ok(POSES.flat.polar < 1.0, `flat polar ${POSES.flat.polar} is too close to horizontal`);
});

test("the chart pose is nearly overhead", () => {
  assert.ok(POSES.chart.polar < 0.2, "the chart pose should look straight down");
});
