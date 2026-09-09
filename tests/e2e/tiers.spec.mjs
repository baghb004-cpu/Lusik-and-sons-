// ============================================================
// Capability-ladder tests — the "lean" and "core" tiers really work
// ============================================================
// Runs ONLY in the lean-3g and core-2g Playwright projects (see
// playwright.config.mjs). The smoke suite covers the full tier.
//
//   lean-3g  Pixel-class phone, Chrome DevTools "Slow 3G" throttling and
//            a 4x slower CPU via CDP, tier pinned with ?tier=lean. Asserts
//            the page is usable, the tier is published, the decorative
//            motion is off, and the choice survives navigation.
//   core-2g  JavaScript disabled. Asserts the server-rendered pages still
//            let a visitor browse, read a product, and find the phone
//            number, and that the configurator pages show the no-script
//            note instead of a blank box.
// ============================================================
import { test, expect } from "@playwright/test";

// Server-rendered content is visible long before the JavaScript has
// finished arriving over a throttled link; anything that depends on
// hydration (the tier attribute, the toggle) gets this longer budget.
const HYDRATION_MS = 60_000;
const SLOW_3G = { offline: false, latency: 400, downloadThroughput: (500 * 1024) / 8, uploadThroughput: (500 * 1024) / 8 };

test.beforeEach(async ({ context, page }) => {
  await context.addInitScript(() => { try { localStorage.setItem("lusik_lang_v1", "en"); } catch {} });
  // No Netlify Functions behind the test server.
  await page.route("**/.netlify/functions/**", (route) => {
    const url = route.request().url();
    if (url.includes("/inventory")) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    return route.fulfill({ status: 204, body: "" });
  });
});

test.describe("lean tier (Slow 3G, 4x CPU)", () => {
  test.beforeEach(async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "lean-3g", "lean-3g project only");
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", SLOW_3G);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  });

  test("home is usable, the tier is published, and decorative motion is off", async ({ page }) => {
    const bytes = { total: 0 };
    page.on("response", async (r) => { try { const b = await r.body(); bytes.total += b.length; } catch {} });
    await page.goto("/?tier=lean", { waitUntil: "domcontentloaded" });
    // Liveness on the phone layout: the mobile For You page hides the brand
    // hero (and its "See what Lusik makes" CTA) and leads with the "Selected
    // for you" product card, the same signal the smoke suite uses on mobile.
    await expect(page.getByRole("button", { name: /selected for you/i }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("html")).toHaveAttribute("data-tier", "lean", { timeout: HYDRATION_MS });
    await expect(page.locator("html")).toHaveAttribute("data-tier-override", "lean");
    // The theater rise-in and the marquee are CSS animations; lean turns them off.
    const rise = page.locator(".vt-rise").first();
    await expect(rise).toBeVisible();
    await expect.poll(() => rise.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    console.log(`[lean-3g] home transferred ~${Math.round(bytes.total / 1024)} KB`);
  });

  test("the lean choice follows the visitor to the next page", async ({ page }) => {
    await page.goto("/?tier=lean", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-tier", "lean", { timeout: HYDRATION_MS });
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-tier", "lean", { timeout: HYDRATION_MS });
    // ?tier=full releases the pin for the tab.
    await page.goto("/shop?tier=full", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-tier", "full", { timeout: HYDRATION_MS });
  });

  test("the footer toggle persists a lighter-version choice", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 }); // the footer is desktop-only
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-tier", /full|lean|core/, { timeout: HYDRATION_MS });
    const toggle = page.locator("[data-tier-toggle] input[type=checkbox]").first();
    await toggle.scrollIntoViewIfNeeded();
    if (!(await toggle.isChecked())) await toggle.check();
    await expect(page.locator("html")).toHaveAttribute("data-tier", "lean", { timeout: HYDRATION_MS });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-tier", "lean", { timeout: HYDRATION_MS });
    await expect(page.locator("[data-tier-toggle] input[type=checkbox]").first()).toBeChecked();
  });
});

test.describe("core tier (JavaScript off)", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "core-2g", "core-2g project only");
  });

  test("home renders server-side with the brand, the shop path and the phone number", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Lusik/).first()).toBeVisible();
    await expect(page.getByText(/See what Lusik makes/i).first()).toBeVisible();
    await expect(page.getByText("(760) 874-2333").first()).toBeVisible();
  });

  test("shop and category pages list the products without scripts", async ({ page }) => {
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Blankets/).first()).toBeVisible();
    await page.goto("/shop/blankets", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("The Armenian Alphabet Blanket").first()).toBeVisible();
    await expect(page.getByText("The Full Alphabet Crib Blanket").first()).toBeVisible();
  });

  test("a configurator product page shows the product and the no-script note", async ({ page }) => {
    await page.goto("/shop/blankets/armenian-alphabet-blanket", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("The Armenian Alphabet Blanket").first()).toBeVisible();
    const note = page.locator("[data-noscript-note]");
    await expect(note).toBeVisible();
    await expect(note).toContainText("(760) 874-2333");
    await expect(note).toContainText("hello@lusikandsons.com");
  });
});
