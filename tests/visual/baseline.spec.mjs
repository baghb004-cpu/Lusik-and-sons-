// ============================================================
// Visual-regression baselines — "nothing can break" evidence
// ============================================================
// One full-page screenshot per key page, per Playwright project
// (desktop + mobile). Reduced motion is forced and animations are
// disabled so the theater/DEPTH effects don't add noise. Backend
// Functions are stubbed the same way the e2e suite stubs them, so the
// pages render their normal, in-stock state without Netlify running.
//
// Cart and checkout are intentionally not here yet: they need a seeded
// bag, and the localStorage shape is owned by SiteProvider. Add them
// when a PR touches those pages (seed via the UI, not by hand-writing
// the storage shape).
// ============================================================
import { test, expect } from "@playwright/test";

const PAGES = [
  ["home", "/"],
  ["shop", "/shop"],
  ["category-blankets", "/shop/blankets"],
  ["pdp-alphabet-blanket", "/shop/blankets/armenian-alphabet-blanket"],
  ["pdp-full-alphabet-blanket", "/shop/blankets/full-alphabet-crib-blanket"],
  ["pdp-days-of-the-week", "/shop/bibs/days-of-the-week-bib-set"],
  ["pdp-custom-name-bib", "/shop/bibs/baby-bib"],
  ["journal-post", "/journal/armenian-alphabet-gift"],
  ["story", "/story"],
];

test.beforeEach(async ({ context, page }) => {
  // Pin the capability ladder to "full" so a baseline never depends on the
  // runner's core count, network or battery (the tier projects in the e2e
  // config exercise the other tiers on purpose).
  await context.addInitScript(() => { try { sessionStorage.setItem("lusik_tier_session_v1", "full"); } catch {} });
  // Freeze the wall clock. Product pages print concrete ship-by and
  // arrives-by dates from the lead-time engine, so a baseline captured
  // today would fail tomorrow. Time still flows from this instant, so
  // timers and transitions behave normally.
  await page.clock.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  // No Netlify Functions in the test server: answer the public reads
  // with quiet, in-stock defaults so every page renders its normal state.
  await page.route("**/.netlify/functions/**", (route) => {
    const url = route.request().url();
    if (url.includes("/inventory")) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    return route.fulfill({ status: 204, body: "" });
  });
});

// Full-page screenshots scroll the whole document, which wakes every
// lazy-loaded photo mid-capture and makes "two consecutive stable
// screenshots" impossible on the long, photo-heavy pages (the mobile
// /shop grid tripped this first). Walk the page once so every image
// has loaded, return to the top, then capture.
async function settle(page) {
  await page.evaluate(async () => {
    const step = Math.max(400, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
    window.scrollTo(0, 0);
  });
  // Bounded waits: a lazy image that never enters the viewport again,
  // or a page that keeps polling, must not hang the capture.
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map((img) => new Promise((r) => { img.onload = img.onerror = r; }))
      ),
      new Promise((r) => setTimeout(r, 5_000)),
    ])
  );
  await page.evaluate(() => document.fonts?.ready);
  // The stylesheet must have applied; otherwise a broken server would write
  // unstyled baselines in --update-snapshots mode without anyone noticing.
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg-page").trim()), { timeout: 10_000 }).not.toBe("");
}

for (const [name, path] of PAGES) {
  test(`baseline: ${name}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    await settle(page);
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  });
}
