// ============================================================
// /welcome and the 404
// ============================================================
// Two pages nothing on the site links to, which is exactly why they are
// worth a test: /welcome is reached by typing a URL from a printed card,
// and the 404 is reached by getting one wrong. Neither would be noticed
// broken.
//
// The welcome page's job is to answer, for someone standing there
// holding the card: how do I order, and how long does it take. So that
// is what this asserts, rather than that the page merely rendered.
// ============================================================

import { test, expect } from "@playwright/test";

test.describe("/welcome", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
      "the throttled tier projects run their own suite");
  });

  test("answers how to order: phone, this website, Instagram", async ({ page }) => {
    await page.goto("/welcome");
    await expect(page.getByRole("heading", { name: /Thank you for taking a card/i })).toBeVisible();

    // The owner's rule is that all three ways stay on the page.
    await expect(page.locator('a[href^="tel:"]').first()).toBeVisible();
    await expect(page.locator('a[href*="instagram"]').first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Order on this website/i })).toBeVisible();
  });

  test("says colors vary and quotes real lead times", async ({ page }) => {
    await page.goto("/welcome");
    await expect(page.getByText(/Colors may vary/i)).toBeVisible();
    // Read from CONFIG.LEAD_TIMES, so these are the numbers the shop is
    // actually working to and the same ones the brochure prints.
    await expect(page.getByText("about 2 to 3 weeks")).toBeVisible();
    await expect(page.getByText("about 10 to 12 weeks")).toBeVisible();
  });

  test("no prices, and no explanation of why a piece takes as long as it does", async ({ page }) => {
    await page.goto("/welcome");
    const text = (await page.locator("main").innerText()).toLowerCase();
    // The owner's two standing rules for anything that goes out on paper.
    expect(text).not.toMatch(/\$\d/);
    expect(text).not.toMatch(/second job|day job|evenings|after work|spare time/);
  });

  test("the coupon panel leads to the shop", async ({ page }) => {
    await page.goto("/welcome");
    await page.getByRole("button", { name: /Start with the shop/i }).click();
    await expect(page).toHaveURL(/\/shop$/);
  });

  test("the photo link opens a mail draft with a subject already in it", async ({ page }) => {
    await page.goto("/welcome");
    const href = await page.locator('a[href^="mailto:"]').first().getAttribute("href");
    expect(href).toContain("hello@lusikandsons.com");
    expect(href).toContain("subject=");
  });
});

test.describe("the 404", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
      "the throttled tier projects run their own suite");
  });

  test("shows a stitched swatch and two ways back", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /wandered off/i })).toBeVisible();
    // The swatch the Loom stitched, not a stock illustration.
    await expect(page.locator('img[src="/img/loom/not-found.webp"]')).toBeVisible();
    await expect(page.getByRole("link", { name: /Back home/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Browse the shop/i })).toBeVisible();
  });
});
