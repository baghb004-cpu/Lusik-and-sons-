import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { themeSchema, type Theme } from "../schema/index.ts";
import { themeToCssVars, glassPresetToCss } from "../theme/css.ts";
import { checkContrast } from "../engine/index.ts";

const seed = (): Theme => {
  const raw = JSON.parse(readFileSync(join(process.cwd(), "builder", "theme.json"), "utf8"));
  const parsed = themeSchema.safeParse(raw);
  assert.equal(parsed.success, true, JSON.stringify(!parsed.success && parsed.error.issues));
  return (parsed as { success: true; data: Theme }).data;
};

test("the seeded theme.json validates and captures the live brand palette", () => {
  const theme = seed();
  assert.equal(theme.tokens.colors.ink, "#1A1612");
  assert.equal(theme.tokens.colors.cream, "#F5EFE3");
  assert.equal(theme.tokens.fonts.display.family, "Fraunces");
  assert.equal(theme.tokens.glass.length, 3);
  assert.deepEqual(theme.tokens.glass.map((g) => g.name), ["Liquid Glass", "Frosted", "Solid"]);
});

test("theme compiles to the --bt-* variables the renderer's tokenToCss emits", () => {
  const css = themeToCssVars(seed());
  assert.match(css, /^:root \{/);
  // The exact names renderer/style.ts produces for token refs:
  assert.match(css, /--bt-color-ink: #1A1612;/);
  assert.match(css, /--bt-spacing-md: 1rem;/);
  assert.match(css, /--bt-radius-pill: 999px;/);
  assert.match(css, /--bt-shadow-card: /);
  assert.match(css, /--bt-typeScale-display: clamp\(/);
  assert.match(css, /--bt-font-display: "Fraunces", Georgia, serif;/);
});

test("the seeded palette passes the readability guardrail it will enforce", () => {
  const { colors } = seed().tokens;
  assert.equal(checkContrast(colors.ink, colors.cream).passesAA, true);
  assert.equal(checkContrast(colors.cream, colors.ink).passesAA, true);
});

test("glass presets compile: Liquid Glass has lens + blur, Frosted no lens, Solid no blur", () => {
  const [liquid, frosted, solid] = seed().tokens.glass;

  const liquidCss = glassPresetToCss(liquid);
  assert.match(liquidCss.backdropFilter, /blur\(18px\)/);
  assert.match(liquidCss.boxShadow!, /inset 0 0 \d+px/); // the refraction rim

  const frostedCss = glassPresetToCss(frosted);
  assert.match(frostedCss.backdropFilter, /blur\(14px\)/);
  assert.ok(!/inset 0 0 \d+px/.test(frostedCss.boxShadow ?? ""), "Frosted must have no lens rim");

  const solidCss = glassPresetToCss(solid);
  assert.match(solidCss.backdropFilter, /blur\(0px\)/);
  // tintOpacity 1 × opacity 1 → fully opaque background
  assert.match(solidCss.background, /^#F5EFE3FF$/i);
});

test("glass tint opacity math: 8-digit hex alpha tracks the sliders", () => {
  const base = seed().tokens.glass[0];
  const half = glassPresetToCss({ ...base, tintColor: "#FFFFFF", tintOpacity: 0.5, opacity: 1 });
  assert.match(half.background, /^#FFFFFF80$/i);
  const none = glassPresetToCss({ ...base, tintColor: "#FFFFFF", tintOpacity: 0, opacity: 1 });
  assert.match(none.background, /^#FFFFFF00$/i);
});
