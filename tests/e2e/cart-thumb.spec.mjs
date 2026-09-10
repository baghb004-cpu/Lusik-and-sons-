// ============================================================
// CART THUMBNAILS — the piece they configured, in the bag
// ============================================================
// The whole path in a real browser: configure a blanket, put it in the
// bag, and check that the row shows what the stage was showing rather
// than a stock photograph of somebody else's blanket.
//
// The one that could bite is the second test. A WebGL drawing buffer is
// cleared once its frame is presented, so a capture taken a tick after
// the render hands back a fully transparent image — and a transparent
// WebP is a perfectly valid data URL that passes every shape check and
// renders as an empty box. That is exactly what the poster script wrote
// the first time it ran, and it logged success. So this measures the
// PIXELS.
// ============================================================

import { test, expect } from "@playwright/test";

const BLANKET = "/shop/blankets/armenian-alphabet-blanket";

/** Bring the engine up, or skip: the fallback path is covered elsewhere. */
async function liveStage(page) {
  const stage = page.locator("[data-loom-phase]").first();
  await stage.scrollIntoViewIfNeeded();
  await stage.hover().catch(() => {});
  try {
    await expect(stage).toHaveAttribute("data-loom-phase", "live", { timeout: 25_000 });
  } catch {
    test.skip(true, "the engine did not come up on this runner");
  }
}

/** The stored cart, as the site would read it back. */
async function storedCart(page) {
  return page.evaluate(() => {
    try { return JSON.parse(window.localStorage.getItem("lusik_cart_v1") || "null"); } catch { return null; }
  });
}

/**
 * The full-page bag at /cart is mobile-only: on `lg` and up the bag is
 * the drawer instead, and CartRoute's own wrapper is `lg:hidden`, so on
 * a desktop viewport that URL renders nothing at all.
 */
function skipUnlessPhone(testInfo) {
  test.skip(testInfo.project.name !== "mobile-chromium",
    "the /cart page is the mobile bag; desktop uses the drawer");
}

async function addBlanketToBag(page) {
  const add = page.getByRole("button", { name: /add to (cart|bag)/i }).first();
  await add.scrollIntoViewIfNeeded();
  await add.click();
  await expect.poll(async () => (await storedCart(page))?.items?.length ?? 0).toBeGreaterThan(0);
}

test.describe("cart thumbnails", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
      "the throttled tier projects do not exercise the engine");
  });

  test("the bag row carries an image of the piece, within its budget", async ({ page }) => {
    await page.goto(BLANKET);
    await liveStage(page);
    await addBlanketToBag(page);

    const cart = await storedCart(page);
    const row = cart.items[0];
    expect(row.thumb, "the row went into the bag with no thumbnail").toBeTruthy();
    expect(row.thumb.startsWith("data:image/webp;base64,")).toBe(true);
    // Forty rows share one localStorage origin, so the cap is real.
    expect(row.thumb.length).toBeLessThanOrEqual(40 * 1024);
  });

  test("the thumbnail is the piece, not an empty frame", async ({ page }) => {
    await page.goto(BLANKET);
    await liveStage(page);
    await addBlanketToBag(page);

    const cart = await storedCart(page);
    // Decode it and count what is not transparent and not cloth. A
    // capture read a tick after the render comes back fully transparent,
    // which is a valid image and a blank bag row.
    const ink = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      let opaque = 0;
      let dark = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 32) opaque += 1;
        const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        if (data[i + 3] > 32 && lum < 170) dark += 1;
      }
      const total = data.length / 4;
      return { width: img.width, height: img.height, opaque: opaque / total, dark: dark / total };
    }, cart.items[0].thumb);

    expect(ink.width, "the capture is wider than the budget allows").toBeLessThanOrEqual(320);
    expect(ink.height).toBeLessThanOrEqual(320);
    // Mostly cloth, which is opaque. A cleared drawing buffer reads 0.
    expect(ink.opaque, `only ${(ink.opaque * 100).toFixed(1)}% of the thumbnail is opaque — the drawing buffer was already cleared`)
      .toBeGreaterThan(0.5);
    // And some of it is thread. Cloth alone would mean the camera is
    // pointing at nothing.
    expect(ink.dark, `only ${(ink.dark * 100).toFixed(2)}% of the thumbnail is thread`).toBeGreaterThan(0.002);
  });

  test("the bag row shows it", async ({ page }, testInfo) => {
    skipUnlessPhone(testInfo);
    await page.goto(BLANKET);
    await liveStage(page);
    await addBlanketToBag(page);

    await page.goto("/cart");
    await expect(page.locator("img[src^='data:image/webp']").first()).toBeVisible();
  });

  test("the checkout summary shows it, and it never reaches the server", async ({ page }) => {
    await page.goto(BLANKET);
    await liveStage(page);
    await addBlanketToBag(page);

    // Straight through checkout, watching what actually goes out.
    let posted = null;
    await page.route("**/.netlify/functions/create-checkout-session*", async (route) => {
      posted = JSON.parse(route.request().postData() ?? "{}");
      // No URL back, so the browser stays here for the assertions.
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: null }) });
    });
    // The ZIP to city/state echo, which the Pay button waits for.
    await page.route("**/.netlify/functions/zip-lookup*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ zip: "90620", city: "Buena Park", state: "CA" }),
      }));

    await page.goto("/checkout");
    // The checkout summary shows it too.
    await expect(page.locator("img[src^='data:image/webp']").first()).toBeVisible();

    // Below the free-shipping threshold the ZIP prices the zone, and the
    // Pay button stays disabled until the echo confirms it.
    await page.getByLabel(/shipping zip code/i).first().fill("90620");
    await expect(page.getByText(/Buena Park, CA 90620/)).toBeVisible({ timeout: 10_000 });

    const pay = page.getByRole("button", { name: /pay with stripe/i }).first();
    // Asserted, not guarded: an `if` here would let the whole point of
    // this test quietly stop running the day the button is renamed.
    await expect(pay).toBeVisible();
    await pay.click();
    await expect.poll(() => posted, { timeout: 15_000 }).not.toBeNull();
    const body = JSON.stringify(posted);
    expect(body, "a 40 KB data URL went to the server with the order").not.toContain("data:image");
    expect(body).not.toContain("thumb");
    // And the field the server actually trusts is still there, so this
    // test cannot pass by the payload having become empty.
    expect(body).toContain("productKey");
  });

  test("a device that cannot run the engine still gets a bag row", async ({ page }, testInfo) => {
    skipUnlessPhone(testInfo);
    // Pinned to the tier that never loads three.js. There is no capture,
    // so the row falls back to the product photograph exactly as it did
    // before this field existed — which is the case that matters most,
    // because it is every visitor on an old phone.
    await page.goto(`${BLANKET}?loom=low`);
    await addBlanketToBag(page);

    const cart = await storedCart(page);
    expect(cart.items[0].thumb, "a poster-only stage produced a thumbnail from somewhere").toBeUndefined();

    await page.goto("/cart");
    await expect(page.getByRole("button", { name: /view the armenian alphabet blanket product page/i }).first()).toBeVisible();
    await expect(page.locator("img[src^='data:image/webp']")).toHaveCount(0);
  });

  test("a corrupt thumbnail in storage never reaches an img tag", async ({ page }, testInfo) => {
    skipUnlessPhone(testInfo);
    // localStorage is same-device data, but an extension or another tab
    // can write it, and this value goes on to make the browser fetch
    // something.
    // Seeded through an init script rather than by visiting a page and
    // writing storage: the provider mirrors the cart back to storage
    // whenever its state settles, so a write from the outside can be
    // overwritten before the next navigation reads it. That race is
    // what made this test flaky once.
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("lusik_cart_v1", JSON.stringify({
          at: Date.now(),
          items: [{
            id: "blanket-armenian-classic-310-321",
            name: "The Armenian Alphabet Blanket",
            price: 120,
            qty: 1,
            thumb: "https://tracker.example/pixel.gif",
          }],
        }));
      } catch { /* a private window; the test below then finds no row and says so */ }
    });
    await page.goto("/cart");
    // The row is still there; the poisoned source is not.
    await expect(page.getByRole("button", { name: /view the armenian alphabet blanket product page/i }).first()).toBeVisible();
    await expect(page.locator("img[src*='tracker.example']")).toHaveCount(0);
  });
});
