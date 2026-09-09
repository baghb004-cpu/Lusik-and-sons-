// ============================================================
// LOOM STAGE — does the engine actually reach a customer?
// ============================================================
// The unit tests cover the tier resolver and the stitch planner, and the
// glyph spec covers the rasteriser. None of them answer the question that
// matters: on the real product page, does a customer get a 3D preview,
// does it work itself in, and does the fallback hold when it cannot run?
//
// The fallback case is the one worth guarding hardest. It is what every
// visitor on a low-tier device sees, it is invisible to anyone developing
// on a fast machine, and it has already broken once — the stage imposed a
// 4:3 box that clipped the square 2D preview and cut the top and bottom
// rows off the blanket.
// ============================================================

import { test, expect } from "@playwright/test";

const PDP = "/shop/blankets/armenian-alphabet-blanket";

test.describe("Loom stage", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
      "the throttled tier projects deliberately never load the engine");
  });

  test("the stage mounts and works the piece in", async ({ page }) => {
    test.setTimeout(120_000);
    await page.route("**/.netlify/functions/**", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.goto(PDP);

    const stage = page.locator("[data-loom]").first();
    await expect(stage).toBeAttached();
    // Scroll it into view before asserting anything about rendering. The
    // stage deliberately stops drawing while off screen, so polling a
    // render-driven attribute on an off-screen canvas waits forever —
    // which is exactly how this test was flaky the first time.
    await stage.scrollIntoViewIfNeeded();

    // Headless Chromium reports WebGL 2 through SwiftShader, which the
    // tier resolver classes as `mid` — so the engine should load here.
    // If it ever cannot, the assertion below still passes on `failed`,
    // because falling back cleanly is a correct outcome; what is NOT
    // acceptable is hanging in `loading` forever.
    await expect
      .poll(() => stage.getAttribute("data-loom-phase"), { timeout: 60_000 })
      .toMatch(/^(live|failed|poster)$/);

    const phase = await stage.getAttribute("data-loom-phase");
    if (phase !== "live") {
      // A clean fallback is a pass, but say so rather than silently
      // pretending the engine was exercised.
      test.info().annotations.push({ type: "loom", description: `engine did not run: ${phase}` });
      return;
    }

    // The canvas is on top of the fallback once live.
    await expect(stage.locator("canvas")).toBeAttached();
    // data-loom-stitching flips true while the piece is being worked in
    // and false when it settles. The animation is under two seconds, so
    // poll for the settled state rather than trying to catch the middle.
    await expect
      .poll(() => stage.getAttribute("data-loom-stitching"), { timeout: 30_000 })
      .toBe("false");
  });

  test("the fallback fills its frame when the engine is pinned off", async ({ page }) => {
    // ?loom=low is what a low-tier device resolves to. The 2D preview
    // must be complete and uncropped: it is the live preview for everyone
    // who cannot run the engine, so a clipped one is a broken product page.
    await page.route("**/.netlify/functions/**", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.goto(`${PDP}?loom=low`);

    const stage = page.locator("[data-loom]").first();
    await expect(stage).toBeAttached();
    await expect(stage).toHaveAttribute("data-loom-phase", "poster");
    await expect(stage.locator("canvas")).toHaveCount(1);

    // The preview inside is square; the stage must not squash it.
    const preview = stage.locator('[role="img"]').first();
    await expect(preview).toBeVisible();
    const box = await preview.boundingBox();
    expect(box, "the fallback preview has no box").not.toBeNull();
    const ratio = box.width / box.height;
    expect(ratio, `fallback is ${box.width}x${box.height}, not square`).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(1.18);

    // And it must not be clipped by the stage's overflow:hidden.
    const stageBox = await stage.boundingBox();
    expect(box.height, "the preview is taller than the stage that contains it")
      .toBeLessThanOrEqual(stageBox.height + 2);
  });

  test("the stage describes the design, not the widget", async ({ page }) => {
    await page.route("**/.netlify/functions/**", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.goto(`${PDP}?loom=low`);
    const stage = page.locator("[data-loom]").first();
    const label = await stage.getAttribute("aria-label");
    expect(label, "the stage has no accessible name").toBeTruthy();
    expect(label.toLowerCase()).not.toContain("canvas");
    expect(label.toLowerCase()).toContain("blanket");
  });
});
