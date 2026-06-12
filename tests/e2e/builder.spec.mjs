// ============================================================
// Builder editor smoke (roadmap #11) — the click-through a human
// would do: sign in, open the demo page, edit through the
// generated form, watch the canvas follow, check the gates hold.
// Desktop-only (the editor is a desktop surface; the SITES it
// makes are what the mobile project tests).
// ============================================================
import { test, expect } from "@playwright/test";

const TOKEN = "e2e-builder-token-1234"; // matches playwright.config webServer env

test.describe("Baghdo's Workshop (builder editor)", () => {
  test.skip(({ isMobile }) => isMobile, "editor is a desktop surface");

  test("open → select → form edit → canvas updates → invalid edit held", async ({ page }) => {
    await page.goto(`/builder#token=${TOKEN}`);
    await expect(page.locator("h1", { hasText: "Baghdo’s Workshop" })).toBeVisible({ timeout: 30_000 });

    // dismiss the first-run tour if it appears (fresh storage)
    const skip = page.getByRole("button", { name: "Skip the tour" });
    if (await skip.isVisible().catch(() => false)) await skip.click();

    // open the demo page
    await page.getByText("welcome", { exact: false }).first().click();
    await expect(page.getByRole("heading", { name: "builder/pages/welcome.json" })).toBeVisible();

    // select the card block in the tree → the generated form appears
    await page.getByRole("button", { name: /card · Cards are blocks/ }).click();
    const title = page.getByLabel("Title (en)");
    await expect(title).toHaveValue("Cards are blocks");

    // edit through the form → the canvas follows
    await title.fill("Edited by the e2e spec");
    await expect(page.locator("main").getByRole("heading", { name: "Edited by the e2e spec" })).toBeVisible();

    // an invalid edit (blank required title) is HELD as a draft: inline
    // issue, form stays mounted, canvas keeps the last good value
    await title.fill("");
    await expect(page.locator("text=⚠")).toBeVisible();
    await expect(title).toBeVisible();
    await expect(page.locator("main").getByRole("heading", { name: "Edited by the e2e spec" })).toBeVisible();
    await title.fill("Cards are blocks"); // restore (nothing is saved to disk)
  });

  test("media library lists, the export/docs APIs refuse without auth", async ({ page, request }) => {
    // API walls hold without the bearer token
    for (const url of ["/api/builder/docs?dir=builder", "/api/builder/media", "/api/builder/export"]) {
      const res = await request.fetch(url, { method: url.includes("export") ? "POST" : "GET", data: {} });
      expect([401, 403]).toContain(res.status());
    }

    // and the media panel opens for an authorized session
    await page.goto(`/builder#token=${TOKEN}`);
    await expect(page.locator("h1", { hasText: "Baghdo’s Workshop" })).toBeVisible({ timeout: 30_000 });
    const skip = page.getByRole("button", { name: "Skip the tour" });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await page.getByRole("button", { name: "🖼 Media" }).click();
    await expect(page.getByText("Media library")).toBeVisible();
    await expect(page.getByText(/Drag photos here/)).toBeVisible();
  });
});
