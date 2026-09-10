// ============================================================
// GIFTS — the card, and what the recipient is allowed to see
// ============================================================
// Two halves of the same promise.
//
// At checkout, the message is previewed as the card it becomes, because
// a textarea cannot show whether four lines fit on a small card.
//
// On the follow-along page, the recipient sees what is in the box and
// the message written to them, and never what it cost. That page is
// reached by a capability link, so what it returns is a security
// boundary and not a layout choice: the Function does not select the
// price column at all.
// ============================================================

import { test, expect } from "@playwright/test";

const CART = JSON.stringify({
  at: Date.now(),
  items: [
    { id: "blanket-armenian-classic-310-321", name: "The Armenian Alphabet Blanket", price: 120, qty: 1 },
  ],
});

test.describe("the gift card preview", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
      "the throttled tier projects run their own suite");
  });

  test("shows the message as the card will read, and only once there is one", async ({ page }) => {
    await page.addInitScript((cart) => {
      try { window.localStorage.setItem("lusik_cart_v1", cart); } catch { /* private window */ }
    }, CART);
    await page.goto("/checkout");

    // The gift block is a collapsed card until asked for: most orders
    // are gifts, but most buyers do not need the options open by default.
    const card = page.getByRole("button", { name: /gift options/i }).first();
    await card.scrollIntoViewIfNeeded();
    await card.click();

    const isGift = page.getByRole("checkbox", { name: /this is a gift/i }).first();
    await isGift.check();

    // Nothing to preview yet: an empty card is not a preview.
    await expect(page.getByText(/^on the card$/i)).toHaveCount(0);

    const message = page.getByLabel(/gift message/i);
    await message.fill("With all our love,\nMom and Dad.");
    await expect(page.getByText(/^on the card$/i)).toBeVisible();
    // The line break the buyer typed is the thing a textarea cannot show
    // them, so it has to survive into the preview.
    const rendered = await page.locator("figure blockquote").first().innerText();
    expect(rendered).toContain("With all our love,");
    expect(rendered).toContain("Mom and Dad.");
    expect(rendered.split("\n").length).toBeGreaterThan(1);

    // Emptying it takes the card away again.
    await message.fill("   ");
    await expect(page.getByText(/^on the card$/i)).toHaveCount(0);
  });
});

test.describe("the follow-along page as a gift receipt", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
      "the throttled tier projects run their own suite");
  });

  /** Stub the capability read the page makes. */
  async function stubOrder(page, body) {
    await page.route("**/.netlify/functions/order-milestones*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }));
  }

  test("names the pieces and reads the message back, with no prices anywhere", async ({ page }) => {
    await stubOrder(page, {
      orderNumber: "LS-1042",
      status: "stitching",
      placedAt: new Date().toISOString(),
      items: [
        { name: "The Armenian Alphabet Blanket", variant: "Ayb Ben Gim - Navy on cream", qty: 1 },
        { name: "The Custom Name Bib", variant: null, qty: 2 },
      ],
      gift: { isGift: true, message: "Welcome to the family, little one." },
      milestones: [{ milestone: "received", note: null, photoKey: null, at: new Date().toISOString() }],
    });
    await page.goto("/order/sometoken?id=00000000-0000-4000-8000-000000000000");

    // Scoped to the page itself: the nav's shop menu lists every product
    // name, so an unscoped match finds two.
    const followPage = page.locator("[data-order-follow]");
    await expect(followPage.getByText("The Armenian Alphabet Blanket")).toBeVisible();
    await expect(followPage.getByText("Ayb Ben Gim - Navy on cream")).toBeVisible();
    await expect(followPage.getByText("x2")).toBeVisible();
    await expect(followPage.getByText(/welcome to the family/i)).toBeVisible();

    // The whole point of the gift checkbox. Not a price anywhere on the
    // page, in any currency shape.
    const text = await followPage.innerText();
    expect(text, "a price reached the recipient's page").not.toMatch(/\$\s?\d/);
    expect(text).not.toMatch(/\b\d+\.\d{2}\b/);
  });

  test("a plain order shows its pieces and no card", async ({ page }) => {
    await stubOrder(page, {
      orderNumber: "LS-1043",
      status: "received",
      placedAt: new Date().toISOString(),
      items: [{ name: "The Custom Name Bib", variant: null, qty: 1 }],
      gift: null,
      milestones: [],
    });
    await page.goto("/order/sometoken?id=00000000-0000-4000-8000-000000000000");
    const followPage = page.locator("[data-order-follow]");
    await expect(followPage.getByText("The Custom Name Bib")).toBeVisible();
    await expect(followPage.getByText(/the card in your box/i)).toHaveCount(0);
  });

  test("an older response with no items still renders", async ({ page }) => {
    // The Function grew these fields; a cached or older response has
    // neither, and the page a customer is standing on must not break.
    await stubOrder(page, {
      orderNumber: "LS-1044",
      status: "received",
      placedAt: new Date().toISOString(),
      milestones: [],
    });
    await page.goto("/order/sometoken?id=00000000-0000-4000-8000-000000000000");
    await expect(page.getByText("LS-1044")).toBeVisible();
  });
});
