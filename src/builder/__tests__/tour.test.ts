// Virtual Tour (§30, Phase 6): projection math, presets (incl. linked scenes),
// and the offline code generator (bundled WebGL viewer, no CDN/libraries).
import { test } from "node:test";
import assert from "node:assert/strict";

import { tourProjectSchema } from "../studio/tour/schemas.ts";
import { dirFromYawPitch, projectToScreen, wrapYaw, clampPitch } from "../studio/tour/engine.ts";
import { makeTourPreset, TOUR_PRESET_LIST } from "../studio/tour/presets.ts";
import { generateTour, inlineTourHtml } from "../studio/tour/codegen.ts";

test("projection: dead-ahead hotspot is centered + visible; behind is hidden", () => {
  const ahead = dirFromYawPitch(0, 0); // camera forward at yaw0/pitch0
  const p = projectToScreen(ahead, 0, 0, 75, 1.6);
  assert.ok(p.visible);
  assert.ok(Math.abs(p.x) < 1e-6 && Math.abs(p.y) < 1e-6); // dead center
  // a hotspot directly behind (yaw 180) is not visible
  assert.equal(projectToScreen(dirFromYawPitch(180, 0), 0, 0, 75, 1.6).visible, false);
  // a hotspot 20° off-center is visible and pushed to one side of the screen
  const side = projectToScreen(dirFromYawPitch(20, 0), 0, 0, 75, 1.6);
  assert.ok(side.visible && Math.abs(side.x) > 0.1 && Math.abs(side.y) < 1e-6);
});

test("yaw wraps and pitch clamps", () => {
  assert.equal(wrapYaw(190), -170);
  assert.equal(wrapYaw(-190), 170);
  assert.equal(clampPitch(120), 89);
  assert.equal(clampPitch(-120), -89);
});

test("presets are schema-valid; the two-scene tour links its scenes", () => {
  for (const { key } of TOUR_PRESET_LIST) tourProjectSchema.parse(makeTourPreset(key, `t-${key}`));
  const tour = makeTourPreset("tour", "t1")!;
  assert.equal(tour.scenes.length, 2);
  const link = tour.scenes[0].hotspots.find((h) => h.kind === "scene");
  assert.ok(link && link.targetSceneId === tour.scenes[1].id, "scene 1 links to scene 2");
});

test("codegen: standalone tour bundles a dependency-free WebGL viewer (no CDN)", () => {
  const t = makeTourPreset("single", "v1")!;
  const { files } = generateTour(t);
  for (const f of ["virtual-tour/index.html", "virtual-tour/viewer.js", "virtual-tour/README.md", "virtual-tour/LICENSES.md"]) assert.ok(files[f], `has ${f}`);
  const js = files["virtual-tour/viewer.js"];
  assert.ok(js.includes("createPanoViewer") && js.includes("getContext")); // a real WebGL viewer
  assert.ok(!/https?:\/\//.test(js) && !/three/i.test(js)); // no CDN, no Three.js
  assert.ok(files["virtual-tour/index.html"].includes('id="pano"'));
  assert.deepEqual(generateTour(t).files, files); // deterministic
});

test("inline preview HTML embeds the viewer + the media data URL", () => {
  const t = makeTourPreset("single", "v2")!;
  t.scenes[0].src = "pano.jpg";
  const html = inlineTourHtml(t, { "pano.jpg": "data:image/jpeg;base64,AAAA" });
  assert.ok(html.includes("createPanoViewer")); // viewer inlined
  assert.ok(html.includes("data:image/jpeg;base64,AAAA")); // media inlined
  assert.ok(!/src="viewer.js"/.test(html)); // self-contained
});
