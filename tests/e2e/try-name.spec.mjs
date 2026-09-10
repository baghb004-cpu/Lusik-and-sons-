// ============================================================
// TRY A NAME — the doorway from a shop card to a configured piece
// ============================================================
// The field is only worth having if what you typed is waiting for you on
// the other side. This walks the whole path in a real browser: type into
// the card, submit, and assert the product page opened with the name
// already in its own box.
//
// It also holds the two things that would quietly break it: the field
// must appear on the two configurable products and NOT on the pieces
// whose Armenian IS the product, and the shared-design URL has to keep
// precedence over a name.
// ============================================================

import { test, expect } from "@playwright/test";

test.describe("Try a name", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
      "the throttled tier projects run their own suite");
  });

  test("the bib card carries an Armenian name into the bib's own box", async ({ page }) => {
    await page.goto("/shop/bibs");

    const field = page.locator("form[data-try-name]");
    // Five products live under bibs and only the Custom Name Bib takes a
    // typed name — the rest say the days of the week, the blessing, or
    // "I am Armenian", and there is nothing to type into those.
    await expect(field).toHaveCount(1);
    await expect(field).toHaveAttribute("data-try-name", "/shop/bibs/baby-bib");

    const input = field.locator("input");
    // Անի — the round trip through the query string is the point.
    await input.fill("Անի");
    await field.locator("button[type=submit]").click();

    await expect(page).toHaveURL(/\/shop\/bibs\/baby-bib/);
    await expect(page.locator('input[autocomplete="given-name"]').first()).toHaveValue("Անի");
    // The parameter is spent on arrival: it should not sit in the address
    // bar for someone who then configures a different name and shares it.
    expect(page.url()).not.toContain("name=");
  });

  test("the blanket card fills the blanket's first custom line", async ({ page }) => {
    await page.goto("/shop/blankets");

    const field = page.locator("form[data-try-name]");
    await expect(field).toHaveCount(1);
    await expect(field).toHaveAttribute("data-try-name", "/shop/blankets/armenian-alphabet-blanket");

    await field.locator("input").fill("ANI");
    await field.locator("button[type=submit]").click();

    await expect(page).toHaveURL(/armenian-alphabet-blanket/);
    await expect(page.locator('input[maxlength="6"]').first()).toHaveValue("ANI");
  });

  test("the submit stays disabled until there is a name to carry", async ({ page }) => {
    await page.goto("/shop/bibs");
    const field = page.locator("form[data-try-name]");
    const go = field.locator("button[type=submit]");
    await expect(go).toBeDisabled();
    await field.locator("input").fill("Ani");
    await expect(go).toBeEnabled();
    // Whitespace is not a name.
    await field.locator("input").fill("   ");
    await expect(go).toBeDisabled();
  });

  test("the field takes only what can be stitched, and only six of it", async ({ page }) => {
    await page.goto("/shop/bibs");
    const input = page.locator("form[data-try-name] input");
    await input.fill("Anahit Grigoryan");
    await expect(input).toHaveValue("Anahit");
    await input.fill("Ani123");
    await expect(input).toHaveValue("Ani");
  });

  test("a shared design keeps precedence over a name in the URL", async ({ page }) => {
    // ?d= carries a whole design — alphabet, layout, colours, and its own
    // name. Someone opening a shared design asked for that design, so a
    // stray ?name= must not overwrite the line it set.
    const shared = Buffer.from(JSON.stringify({ n1: "SHARED" })).toString("base64");
    await page.goto(`/shop/blankets/armenian-alphabet-blanket?d=${shared}&name=OTHER`);
    // Asserted on the PREVIEW rather than the text box, because on a
    // phone the configurator shows one step at a time and the box lives
    // in step 4. The preview describes the piece on both viewports, and
    // it is what the recipient of a shared design is actually looking at.
    await expect(page.getByRole("img", { name: /SHARED/ }).first()).toBeVisible();
    await expect(page.getByRole("img", { name: /OTHER/ })).toHaveCount(0);
  });

  test("no name field on the pieces whose Armenian is the product", async ({ page }) => {
    await page.goto("/shop/blankets/full-alphabet-crib-blanket");
    await expect(page.locator("form[data-try-name]")).toHaveCount(0);
    await page.goto("/shop/towels");
    await expect(page.locator("form[data-try-name]")).toHaveCount(0);
  });
});
