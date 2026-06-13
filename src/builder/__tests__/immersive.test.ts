// Immersive Builder (§30, Phase 2): presets, the vibe parser, the performance
// score, and accessible/progressively-enhanced code generation. Pure + local.
import { test } from "node:test";
import assert from "node:assert/strict";

import { scrollProjectSchema, SCROLL_KINDS } from "../studio/immersive/schemas.ts";
import { makeScrollPreset, SCROLL_PRESET_LIST } from "../studio/immersive/presets.ts";
import { vibeScroll, detectScrollKind } from "../studio/immersive/vibe.ts";
import { scorePerformance } from "../studio/immersive/performance.ts";
import { generateScrollSite } from "../studio/immersive/codegen.ts";

test("every kind has a schema-valid preset with sections", () => {
  for (const k of SCROLL_KINDS) {
    const p = makeScrollPreset(k, `t-${k}`);
    assert.ok(p, `preset ${k}`);
    scrollProjectSchema.parse(p);
    assert.ok(p!.sections.length >= 2);
  }
  assert.equal(SCROLL_PRESET_LIST.length, SCROLL_KINDS.length);
});

test("vibe builds from a description and tweaks an existing project", () => {
  const r = vibeScroll("Make a cinematic homepage for a boutique");
  assert.ok(r.project.sections.length > 0);
  assert.equal(detectScrollKind("a 3D restaurant homepage"), "restaurant");
  assert.equal(detectScrollKind("my portfolio site"), "portfolio");

  const base = makeScrollPreset("product-reveal", "g1")!;
  const before = base.sections.length;
  const t = vibeScroll("make it less heavy and add a call to action", base);
  assert.equal(t.project.id, "g1");
  assert.equal(t.project.quality, "lightweight");
  assert.ok(t.project.sections.length > before); // CTA added
});

test("performance score rewards lighter pages and warns on heavy ones", () => {
  const light = makeScrollPreset("portfolio", "l")!;
  light.quality = "lightweight";
  const heavy = makeScrollPreset("restaurant", "h")!;
  heavy.quality = "desktop";
  for (const s of heavy.sections) s.animation = "parallax";
  assert.ok(scorePerformance(light).score > scorePerformance(heavy).score);
  assert.ok(scorePerformance(heavy).warnings.length > 0);
  assert.ok(["great", "okay", "heavy"].includes(scorePerformance(light).grade));
});

test("codegen emits an accessible, progressively-enhanced, offline page", () => {
  const p = vibeScroll("Make a 3D product reveal where products appear as people scroll").project;
  const { files } = generateScrollSite(p);
  for (const f of ["scroll-site/index.html", "scroll-site/styles.css", "scroll-site/scroll.js", "scroll-site/README.md", "scroll-site/ACCESSIBILITY_NOTES.md", "scroll-site/PERFORMANCE_NOTES.md"]) {
    assert.ok(files[f] !== undefined, `has ${f}`);
  }
  const html = files["scroll-site/index.html"];
  // content is real HTML (works without JS) + no external/CDN scripts
  assert.ok(/<h2>/.test(html) || /<section/.test(html));
  assert.ok(!/https?:\/\//.test(files["scroll-site/scroll.js"])); // no CDN
  assert.ok(html.includes('loading="lazy"') || !html.includes("<img")); // images lazy-load when present
  // CSS hides reveals ONLY under html.js (progressive enhancement) + honors reduced motion
  const css = files["scroll-site/styles.css"];
  assert.ok(css.includes("html.js .reveal"));
  assert.ok(css.includes("prefers-reduced-motion"));
  // JS uses IntersectionObserver and bails for reduced motion
  const js = files["scroll-site/scroll.js"];
  assert.ok(js.includes("IntersectionObserver") && js.includes("prefers-reduced-motion"));
  // deterministic
  assert.deepEqual(generateScrollSite(p).files, files);
});

test("config round-trips through the schema", () => {
  const p = makeScrollPreset("brand-story", "rt")!;
  const json = generateScrollSite(p).files["scroll-site/app_config.json"];
  scrollProjectSchema.parse(JSON.parse(json));
});
