// ============================================================
// REVIEWS — the page, the product block, the wall
// ============================================================
// The consent behaviour is the part worth a browser test. Everything
// else about reviews is enforced server-side and covered by the unit
// suite; what only a browser can show is that the file picker does not
// exist until somebody has said yes, and that ticking the box back off
// throws away what was picked.
//
// A file picker that reads a photograph of somebody's child and then
// asks permission has already read it.
// ============================================================

import { test, expect } from "@playwright/test";

const ORDER = "11111111-2222-4333-8444-555555555555";
const REVIEW_URL = `/review/sometoken?id=${ORDER}`;

const INVITE = {
  orderNumber: "LS-2001",
  items: [{ key: "blanket-classic", name: "The Armenian Alphabet Blanket" }],
  review: null,
};

async function stubInvite(page, invite = INVITE) {
  await page.route("**/.netlify/functions/review-submit*", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(invite) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: "pending" }) });
  });
}

test.describe("the review page", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
      "the throttled tier projects run their own suite");
  });

  test("asks before it can read a photograph", async ({ page }) => {
    await stubInvite(page);
    await page.goto(REVIEW_URL);
    await expect(page.getByRole("heading", { name: /how is it holding up/i })).toBeVisible();

    // No file input at all until consent is given.
    await expect(page.locator('input[type="file"]')).toHaveCount(0);

    await page.getByRole("checkbox", { name: /happy for a photo/i }).check();
    await expect(page.locator('input[type="file"]')).toHaveCount(1);

    // And unticking takes it away again.
    await page.getByRole("checkbox", { name: /happy for a photo/i }).uncheck();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });

  test("will not send without a rating, and says what it does with it", async ({ page }) => {
    await stubInvite(page);
    await page.goto(REVIEW_URL);

    const send = page.getByRole("button", { name: /send it to lusik/i });
    await expect(send).toBeDisabled();
    // The promise the whole arrangement rests on.
    await expect(page.getByText(/reads every review herself/i)).toBeVisible();

    await page.getByRole("radio", { name: "5 stars" }).click();
    await expect(send).toBeEnabled();
  });

  test("sends what was typed, and never a photo without consent", async ({ page }) => {
    let posted = null;
    await page.route("**/.netlify/functions/review-submit*", async (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(INVITE) });
      }
      posted = JSON.parse(route.request().postData() ?? "{}");
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: "pending" }) });
    });
    await page.goto(REVIEW_URL);

    await page.getByRole("radio", { name: "4 stars" }).click();
    await page.getByLabel(/your review/i).fill("It has been washed twice and looks new.");
    await page.getByLabel(/what to call you/i).fill("Ani G.");
    await page.getByRole("button", { name: /send it to lusik/i }).click();

    await expect(page.locator("[data-review-done]")).toBeVisible();
    expect(posted.rating).toBe(4);
    expect(posted.body).toContain("washed twice");
    expect(posted.displayName).toBe("Ani G.");
    expect(posted.photoConsent).toBe(false);
    expect(posted.photo).toBeNull();
  });

  test("comes back with what was written last time", async ({ page }) => {
    // Somebody who thought better of it at 11pm should find their words
    // waiting rather than a blank form.
    await stubInvite(page, {
      ...INVITE,
      review: { rating: 3, body: "It arrived late.", displayName: "Ani", photoConsent: false, status: "pending" },
    });
    await page.goto(REVIEW_URL);
    await expect(page.getByLabel(/your review/i)).toHaveValue("It arrived late.");
    await expect(page.getByRole("radio", { name: "3 stars" })).toHaveAttribute("aria-checked", "true");
  });

  test("a bad link says so and offers the phone", async ({ page }) => {
    await page.route("**/.netlify/functions/review-submit*", (route) =>
      route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) }));
    await page.goto(REVIEW_URL);
    await expect(page.getByRole("heading", { name: /couldn.t find that order/i })).toBeVisible();
    await expect(page.locator('a[href^="tel:"]').first()).toBeVisible();
  });
});

test.describe("where approved reviews appear", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
      "the throttled tier projects run their own suite");
  });

  test("a product page with no reviews says nothing about reviews", async ({ page }) => {
    // Not "no reviews yet": that is a page advertising that nobody has
    // bought this, on a shop where most orders are gifts nobody reviews.
    await page.route("**/.netlify/functions/reviews*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reviews: [] }) }));
    await page.goto("/shop/blankets/armenian-alphabet-blanket");
    await expect(page.locator("[data-reviews]")).toHaveCount(0);
    await expect(page.getByText(/no reviews/i)).toHaveCount(0);
  });

  test("approved reviews show under the product with their stars", async ({ page }) => {
    await page.route("**/.netlify/functions/reviews*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reviews: [
            { rating: 5, body: "Washed twice and still perfect.", name: "Ani G.", at: new Date().toISOString(), productKey: "blanket-classic", photoKey: null },
          ],
        }),
      }));
    await page.goto("/shop/blankets/armenian-alphabet-blanket");
    const block = page.locator("[data-reviews]");
    await expect(block).toBeVisible();
    await expect(block.getByText(/washed twice/i)).toBeVisible();
    await expect(block.getByLabel("5 out of 5")).toBeVisible();
    await expect(block.getByText(/verified order/i)).toBeVisible();
  });

  test("the Made for wall shows consented photos, and nothing when there are none", async ({ page }) => {
    await page.route("**/.netlify/functions/reviews*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reviews: [] }) }));
    await page.goto("/gallery");
    await expect(page.locator("[data-made-for-wall]")).toHaveCount(0);

    await page.route("**/.netlify/functions/reviews*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reviews: [{ rating: 5, body: "", name: "Ani", at: new Date().toISOString(), productKey: "blanket-classic", photoKey: `${ORDER}/review-1.jpg` }],
        }),
      }));
    await page.goto("/gallery");
    const wall = page.locator("[data-made-for-wall]");
    await expect(wall).toBeVisible();
    // The photograph is fetched through the gate, never from the store
    // directly — that endpoint is what re-checks consent on every request.
    await expect(wall.locator("img[src*='review-photo-get']").first()).toBeVisible();
  });
});

test.describe("reviews on the immersive sheet", () => {
  // The photo-led products open in the pill sheet on a phone, which is a
  // completely separate render branch from the classic page. A review
  // block wired into only one of them is a review block half the
  // customers never see.
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "the sheet is the mobile branch");
  });

  test("the sheet carries the reviews too", async ({ page }) => {
    await page.route("**/.netlify/functions/reviews*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reviews: [
            { rating: 5, body: "It is on the crib now.", name: "Sona", at: new Date().toISOString(), productKey: "blanket-full-alphabet", photoKey: null },
          ],
        }),
      }));
    await page.goto("/shop/blankets/full-alphabet-crib-blanket");
    const block = page.locator("[data-reviews]");
    await expect(block).toHaveCount(1);
    await expect(block.getByText(/on the crib now/i)).toBeVisible();
  });
});
