// ============================================================
// RENDERED-PAGE CONTRAST AUDIT
// ============================================================
// The token test next door proves the palette is sound. This one proves
// the pages actually USE it: it walks every visible text node on the key
// routes, in both atmospheres, resolves the real foreground and the real
// composited background from computed styles, and scores the pair.
//
// It is the layer that catches what a token test cannot — a component
// that hardcodes a hex. That is not hypothetical: this audit is how the
// desktop mega-menu was found rendering cream-on-cream in dark mode
// (background: #F5EFE3 hardcoded, items on var(--text-primary)), and how
// every bg-white input was found showing cream text on white.
//
// WHAT IT DELIBERATELY DOES NOT SCORE, and why each is principled rather
// than convenient:
//
//   * anything under aria-hidden — decoration that carries no information
//     (the alphabet marquee at opacity 0.14, the ■ color chips, which are
//     always followed by the color's name as real text)
//   * anything under role="img" — the blanket preview renders the chosen
//     THREAD on the chosen CLOTH, so its contrast is a truthful property
//     of the product; "correcting" it would misrepresent what ships
//   * text whose background stack includes a background-image — a photo or
//     gradient cannot be scored from computed styles alone. These are
//     counted and reported, not silently dropped, so the number cannot
//     quietly grow.
//   * the wordmark — WCAG exempts text that is part of a logo.
//
// Everything else is held to WCAG AA: 4.5:1, or 3:1 for large text
// (24px+, or 18.66px+ bold).
// ============================================================

import { test, expect } from "@playwright/test";

const ROUTES = [
  "/", "/shop", "/shop/blankets/armenian-alphabet-blanket",
  "/shop/blankets/full-alphabet-crib-blanket",
  "/cart", "/checkout", "/story", "/journal", "/faq", "/privacy",
];

// A seeded bag so /cart and /checkout render their real content —
// the money rows are exactly where a contrast slip costs the most.
const CART = JSON.stringify({
  at: Date.now(),
  items: [
    { id: "blanket-armenian-classic-310-321", name: "The Armenian Alphabet Blanket", price: 120, qty: 1 },
    { id: "bib-custom-name", name: "The Custom Name Bib", price: 28, qty: 2 },
  ],
});

// Runs in the page. Returns one row per distinct (color, background,
// size, weight) combination rather than per node, so a 40-row list
// reports once instead of forty times.
const COLLECT = () => {
  const rows = [];
  const seen = new Set();
  let unscoreable = 0;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = (node.textContent || "").trim();
    if (!text) continue;
    const el = node.parentElement;
    if (!el) continue;

    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const box = el.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) continue;

    // Walk up once for: exemptions, hidden ancestors, and the background stack.
    let exempt = null;
    let hasImage = false;
    let effectiveOpacity = 1;
    const layers = [];
    let p = el;
    let hidden = false;
    while (p) {
      const s = getComputedStyle(p);
      if (s.display === "none" || s.visibility === "hidden") { hidden = true; break; }
      effectiveOpacity *= parseFloat(s.opacity) || 0;
      if (p.getAttribute("aria-hidden") === "true") exempt = exempt || "aria-hidden";
      if (p.getAttribute("role") === "img") exempt = exempt || "role=img";
      if (p.dataset && p.dataset.contrastExempt) exempt = exempt || p.dataset.contrastExempt;
      if (s.backgroundImage && s.backgroundImage !== "none") hasImage = true;
      const bg = s.backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        layers.push(bg);
        const a = bg.startsWith("rgba") ? parseFloat(bg.slice(bg.lastIndexOf(",") + 1)) : 1;
        if (a >= 0.999) break;
      }
      p = p.parentElement;
    }
    if (hidden) continue;
    // Effectively invisible decoration (the marquee sits at 0.14).
    if (effectiveOpacity < 0.25) continue;
    if (exempt) continue;
    if (hasImage) { unscoreable += 1; continue; }

    const fontSize = parseFloat(cs.fontSize) || 16;
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const key = `${cs.color}|${layers.join("/")}|${Math.round(fontSize)}|${weight}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let where = el.tagName.toLowerCase();
    const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    if (cls) where += "." + cls;

    rows.push({ text: text.slice(0, 44), color: cs.color, layers, fontSize, weight, where });
  }
  return { rows, unscoreable };
};

// ---- WCAG maths, duplicated here because this string is evaluated in
// ---- the browser and cannot import from src/lib/contrast.js.
function parseColor(v) {
  const m = String(v).trim().match(/^rgba?\(([^)]+)\)$/);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
  if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) return null;
  return [parts[0], parts[1], parts[2], parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1];
}
function over([r, g, b, a], [br, bg, bb]) {
  return a >= 1 ? [r, g, b] : [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)];
}
function lum([r, g, b]) {
  const f = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(fg, bgSolid) {
  const l1 = lum(fg); const l2 = lum(bgSolid);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const GROUND = { light: [245, 239, 227], dark: [21, 17, 14] };

for (const theme of ["light", "dark"]) {
  test(`${theme} atmosphere: rendered text meets WCAG AA`, async ({ page }, testInfo) => {
    test.skip(!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
      "the throttled tier projects render the same DOM; no extra coverage");
    test.setTimeout(180_000);

    await page.addInitScript(([t, cart]) => {
      try {
        localStorage.setItem("lusik_theme_v1", t);
        localStorage.setItem("lusik_cart_v1", cart);
      } catch { /* private mode — the test still renders the light default */ }
    }, [theme, CART]);
    await page.route("**/.netlify/functions/**", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

    const failures = [];
    let skippedOverImages = 0;

    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      // The theme is applied by useTheme() after mount; assert it landed
      // rather than racing it, or a dark run silently audits light pixels.
      await expect
        .poll(() => page.evaluate(() => document.documentElement.getAttribute("data-theme") ?? "light"),
          { timeout: 15_000 })
        .toBe(theme === "dark" ? "dark" : "light");
      // Open the desktop mega-menu — it is a hover surface, so a plain page
      // scan never reaches it, which is how it stayed broken.
      await page.evaluate(() => document.querySelector(".shop-menu-trigger")?.focus());
      // Wait for the menu to SETTLE, not for a fixed 400ms. It fades in,
      // and on a loaded machine the fade was still running when the audit
      // read the pixels: a label measured mid-transition at 0.56 opacity
      // scored 4.31:1 against ink and failed a gate that its settled
      // colour passes comfortably. Contrast is a property of the design,
      // not of a frame of animation — and a fixed sleep racing a
      // transition is a flaky test, which is worse than a failing one.
      //
      // Scoped to the menu on purpose: the page also carries the alphabet
      // marquee, which loops forever, so waiting on all animations would
      // never return.
      await page.waitForFunction(() => {
        const menu = document.querySelector(".shop-menu");
        if (!menu) return true;
        return document.getAnimations().every((a) => {
          const target = a.effect && "target" in a.effect ? a.effect.target : null;
          return !(target && menu.contains(target) && a.playState === "running");
        });
      }, null, { timeout: 10_000 }).catch(() => { /* settled enough; the audit is next */ });
      await page.waitForTimeout(150);

      const { rows, unscoreable } = await page.evaluate(COLLECT);
      skippedOverImages += unscoreable;

      for (const row of rows) {
        const fg = parseColor(row.color);
        if (!fg) continue;
        let bg = GROUND[theme];
        for (let i = row.layers.length - 1; i >= 0; i--) {
          const layer = parseColor(row.layers[i]);
          if (layer) bg = over(layer, bg);
        }
        const value = ratio(over(fg, bg), bg);
        const large = row.fontSize >= 24 || (row.fontSize >= 18.66 && row.weight >= 700);
        const gate = large ? 3 : 4.5;
        if (value < gate) {
          failures.push(
            `${route}  ${row.where}  ${row.fontSize}px/${row.weight}  "${row.text}"\n` +
            `      ${row.color} on rgb(${bg.map(Math.round).join(",")}) = ${value.toFixed(2)}:1, needs ${gate}:1`
          );
        }
      }
    }

    // Reported, not hidden: text over photos and gradients cannot be scored
    // from computed styles. Each one needs a scrim and a human eye.
    testInfo.annotations.push({ type: "unscoreable", description: `${skippedOverImages} text styles sit on a background image` });

    expect(failures, `${failures.length} contrast failures in the ${theme} atmosphere:\n${failures.join("\n")}`).toEqual([]);
  });
}
