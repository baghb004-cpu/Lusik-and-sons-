// ============================================================
// ACCESSIBILITY — axe on every page the visual suite guards
// ============================================================
// Serious and critical violations fail the build. Minor and moderate
// ones are printed, not enforced: axe's lower tiers include advisory
// findings that a shop cannot always act on, and a gate nobody can pass
// gets switched off, which is worse than no gate.
//
// `color-contrast` is DISABLED here, and that is not a loophole. The
// contrast suite (tests/e2e/contrast.spec.mjs) walks every visible text
// node on ten routes, in BOTH themes on BOTH viewports, and scores the
// real composited colours against 7:1 for body text — a stricter bar
// than axe's 4.5:1, with the exemptions reasoned out one at a time in
// docs/design-system.md. Two contrast checkers that disagree would mean
// arguing with a tool instead of reading a page. One owner, and it is
// the stricter one.
//
// The page list is deliberately the same as the visual suite's: those
// are the pages a customer actually reaches.
// ============================================================

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = [
  ["home", "/"],
  ["shop", "/shop"],
  ["category-blankets", "/shop/blankets"],
  ["pdp-alphabet-blanket", "/shop/blankets/armenian-alphabet-blanket"],
  ["pdp-full-alphabet-blanket", "/shop/blankets/full-alphabet-crib-blanket"],
  ["pdp-days-of-the-week", "/shop/bibs/days-of-the-week-bib-set"],
  ["pdp-custom-name-bib", "/shop/bibs/baby-bib"],
  ["pdp-hye-em-yes", "/shop/bibs/hy-em-armenian-bib"],
  ["journal", "/journal"],
  ["journal-post", "/journal/armenian-alphabet-gift"],
  ["story", "/story"],
  ["faq", "/faq"],
  ["gallery", "/gallery"],
  ["welcome", "/welcome"],
  ["not-found", "/no-such-page"],
];

const BLOCKING = new Set(["serious", "critical"]);

// The @a11y tag is how CI runs this as its own job: `test:e2e` excludes
// it and `test:a11y` selects it, so thirty axe scans do not add eight
// minutes to the smoke suite's wall clock.
test.describe("accessibility @a11y", () => {
  test.beforeEach(async ({ context, page }, testInfo) => {
    test.skip(!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
      "the throttled tier projects run their own suite");
    // Same pins as the visual suite: a fixed tier, and the 3D stage on
    // its fallback so a canvas is not what axe is looking at.
    await context.addInitScript(() => { try { sessionStorage.setItem("lusik_tier_session_v1", "full"); } catch {} });
    await context.addInitScript(() => { try { sessionStorage.setItem("lusik_loom_session_v1", "low"); } catch {} });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/.netlify/functions/**", (route) => {
      const url = route.request().url();
      if (url.includes("/inventory")) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      return route.fulfill({ status: 204, body: "" });
    });
  });

  for (const [name, path] of PAGES) {
    test(`${name} has no serious or critical violations`, async ({ page }) => {
      await page.goto(path);
      // Client components mount after hydration; a scan that runs first
      // audits a server shell and passes for the wrong reason.
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await page.evaluate(() => document.fonts?.ready);

      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .disableRules(["color-contrast"])
        .analyze();

      const blocking = violations.filter((v) => BLOCKING.has(v.impact));
      if (violations.length) {
        // Everything found, so a moderate finding is visible in the log
        // even though it does not fail the run.
        console.log(`[a11y] ${name}: ` + violations
          .map((v) => `${v.impact}/${v.id} x${v.nodes.length}`)
          .join(", "));
      }
      expect(
        blocking.map((v) => `${v.id} (${v.impact}) — ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n    ")}`),
        `serious/critical axe violations on ${path}`
      ).toEqual([]);
    });
  }
});
