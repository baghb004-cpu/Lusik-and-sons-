// ============================================================
// /design/<encoded> — a design somebody sent you
// ============================================================
// The load-bearing property is what this page is NOT: it is not a read
// of the saved-designs store. Saved designs live on a profile behind
// their owner's login and their ids are a timestamp plus five random
// characters, so a public page that looked designs up by id would be an
// enumerable read of other people's children's names. The design
// travels in the link instead, which means the only person who can open
// one is somebody the owner sent it to.
//
// So the tests check three things: the page renders the design that is
// in the link, it makes no request for it, and a link that lost
// characters in a message app fails softly rather than throwing.
// ============================================================

import { test, expect } from "@playwright/test";

/** The same shape the configurator's share button produces. */
function shareLink(compact) {
  const b64 = Buffer.from(JSON.stringify(compact)).toString("base64");
  return `/design/${b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

test.describe("a shared design", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!["desktop-chromium", "mobile-chromium"].includes(testInfo.project.name),
      "the throttled tier projects run their own suite");
  });

  test("shows the name and the design that were in the link", async ({ page }) => {
    await page.goto(shareLink({ n1: "ANI", n2: "2026" }));
    await expect(page.getByRole("heading", { name: /a blanket for ANI/i })).toBeVisible();
    // The second line is part of the design, so it is part of what the
    // recipient is being shown. Scoped to the summary list: the footer
    // carries a copyright year, and an unscoped match finds both.
    await expect(page.locator("dd", { hasText: "2026" }).first()).toBeVisible();
    // And the piece itself, not a placeholder.
    await expect(page.getByRole("img").first()).toBeVisible();
  });

  test("asks the server for nothing to render it", async ({ page }) => {
    const calls = [];
    await page.route("**/.netlify/functions/**", (route) => {
      calls.push(route.request().url());
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await page.goto(shareLink({ n1: "ANI" }));
    await expect(page.getByRole("heading", { name: /a blanket for ANI/i })).toBeVisible();
    // Nothing that looks like a design lookup. (Inventory and the like
    // are the site chrome's business and are allowed.)
    expect(calls.filter((u) => /design/i.test(u))).toEqual([]);
  });

  test("the name is in the server-rendered HTML, so a message preview shows it", async ({ request }) => {
    const res = await request.get(shareLink({ n1: "ANI" }));
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain("A blanket for ANI");
    // A design someone sent a friend has no business in a search index.
    expect(html).toMatch(/<meta name="robots" content="[^"]*noindex/);
  });

  test("carries the design through to the configurator", async ({ page }) => {
    await page.goto(shareLink({ n1: "ANI" }));
    await page.getByRole("button", { name: /open this design/i }).click();
    await expect(page).toHaveURL(/armenian-alphabet-blanket/);
    // The design arrives applied, not as an empty picker.
    await expect(page.getByRole("img", { name: /ANI/ }).first()).toBeVisible();
  });

  test("a truncated link fails softly and offers the shop", async ({ page }) => {
    // Message apps eat trailing characters. The design cannot be
    // recovered, but the page still has somewhere to send the reader.
    await page.goto("/design/thisisnotadesign");
    await expect(page.getByRole("heading", { name: /did not come through whole/i })).toBeVisible();
    await page.getByRole("button", { name: /design a blanket/i }).click();
    await expect(page).toHaveURL(/armenian-alphabet-blanket/);
  });

  test("a hostile blob cannot get anything onto the page", async ({ page }) => {
    // Anyone can put anything in this path segment.
    const nasty = shareLink({ n1: "<img src=x onerror=alert(1)>", n2: "javascript:alert(2)" });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(nasty);
    // React escapes it, so it lands as text and nothing executes.
    await expect(page.locator("img[src='x']")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("the share button on the product page points here", async ({ page }) => {
    await page.goto("/shop/blankets/armenian-alphabet-blanket");
    // The clipboard is the fallback path and the one a headless browser
    // takes without a permission grant; the toast carries the URL.
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
    const share = page.getByRole("button", { name: /share/i }).first();
    if (await share.count() === 0) test.skip(true, "no share control on this viewport");
    await share.scrollIntoViewIfNeeded();
    await share.click();
    const copied = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
    expect(copied, "the share button did not produce a /design/ link").toContain("/design/");
  });
});
