// ============================================================
// HOME v3 — the storyboarded scenes
// ============================================================
// Three scenes were added to the home feed. What is worth asserting is
// not that they render — a screenshot covers that — but the three things
// that would be wrong without anyone noticing:
//
//   * the row claims to be everything Lusik makes, so it has to BE
//     everything, and a card with no photograph is an empty grey box in
//     a row of real ones;
//   * the ordering steps quote real dates from the lead-time engine, and
//     a date that never arrives leaves the page saying nothing useful;
//   * every card has to actually go somewhere.
// ============================================================

import { test, expect } from "@playwright/test";

test.describe("Home v3 scenes", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
      "the throttled tier projects run their own suite");
    // A first visit: the mobile home collapses to the For You layout on a
    // return visit, and these scenes sit below either way.
  });

  test("the row shows every live piece, each with a photograph", async ({ page }) => {
    await page.goto("/");
    const heading = page.locator("#home-pieces-heading");
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();

    // The heading counts the pieces; the row must hold that many cards.
    const claimed = Number(((await heading.textContent()) ?? "").match(/\d+/)?.[0] ?? 0);
    expect(claimed, "the heading does not name a number").toBeGreaterThan(0);

    const cards = page.getByRole("button", { name: /open this product$/i });
    await expect(cards).toHaveCount(claimed);

    // Every card carries a real photograph. The Custom Name Bib has no
    // coverImage at all and rendered as an empty grey box until the
    // fallback in src/lib/productHeroImage.js was shared with this row.
    const sources = await cards.locator("img").evaluateAll((imgs) =>
      imgs.map((img) => ({ src: img.getAttribute("src"), loaded: img.naturalWidth > 0 })));
    expect(sources.length, "a card has no image element at all").toBe(claimed);
    for (const { src, loaded } of sources) {
      expect(src, "a card has an empty image").toBeTruthy();
      expect(loaded, `${src} did not load`).toBe(true);
    }
  });

  test("a piece card opens its product page", async ({ page }) => {
    await page.goto("/");
    const first = page.getByRole("button", { name: /open this product$/i }).first();
    await first.scrollIntoViewIfNeeded();
    await first.click();
    await expect(page).toHaveURL(/\/shop\/[^/]+\/[^/]+$/);
  });

  test("the ordering steps quote real dates once the page is live", async ({ page }) => {
    await page.goto("/");
    const heading = page.locator("#home-ordering-heading");
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();

    const steps = page.locator("#home-ordering-heading ~ ol > li");
    await expect(steps).toHaveCount(3);

    // The dates are computed after mount, never during render — the
    // routes are prerendered, so a date baked at build time would be
    // stale by the time anyone read it. Until then the copy is the
    // timeless version, which is why this polls rather than asserts once.
    await expect
      .poll(async () => (await steps.nth(2).textContent()) ?? "", { timeout: 15_000 })
      .toMatch(/\b[A-Z][a-z]{2}\s+\d{1,2}\b/);
  });

  test("the journal cards open a post", async ({ page }) => {
    await page.goto("/");
    const heading = page.locator("#home-journal-heading");
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();

    const cards = page.getByRole("button", { name: /^Read: /i });
    await expect(cards).toHaveCount(2);
    await cards.first().click();
    await expect(page).toHaveURL(/\/journal\/[^/]+$/);
  });

  test("the Explore cards still lead where the rest of the site expects", async ({ page }) => {
    // The scenes were added AFTER these on purpose. The smoke suite and
    // the mobile bottom nav both navigate through the Explore cards'
    // aria-labels, so this is the regression the new sections could
    // plausibly have caused.
    await page.goto("/");
    const shopCard = page.getByRole("button", { name: /^Shop — / });
    await expect(shopCard).toBeVisible();
    await shopCard.click();
    await expect(page).toHaveURL(/\/shop$/);
  });
});
