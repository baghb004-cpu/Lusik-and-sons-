// Photo Booth (§30, Phase 8): templates, composition layout, and the standalone
// offline-booth code generator (camera-first, no upload, no face recognition).
import { test } from "node:test";
import assert from "node:assert/strict";

import { boothProjectSchema, FILTER_CSS, FILTERS } from "../studio/photobooth/schemas.ts";
import { makeBoothPreset, BOOTH_PRESET_LIST } from "../studio/photobooth/presets.ts";
import { boothCanvas, photoSlots } from "../studio/photobooth/layout.ts";
import { generateBooth } from "../studio/photobooth/codegen.ts";

test("presets are schema-valid and slot counts match the layout", () => {
  for (const { key } of BOOTH_PRESET_LIST) {
    const p = makeBoothPreset(key, `t-${key}`);
    assert.ok(p, key);
    boothProjectSchema.parse(p);
  }
  assert.equal(photoSlots({ layout: "single", photoCount: 3 }), 1);
  assert.equal(photoSlots({ layout: "grid", photoCount: 2 }), 4);
  assert.equal(photoSlots({ layout: "strip", photoCount: 3 }), 3);
});

test("layout produces one cell per photo, inside the canvas, plus a footer", () => {
  for (const layout of ["single", "strip", "grid"] as const) {
    const cv = boothCanvas({ layout, photoCount: 3 });
    assert.equal(cv.cells.length, photoSlots({ layout, photoCount: 3 }));
    for (const c of cv.cells) {
      assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.w <= cv.width && c.y + c.h <= cv.height, `${layout} cell in bounds`);
    }
    assert.ok(cv.footer.y + cv.footer.h <= cv.height + 1);
  }
});

test("every filter has a CSS string", () => {
  for (const f of FILTERS) assert.ok(typeof FILTER_CSS[f] === "string" && FILTER_CSS[f].length > 0);
});

test("codegen emits an offline booth: camera-first, no upload, privacy-safe", () => {
  const p = makeBoothPreset("strip", "b1")!;
  const { files } = generateBooth(p);
  for (const f of ["photo-booth/index.html", "photo-booth/booth.js", "photo-booth/PRIVACY_NOTES.md", "photo-booth/README.md", "photo-booth/LICENSES.md"]) {
    assert.ok(files[f] !== undefined, `has ${f}`);
  }
  const js = files["photo-booth/booth.js"];
  assert.ok(js.includes("getUserMedia")); // asks for the camera
  assert.ok(js.includes("stopCamera") && js.includes("pagehide")); // stops when leaving
  assert.ok(!/fetch\(|XMLHttpRequest|https?:\/\//.test(js)); // no network / no CDN / no upload
  assert.ok(js.includes("toDataURL")); // local save only
  // privacy notice is shown in the page + documented
  assert.ok(files["photo-booth/index.html"].includes("only while this page is open"));
  assert.ok(/no face recognition/i.test(files["photo-booth/PRIVACY_NOTES.md"]));
  // deterministic
  assert.deepEqual(generateBooth(p).files, files);
});
