// ============================================================
// THE THREE-QUESTION CHOOSER
// ============================================================
// The rules are unit tested. What only a browser can answer is whether
// the thing a customer actually taps produces the recommendation the
// rules chose, and whether the honest parts survive the UI:
//
//   * a deadline REMOVES what cannot be finished in time, and the
//     customer is told how many pieces that was rather than left to
//     wonder why the shop looks small;
//   * asking for English never surfaces a piece that cannot carry it;
//   * the recommendation goes somewhere.
// ============================================================

import { test, expect } from "@playwright/test";

// The shop page renders the chooser twice — once in the mobile column,
// once in the desktop one, both in the DOM and switched by CSS. Scope
// every query to the copy that is actually visible.
function chooser(page) {
  return page.locator("section").filter({ hasText: "Three questions, one answer" })
    .locator("visible=true").first();
}

const pick = (root, name) => root.getByRole("button", { name, exact: true });

test.describe("Product chooser", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
      "the throttled tier projects run their own suite");
    await page.goto("/shop");
  });

  test("nothing is recommended until all three are answered", async ({ page }) => {
    const root = chooser(page);
    await root.scrollIntoViewIfNeeded();
    await expect(root.getByText("Lusik would make you")).toHaveCount(0);

    await pick(root, "A keepsake").click();
    await pick(root, "No rush").click();
    await expect(root.getByText("Lusik would make you")).toHaveCount(0);

    await pick(root, "Armenian").click();
    await expect(root.getByText("Lusik would make you")).toBeVisible();
  });

  test("a one-month deadline never recommends a ten-week blanket", async ({ page }) => {
    const root = chooser(page);
    await root.scrollIntoViewIfNeeded();
    await pick(root, "A keepsake").click();
    await pick(root, "Within a month").click();
    await pick(root, "Either is fine").click();

    await expect(root.getByText("Lusik would make you")).toBeVisible();
    // The crib blanket is ten to twelve weeks. Offering it here would be
    // a missed christening, not a soft mismatch.
    await expect(root.getByText("The Full Alphabet Crib Blanket")).toHaveCount(0);
    // And the customer is TOLD that pieces were held back, so they can
    // move their date rather than assume the shop is this small.
    await expect(root.getByText(/take longer than that/i)).toBeVisible();
  });

  test("asking for English never offers a piece that cannot carry it", async ({ page }) => {
    const root = chooser(page);
    await root.scrollIntoViewIfNeeded();
    await pick(root, "Everyday use").click();
    await pick(root, "No rush").click();
    await pick(root, "English").click();

    const result = root.locator('[aria-live="polite"]');
    await expect(result).toBeVisible();
    // The Armenian IS the product on these — the days of the week, the
    // blessing, "I am Armenian" — so none of them can be worked in
    // English and none may be offered for one.
    for (const armenianOnly of [
      "Days-of-the-Week", "Hye Em Yes", "Anushig", "Bari Akhorzhak",
    ]) {
      await expect(result.getByText(armenianOnly)).toHaveCount(0);
    }
  });

  test("an answer can be taken back", async ({ page }) => {
    const root = chooser(page);
    await root.scrollIntoViewIfNeeded();
    await pick(root, "A keepsake").click();
    await pick(root, "No rush").click();
    await pick(root, "Armenian").click();
    await expect(root.getByText("Lusik would make you")).toBeVisible();

    // Tapping the chosen answer again clears it. Nothing here is a
    // funnel: a customer who mis-tapped should not have to reload.
    await pick(root, "A keepsake").click();
    await expect(root.getByText("Lusik would make you")).toHaveCount(0);
  });

  test("the recommendation opens the product", async ({ page }) => {
    const root = chooser(page);
    await root.scrollIntoViewIfNeeded();
    await pick(root, "Everyday use").click();
    await pick(root, "Within a month").click();
    await pick(root, "Either is fine").click();

    await root.getByRole("button", { name: /open this product$/i }).first().click();
    await expect(page).toHaveURL(/\/shop\/[^/]+\/[^/]+$/);
  });
});
