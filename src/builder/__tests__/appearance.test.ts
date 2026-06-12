// Day / Night / Candlelight (plan §19) — schema, the derived Night
// palette, the compiled CSS contract, the inline scripts' promises,
// the switcher block, i18n labels, and the SwiftUI dark-mode output.
import { test } from "node:test";
import assert from "node:assert/strict";

import { themeSchema, appearanceSchema, blockSchema, type Block, type Theme } from "../schema/index.ts";
import {
  deriveDarkColors,
  nightPalette,
  appearanceCss,
  appearanceTailwindColors,
  hexToRgbChannels,
  APPEARANCE_STORAGE_KEY,
} from "../theme/appearance.ts";
import {
  appearanceBootstrap,
  appearanceSwitcherScript,
  appearanceSwitcherCss,
  appearanceDomId,
  CANDLE_DEFAULTS,
} from "../renderer/appearanceScript.ts";
import { assembleHtmlDocument } from "../export/static.ts";
import { localizeBlocks } from "../i18n/index.ts";
import { themeSwift } from "../export/swiftui.ts";
import { makePage, makeMobileLayer } from "./fixtures.ts";

const COLORS = { ink: "#1A1612", cream: "#F5EFE3", accent: "#B08842", muted: "#6B655D" };

function makeTheme(appearance?: unknown): Theme {
  return themeSchema.parse({
    tokens: {
      colors: COLORS,
      fonts: { display: { family: "Fraunces", fallback: "serif" }, body: { family: "DM Sans", fallback: "sans-serif" } },
      typeScale: {},
      spacing: {},
      radii: {},
      shadows: {},
      glass: [],
    },
    ...(appearance ? { appearance } : {}),
  });
}

// ── schema ──────────────────────────────────────────────────
test("appearance schema: defaults fill in; times are HH:MM-gated; themes without it still parse", () => {
  const a = appearanceSchema.parse({});
  assert.equal(a.enabled, false);
  assert.equal(a.candlelight.warmth, 45);
  assert.equal(a.candlelight.start, "21:00");
  assert.equal(appearanceSchema.safeParse({ candlelight: { warmth: 45, dim: 8, scheduled: true, start: "25:00", end: "07:00" } }).success, false);
  assert.equal(appearanceSchema.safeParse({ darkColors: { ink: "not-a-hex" } }).success, false);
  assert.ok(makeTheme()); // backward compat: appearance is optional
});

// ── the derived Night palette ───────────────────────────────
test("deriveDarkColors flips lightness, keeps a complete palette; explicit overrides win", () => {
  const dark = deriveDarkColors(COLORS);
  assert.deepEqual(Object.keys(dark).sort(), Object.keys(COLORS).sort());
  // dark ink (a near-black) must become light, cream must become dark
  const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
  assert.ok(lum(dark.ink) > lum(COLORS.ink) + 200, `night ink should lighten (got ${dark.ink})`);
  assert.ok(lum(dark.cream) < lum(COLORS.cream) - 200, `night cream should darken (got ${dark.cream})`);

  const theme = makeTheme({ enabled: true, darkColors: { accent: "#FFAA00" } });
  const night = nightPalette(theme);
  assert.equal(night.accent, "#FFAA00"); // explicit wins
  assert.notEqual(night.ink, COLORS.ink); // the rest derive
});

// ── compiled CSS ────────────────────────────────────────────
test("appearanceCss: explicit-choice override + zero-JS OS auto path + candle layers; off = empty", () => {
  assert.equal(appearanceCss(makeTheme()), "");
  assert.equal(appearanceCss(makeTheme({ enabled: false })), "");
  const css = appearanceCss(makeTheme({ enabled: true }));
  assert.match(css, /:root\[data-bt-mode="dark"\]/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)/); // auto dark: pure CSS, no JS
  assert.match(css, /:not\(\[data-bt-mode="light"\]\)/); // explicit Day beats OS dark
  assert.match(css, /data-bt-candle="1"\]::after/);
  assert.match(css, /mix-blend-mode: multiply/);
  assert.match(css, /pointer-events: none/);
  assert.match(css, /--bt-candle-a/); // visitor warmth rides one variable
});

test("appearanceTailwindColors: every brand color + white resolve via rgb var channels with alpha support", () => {
  const tw = appearanceTailwindColors(makeTheme({ enabled: true }));
  assert.equal(tw.ink, `rgb(var(--bt-rgb-ink, ${hexToRgbChannels("#1A1612")}) / <alpha-value>)`);
  assert.match(tw.white, /--bt-rgb-white, 255 255 255/);
  assert.equal(hexToRgbChannels("#FFFFFF"), "255 255 255");
});

// ── the inline scripts ──────────────────────────────────────
test("bootstrap: idempotent core, storage-keyed, schedule + until-morning logic, no eval", () => {
  const js = appearanceBootstrap({ warmth: 60, dim: 10, scheduled: true, start: "21:30", end: "06:45" });
  assert.match(js, /if\(window\.__btA\)return;/); // bootstrap + switcher never double-run
  assert.ok(js.includes(JSON.stringify(APPEARANCE_STORAGE_KEY)));
  assert.ok(js.includes('"start":1290') && js.includes('"end":405'), "HH:MM compiled to minutes");
  assert.match(js, /candleOn/); // manual ON until morning
  assert.match(js, /candleOff/); // manual OFF snoozes until morning
  assert.ok(!/\beval\(|new Function/.test(js));
});

test("switcher script: embeds the guarded core and wires buttons by data attributes", () => {
  const js = appearanceSwitcherScript("b_app00000001", CANDLE_DEFAULTS);
  assert.ok(js.includes(`getElementById("ap_b_app00000001")`));
  assert.equal(appearanceDomId("b_app00000001"), "ap_b_app00000001");
  assert.match(js, /el\.hidden=false/); // progressive: hidden without JS
  assert.match(js, /data-ap-mode/);
  assert.match(js, /data-ap-candle/);
  assert.match(js, /data-ap-warmth/);
});

test("switcher CSS: the [hidden] guard holds and pressed state uses the theme accent", () => {
  const css = appearanceSwitcherCss("b_app00000001");
  assert.match(css, /#ap_b_app00000001\[hidden\]\{display:none !important;\}/);
  assert.match(css, /\[aria-pressed="true"\]\{background:var\(--bt-color-accent, #B08842\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

// ── block schema + i18n ─────────────────────────────────────
test("appearanceSwitcher block: validates, strict, labels translatable + localizable", () => {
  const ok = (props: unknown) => blockSchema.safeParse({ id: "b_app00000001", type: "appearanceSwitcher", props });
  assert.equal(ok({}).success, true);
  assert.equal(ok({ style: "icons", showCandle: false }).success, true);
  assert.equal(ok({ style: "toggle" }).success, false);
  assert.equal(ok({ theme: "dark" }).success, false); // strict
  assert.equal(ok({ darkLabel: { _i18n: { en: "Night", hy: "Գիշեր" } } }).success, true);

  const blocks: Block[] = [
    { id: "b_app00000001", type: "appearanceSwitcher", props: { darkLabel: { _i18n: { en: "Night", hy: "Գիշեր" } } } },
  ];
  assert.equal((localizeBlocks(blocks, "hy", "en")[0].props as { darkLabel: string }).darkLabel, "Գիշեր");
});

// ── document assembly ───────────────────────────────────────
test("assembleHtmlDocument: appearance adds the head bootstrap + CSS; omitted stays script-free", () => {
  const base = {
    page: makePage(),
    bodyHtml: "<section>hi</section>",
    layers: [makeMobileLayer()],
    theme: null,
    stylesheetHref: "styles.css",
    siteName: "Lusik & Sons",
  };
  const plain = assembleHtmlDocument(base);
  assert.ok(!plain.includes("<script"), "no appearance → still zero JS");
  const theme = makeTheme({ enabled: true });
  const withA = assembleHtmlDocument({ ...base, appearance: { css: appearanceCss(theme), bootstrap: appearanceBootstrap(theme.appearance!.candlelight) } });
  assert.match(withA, /<script>\(function\(\)\{\nif\(window\.__btA\)return;/);
  assert.match(withA, /prefers-color-scheme: dark/);
  // bootstrap sits in <head>, before <body> — anti-flash
  assert.ok(withA.indexOf("window.__btA") < withA.indexOf("<body"));
});

// ── SwiftUI ─────────────────────────────────────────────────
test("swiftui Theme: appearance on → dynamic light/dark colors; off → plain colors", () => {
  const off = themeSwift(makeTheme());
  assert.ok(!off.includes("userInterfaceStyle"));
  const on = themeSwift(makeTheme({ enabled: true, darkColors: { accent: "#C49A52" } }));
  assert.match(on, /userInterfaceStyle == \.dark/);
  assert.match(on, /static func adaptive/);
  assert.match(on, /import UIKit/);
});
