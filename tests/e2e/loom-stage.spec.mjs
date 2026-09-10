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
const HYE_EM = "/shop/bibs/hy-em-armenian-bib";

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


  test("typing a name changes what the engine draws", async ({ page }) => {
    // The renderer draws ON DEMAND. A design change that does not request
    // a frame changes nothing on screen — the bib stayed bare while the
    // customer typed their child's name into it, and the blanket only
    // seemed to work because MOUNTING happens to request a frame. Mount
    // and update are different paths and this asserts the second one.
    //
    // HONEST LIMITATION: this asserts the OUTCOME, not the mechanism.
    // Removing the renderer.invalidate() that fixes it does NOT fail this
    // test, because focusing and filling an input also nudges the resize
    // and intersection observers, which request frames of their own. So it
    // guards "typing changes the picture", which is what a customer cares
    // about, but it will not tell you the explicit invalidate has gone.
    // Keep that line: on a page where nothing else reflows, it is the only
    // thing that redraws.
    test.setTimeout(120_000);
    await page.route("**/.netlify/functions/**", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.goto("/shop/bibs/baby-bib");

    const stage = page.locator("[data-loom]").first();
    await expect(stage).toBeAttached();
    await stage.scrollIntoViewIfNeeded();
    await expect
      .poll(() => stage.getAttribute("data-loom-phase"), { timeout: 60_000 })
      .toMatch(/^(live|failed|poster)$/);
    if ((await stage.getAttribute("data-loom-phase")) !== "live") {
      test.info().annotations.push({ type: "loom", description: "engine did not run; update path not exercised" });
      return;
    }

    const canvas = stage.locator("canvas");
    const before = await canvas.screenshot();
    await page.locator('input[autocomplete="given-name"]').first().fill("Anahit");
    // Poll rather than sleep: the redraw is a frame, not a transition.
    await expect.poll(async () => {
      const after = await canvas.screenshot();
      return Buffer.compare(before, after) === 0 ? "unchanged" : "changed";
    }, { timeout: 20_000 }).toBe("changed");
  });

  // ── The Hye Em Yes bib ─────────────────────────────────
  // The one product whose 3D piece nobody configures: the words and the
  // three flag colours ARE the design, and the only choice is the cap.
  // Its failure modes are its own — a piece planned from a webfont, and
  // a rig that has to fit a cap into a frame the camera sized for a bib.

  // On phones this product opens in the immersive pill sheet, where the
  // photographs ARE the backdrop and the gallery runs photosHidden — so
  // the stage is deliberately not mounted there. Putting a "3D" segment
  // into the sheet's backdrop is its own piece of work (owner decision 2
  // in SITE_OVERHAUL_HANDOFF.md); until then, skipping is the honest
  // thing rather than asserting a weaker condition on mobile.
  const desktopOnly = ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium",
      "the Hye Em Yes stage is desktop-only until the immersive sheet gains a 3D segment");
  };

  test("the Hye Em Yes bib stitches its three words in", async ({ page }, testInfo) => {
    desktopOnly({}, testInfo);
    test.setTimeout(120_000);
    await page.route("**/.netlify/functions/**", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.goto(HYE_EM);

    const stage = page.locator("[data-loom]").first();
    await expect(stage).toBeAttached();
    await stage.scrollIntoViewIfNeeded();

    await expect
      .poll(() => stage.getAttribute("data-loom-phase"), { timeout: 60_000 })
      .toMatch(/^(live|failed|poster)$/);
    if ((await stage.getAttribute("data-loom-phase")) !== "live") {
      test.info().annotations.push({ type: "loom", description: "engine did not run on this machine" });
      return;
    }

    // The whole sentence, not a fragment of it. This is the assertion the
    // rig failed for most of its development: the piece was planned twice
    // (once in the fallback face, once when the display font landed) and
    // the reveal was left counting toward the first plan's total, so it
    // stopped a third of the way through and sat there.
    await expect
      .poll(() => stage.getAttribute("data-loom-stitching"), { timeout: 60_000 })
      .toBe("false");

    const stitches = Number(await stage.getAttribute("data-loom-stitches"));
    // Three Armenian words at this chart size are hundreds of crosses. A
    // handful would mean the font drew nothing and the piece is a few
    // stray marks; zero would mean it drew nothing at all.
    expect(stitches, "the piece has almost no stitches — did the glyphs rasterise?")
      .toBeGreaterThan(120);
  });

  test("adding the cap restitches the piece", async ({ page }, testInfo) => {
    desktopOnly({}, testInfo);
    test.setTimeout(120_000);
    await page.route("**/.netlify/functions/**", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.goto(HYE_EM);

    const stage = page.locator("[data-loom]").first();
    await stage.scrollIntoViewIfNeeded();
    await expect
      .poll(() => stage.getAttribute("data-loom-phase"), { timeout: 60_000 })
      .toMatch(/^(live|failed|poster)$/);

    const before = await stage.getAttribute("aria-label");
    await page.getByRole("button", { name: /Add the matching cap/i }).click();

    // The text alternative describes the PIECE, so adding the cap has to
    // change it — a blind customer is told what they are buying by this
    // string and by nothing else.
    await expect
      .poll(() => stage.getAttribute("aria-label"), { timeout: 15_000 })
      .not.toBe(before);
    expect(await stage.getAttribute("aria-label")).toMatch(/cap/i);

    if ((await stage.getAttribute("data-loom-phase")) !== "live") return;
    // The cap carries its own flag, so the piece gains stitches.
    await expect
      .poll(() => stage.getAttribute("data-loom-stitching"), { timeout: 60_000 })
      .toBe("false");
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
