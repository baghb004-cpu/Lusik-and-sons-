// ============================================================
// THE FITTING ROOM — poses, the compare wipe, and the colour note
// ============================================================
// SITE_OVERHAUL_HANDOFF.md PR 8. Three things, and the interesting test
// is the third.
//
// The pose chips existed for about an hour before anyone rendered what
// they did, and two of the four poses they offered were wrong: one
// called "the backing" could never show the backing, because the orbit
// clamps the camera above the table and the satin backing is on the
// underside; and "close up" dropped the camera almost to table level,
// which foreshortens a large flat piece into a blank plane. Neither is
// visible by reading the code — they are numbers that look fine.
//
// So the close-up gets a PIXEL test. It screenshots the stage and counts
// how much of the frame is thread rather than cloth. A close-up aimed at
// the origin frames the bare middle of the blanket (its design lives on
// two diagonals), and that is a perfect, well-lit photograph of nothing.
// ============================================================

import { test, expect } from "@playwright/test";

const BLANKET = "/shop/blankets/armenian-alphabet-blanket";

/** Wait for the engine to actually be running, or skip. */
async function liveStage(page) {
  const stage = page.locator("[data-loom-phase]").first();
  // The stage arms on idle or on the first interaction with it.
  await stage.scrollIntoViewIfNeeded();
  await stage.hover().catch(() => {});
  try {
    await expect(stage).toHaveAttribute("data-loom-phase", "live", { timeout: 25_000 });
  } catch {
    test.skip(true, "the engine did not come up on this runner; the fallback path is covered elsewhere");
  }
  return stage;
}

/**
 * The fraction of pixels in a screenshot that are not cloth.
 *
 * Measured in the browser, by handing the PNG back and decoding it in a
 * 2D canvas. Reading the WebGL canvas directly does not work: its
 * drawing buffer is cleared once the frame is presented, which is the
 * bug that once made the poster script write a blank 2 KB image and
 * report success.
 */
async function threadFraction(page, buffer) {
  const b64 = buffer.toString("base64");
  return page.evaluate(async (data) => {
    const img = new Image();
    img.src = "data:image/png;base64," + data;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const { data: px } = ctx.getImageData(0, 0, c.width, c.height);
    let thread = 0;
    for (let i = 0; i < px.length; i += 4) {
      // The cloth is cream and the page behind it is cream; thread on
      // this product is a dark blue. Anything appreciably darker than
      // the cloth is stitching.
      const lum = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      if (lum < 170) thread += 1;
    }
    return thread / (px.length / 4);
  }, b64);
}

test.describe("the fitting room", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
      "the throttled tier projects do not exercise the engine");
  });

  test("the pose chips are offered only when there is a camera to point", async ({ page }) => {
    // Pinned to the tier that never loads the engine. The stage falls
    // back to the live 2D preview, which has no camera — so a chip here
    // would be a button that does nothing, which reads as a broken page
    // rather than a lighter one.
    await page.goto(`${BLANKET}?loom=low`);
    await expect(page.locator("[data-loom-phase]").first()).toHaveAttribute("data-loom-phase", "poster");
    await expect(page.getByRole("group", { name: /how to look at the piece/i })).toHaveCount(0);
  });

  test("three poses, each of which does what it says", async ({ page }) => {
    await page.goto(BLANKET);
    await liveStage(page);

    const chips = page.getByRole("group", { name: /how to look at the piece/i });
    await expect(chips).toBeVisible();
    // Three, not four. The fourth was "the backing", which the camera
    // cannot reach — see the header of this file.
    await expect(chips.getByRole("button")).toHaveCount(3);
    await expect(chips.getByRole("button", { name: /on the table/i })).toHaveAttribute("aria-pressed", "true");

    await chips.getByRole("button", { name: /from above/i }).click();
    await expect(chips.getByRole("button", { name: /from above/i })).toHaveAttribute("aria-pressed", "true");
    await expect(chips.getByRole("button", { name: /on the table/i })).toHaveAttribute("aria-pressed", "false");
  });

  test("the close-up frames stitching, not bare cloth", async ({ page }) => {
    await page.goto(BLANKET);
    const stage = await liveStage(page);
    const chips = page.getByRole("group", { name: /how to look at the piece/i });

    const table = await threadFraction(page, await stage.screenshot());

    await chips.getByRole("button", { name: /close up/i }).click();
    // The camera eases; give it the move plus a couple of frames.
    await page.waitForTimeout(2500);
    const close = await threadFraction(page, await stage.screenshot());

    // Aimed at the origin this reads 0.0%: the blanket's design lives on
    // two diagonals and its middle is empty cloth. Aimed at the
    // stitching it measures 2.3% on the desktop frame and 15.4% on the
    // narrower phone one, against a table view of 1.2% and 2.0% — so the
    // check that carries the meaning is the RATIO, with an absolute
    // floor underneath it in case a future change leaves both at zero.
    const message = `close-up covered ${(close * 100).toFixed(1)}% of the frame in thread, table view ${(table * 100).toFixed(1)}%`;
    expect(close, message).toBeGreaterThan(0.01);
    expect(close, message).toBeGreaterThan(table * 1.4);
  });

  test("the compare wipe puts a real photograph over the render", async ({ page }) => {
    await page.goto(BLANKET);
    const toggle = page.getByRole("button", { name: /compare with a photo/i });
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    // Nothing overlaid until asked: the stage under it is draggable, and
    // a permanent handle would fight that.
    await expect(page.getByRole("slider")).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    const slider = page.getByRole("slider");
    await expect(slider).toBeVisible();

    // The photograph is clipped from the left, and moving the slider
    // moves the seam. Asserted on the clip itself rather than on pixels:
    // this is the wipe, not the camera.
    const photo = page.locator("img[style*='clip-path']").first();
    await expect(photo).toBeVisible();
    const before = await photo.evaluate((el) => el.style.clipPath);
    await slider.fill("15");
    const after = await photo.evaluate((el) => el.style.clipPath);
    expect(after).not.toBe(before);
    expect(after).toContain("15%");
  });

  test("the colour note sits under the stage, not in the column beside it", async ({ page }) => {
    await page.goto(BLANKET);
    const frame = page.locator(".gallery-frame").first();
    const note = page.getByText(/photos.*examples|examples of past/i).first();
    await frame.scrollIntoViewIfNeeded();

    const f = await frame.boundingBox();
    const n = await note.boundingBox();
    expect(n, "the product-variation note is not on the page any more").not.toBeNull();
    // Below it, and in the same column: a note saying a rendered colour
    // is not the colour in your hands belongs next to the render.
    expect(n.y).toBeGreaterThan(f.y);
    expect(Math.abs(n.x - f.x)).toBeLessThan(f.width * 0.25);
  });
});
