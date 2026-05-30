// ============================================================
// Smoke tests — does the site load, can a customer reach Stripe?
// ============================================================
// These are the tests that would have caught the bugs we hit during
// the May 2026 session: the PRODUCT.letters dead reference crash,
// the cart-ID format mismatch that broke every blanket checkout,
// the missing-element crashes after dead-code removal. They click
// through the main customer paths and assert the page didn't blow
// up. They're not exhaustive — they're a tripwire.
//
// Backend calls (Netlify Functions) are stubbed via page.route()
// since these tests run against a static-served index.html with
// no functions wired up.
// ============================================================

import { test, expect } from "@playwright/test";

// Shared helper: fail the test if anything logs to console.error
// during the test. The most common bug shape we hit this session
// was "JSX threw at mount and the ErrorBoundary swallowed it" —
// the page renders the friendly error UI but every test would
// still pass without this assertion.
function watchForConsoleErrors(page, errors) {
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
}

// FirstVisitLangBanner is a full-screen modal that blocks the page
// for any visitor without a stored language preference. Tests run
// in a fresh browser context every time, so the banner shows up
// and intercepts every click. Pre-seed localStorage with "en" so
// the LangContext treats this run as a returning visitor.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try { localStorage.setItem("lusik_lang_v1", "en"); } catch {}
  });
});

test.describe("home page", () => {
  test("loads without console errors and shows brand + product", async ({ page }) => {
    const errors = [];
    watchForConsoleErrors(page, errors);

    await page.goto("/");
    await expect(page.getByText("Lusik & Sons").first()).toBeVisible();
    // The hero CTA — present on every home render, good liveness signal.
    // Copy changed in the narrative-rewrite pass: was "Shop the blanket",
    // now "See what Lusik makes" (and the button now navigates to /shop
    // instead of directly into the blanket PDP).
    await expect(page.getByRole("button", { name: /see what lusik makes/i })).toBeVisible({ timeout: 10_000 });

    // Tailwind CDN logs a console warning ("cdn.tailwindcss.com should
    // not be used in production") that we'd see on every page. Filter
    // it out so it doesn't fail every test. Also filter out failures
    // to load third-party resources (Google Fonts, Netlify Identity
    // widget) — these come from a sandboxed CI environment without
    // open internet, not from app code.
    const realErrors = errors.filter((e) =>
      !/tailwindcss\.com/i.test(e) &&
      !/Failed to load resource/i.test(e),
    );
    expect(realErrors, `Unexpected console errors: ${realErrors.join("\n")}`).toEqual([]);
  });

  test("error boundary is NOT showing", async ({ page }) => {
    await page.goto("/");
    // If the React tree crashed at mount, the ErrorBoundary in
    // src/main.jsx renders this headline. Healthy home pages
    // never contain it. (The post-Vite-flip text is 'Something
    // went wrong'; the pre-flip text was 'we hit a snag' — we
    // match either with the OR so this assertion catches both
    // versions if you ever revert.)
    await expect(page.getByText(/something went wrong|we hit a snag/i)).not.toBeVisible({ timeout: 5_000 });
  });
});

test.describe("cart drawer", () => {
  // The cart drawer is a desktop-only surface now. On mobile the bag is
  // a full page (exercised by the checkout tests below), and there's no
  // slide-in drawer to open or close — the cart icon routes to the bag
  // page instead. Skip these two drawer assertions on the mobile project.
  test.skip(({ isMobile }) => isMobile, "Cart drawer is desktop-only; mobile uses the full bag page");

  test("opens and closes via the cart icon + X button", async ({ page }) => {
    await page.goto("/");

    // Open via the cart icon in the top nav.
    await page.getByRole("button", { name: /your cart/i }).first().click();
    // "Your cart is empty" appears in both the cart-icon tooltip and
    // the drawer body — target the drawer's <p> specifically.
    const emptyState = page.locator("p", { hasText: /your cart is empty/i });
    await expect(emptyState).toBeVisible({ timeout: 5_000 });

    // Close via the X button.
    await page.getByRole("button", { name: /close cart/i }).click();
    await expect(emptyState).not.toBeVisible();
  });

  test("Escape key closes the cart drawer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /your cart/i }).first().click();
    const emptyState = page.locator("p", { hasText: /your cart is empty/i });
    await expect(emptyState).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(emptyState).not.toBeVisible();
  });
});

test.describe("blanket purchase flow", () => {
  test("can configure and add a blanket to the cart", async ({ page }) => {
    // Navigate directly to the blanket PDP. The hero CTA on home is
    // now a generic "See what Lusik makes" that lands on /shop, not
    // the product page — so we go straight to the configurator URL.
    await page.goto("/shop/blankets/armenian-alphabet-blanket");

    // Pick the Armenian alphabet (first option in the picker).
    // Picker button's accessible name is "Armenian Ա Բ Գ" (label + glyphs).
    // Match just the label so we don't depend on the exact glyph rendering.
    await page.getByRole("button", { name: /^Armenian\b/ }).first().click();

    // Add to Bag. The button label varies by selection state, but
    // it always contains "Add to Bag" once a valid config is made.
    const addToCart = page.getByRole("button", { name: /add to bag.*\$/i }).first();
    await expect(addToCart).toBeEnabled({ timeout: 5_000 });
    await addToCart.click();

    // Cart drawer auto-opens; the item should be visible with the
    // product name. Target the drawer's <p> directly — the shop
    // mega-menu also renders the product name in a hidden <button>
    // and we don't want to match that.
    await expect(
      page.locator("p", { hasText: /armenian alphabet blanket/i }).first()
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("checkout view", () => {
  test("opens from cart and shows order summary", async ({ page }) => {
    // Add a blanket first. Navigate directly to the blanket PDP
    // since the home hero CTA no longer lands there post narrative
    // rewrite ("See what Lusik makes" -> /shop).
    await page.goto("/shop/blankets/armenian-alphabet-blanket");
    // Picker button's accessible name is "Armenian Ա Բ Գ" (label + glyphs).
    // Match just the label so we don't depend on the exact glyph rendering.
    await page.getByRole("button", { name: /^Armenian\b/ }).first().click();
    await page.getByRole("button", { name: /add to bag.*\$/i }).first().click();

    // Cart auto-opens. Click Checkout.
    await page.getByRole("button", { name: /^checkout/i }).click();

    // We should land on the checkout page. The heading was renamed in the
    // narrative-rewrite pass from "Almost there" to "Almost in Lusik's hands".
    await expect(page.getByRole("heading", { name: /almost in lusik's hands/i })).toBeVisible({ timeout: 5_000 });
    // Order summary row shows the item.
    await expect(page.getByText(/order summary/i)).toBeVisible();
  });

  test("Pay with Stripe POSTs to create-checkout-session", async ({ page }) => {
    // Stub the function — the test runs against a static server so
    // the real endpoint doesn't exist. We assert the cart shape that
    // hits the backend matches what we expect (this is the test that
    // would have caught the productKey mismatch bug).
    let receivedBody = null;
    await page.route("**/.netlify/functions/create-checkout-session*", async (route) => {
      receivedBody = JSON.parse(route.request().postData() ?? "{}");
      // Block the redirect by returning a 200 with no URL so the
      // browser stays on the checkout page for assertions.
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: null }),
      });
    });

    // Direct-nav to the blanket PDP (same reason as the test above).
    await page.goto("/shop/blankets/armenian-alphabet-blanket");
    // Picker button's accessible name is "Armenian Ա Բ Գ" (label + glyphs).
    // Match just the label so we don't depend on the exact glyph rendering.
    await page.getByRole("button", { name: /^Armenian\b/ }).first().click();
    await page.getByRole("button", { name: /add to bag.*\$/i }).first().click();
    await page.getByRole("button", { name: /^checkout/i }).click();
    await page.getByRole("button", { name: /pay with stripe/i }).click();

    // Wait for the route handler to capture the request.
    await expect.poll(() => receivedBody, { timeout: 5_000 }).not.toBeNull();
    expect(Array.isArray(receivedBody.cart)).toBe(true);
    expect(receivedBody.cart.length).toBeGreaterThan(0);
    // Every cart item must carry a productKey, and it must be in the
    // shape TRUSTED_PRODUCTS recognizes (starts with "blanket-" or
    // "bib"). This is the assertion that would have failed during
    // the cart-ID mismatch bug.
    for (const item of receivedBody.cart) {
      expect(item.productKey, `cart item missing productKey: ${JSON.stringify(item)}`).toBeTruthy();
      expect(item.productKey).toMatch(/^(blanket-|bib$)/);
    }

    // Idempotency key — must accompany every checkout POST so a
    // retried request (network blip, double-tap, refresh) gets the
    // original Stripe Checkout Session back instead of creating a
    // duplicate. Shape must be printable ASCII so it can ride in a
    // header without smuggling CRLF.
    expect(typeof receivedBody.idempotency_key).toBe("string");
    expect(receivedBody.idempotency_key.length).toBeGreaterThan(8);
    expect(receivedBody.idempotency_key.length).toBeLessThanOrEqual(255);
    expect(receivedBody.idempotency_key).toMatch(/^[\x21-\x7e]+$/);
  });

  test("Buy it now sends exactly one item straight to checkout", async ({ page }) => {
    // Express checkout must bypass the bag and POST a single configured
    // item with the same load-bearing productKey shape as a normal add.
    let receivedBody = null;
    await page.route("**/.netlify/functions/create-checkout-session*", async (route) => {
      receivedBody = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: null }),
      });
    });

    await page.goto("/shop/blankets/armenian-alphabet-blanket");
    await page.getByRole("button", { name: /^Armenian\b/ }).first().click();

    // Express path: "Buy it now" routes directly to the checkout page —
    // no cart drawer, no Checkout button in between.
    const buyNow = page.getByRole("button", { name: /^buy it now$/i }).first();
    await expect(buyNow).toBeEnabled({ timeout: 5_000 });
    await buyNow.click();

    await expect(page.getByRole("heading", { name: /almost in lusik's hands/i })).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: /pay with stripe/i }).click();

    await expect.poll(() => receivedBody, { timeout: 5_000 }).not.toBeNull();
    expect(Array.isArray(receivedBody.cart)).toBe(true);
    // Express checkout is a single transient item — never the whole bag.
    expect(receivedBody.cart.length).toBe(1);
    expect(receivedBody.cart[0].productKey).toBeTruthy();
    expect(receivedBody.cart[0].productKey).toMatch(/^(blanket-|bib$)/);
  });
});

test.describe("shop hierarchy navigation", () => {
  test("home → /shop → category → product → URL is the canonical product path", async ({ page }) => {
    await page.goto("/");

    // Open /shop via the home "Shop" Explore card. It renders on both
    // mobile and desktop — the off-viewport copy is display:none, so
    // getByRole resolves to the single visible card per project. This
    // replaces the old "See everything Lusik makes" link, which the
    // bottom-nav redesign removed.
    await page.getByRole("button", { name: /shop.*blankets, bibs/i }).click();
    await expect(page).toHaveURL(/\/shop\/?$/, { timeout: 5_000 });

    // Click into Blankets category. Card uses aria-label="Browse Blankets".
    await page.getByRole("button", { name: /browse blankets/i }).click();
    await expect(page).toHaveURL(/\/shop\/blankets\/?$/, { timeout: 5_000 });

    // Click into the live Armenian Alphabet Blanket product.
    await page.getByRole("button", { name: /view the armenian alphabet blanket/i }).click();
    await expect(page).toHaveURL(/\/shop\/blankets\/armenian-alphabet-blanket\/?$/, { timeout: 5_000 });

    // The product page should render the configurator — verify by
    // looking for the "Armenian" alphabet picker button which is
    // unique to the live blanket PDP.
    await expect(page.getByRole("button", { name: /^Armenian\b/ }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("placeholder product page shows its commission CTA", async ({ page }) => {
    // We navigate via the SPA (clicks) rather than `page.goto` so
    // the test passes against the static `vite preview` server which
    // doesn't have Netlify's SPA fallback for /shop/* URLs. The
    // SPA's pushState routing handles the hierarchy fine; only the
    // initial server response would 404 on a deep URL.
    await page.goto("/");
    // Open /shop via the home "Shop" Explore card (renders on both
    // viewports — see the test above).
    await page.getByRole("button", { name: /shop.*blankets, bibs/i }).click();
    await page.getByRole("button", { name: /browse blankets/i }).click();
    // Click the placeholder card — accessible name is
    // "The Full Alphabet Crib Blanket — coming soon".
    await page.getByRole("button", { name: /full alphabet crib blanket.*coming soon/i }).click();
    await expect(page).toHaveURL(/\/shop\/blankets\/full-alphabet-crib-blanket\/?$/, { timeout: 10_000 });

    // The Full Alphabet Crib Blanket is a PRICED placeholder ($245, with
    // status still "placeholder"), so its page renders the commission
    // path rather than the unpriced waitlist path. The primary CTA is a
    // "Write Lusik to commission this" mailto link (role=link), not the
    // unpriced "Write me when it's ready" button. Assert the CTA that
    // actually renders for this product.
    await expect(
      page.getByRole("link", { name: /write lusik to commission this/i })
    ).toBeVisible({ timeout: 10_000 });

    // Product name in the page heading — confirms the placeholder
    // page rendered with the right product, not just any page.
    await expect(
      page.getByRole("heading", { name: /full alphabet crib blanket/i })
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("journal navigation", () => {
  test("can navigate to a journal post and back", async ({ page }) => {
    await page.goto("/");

    // Open the journal. The header nav is a <button> (not <a>) that
    // does SPA navigation via setView state. The role selector
    // matches "Journal" exactly (avoids the journal-flavored text
    // on links elsewhere on the page).
    await page.getByRole("button", { name: /^journal$/i }).first().click();

    // Journal index renders a list of posts. Click the first one.
    await page.getByRole("article").first().click();

    // Should now be on a journal post — has an "All posts" back
    // button (post-Vite-flip text; pre-flip was "back to journal").
    await expect(page.getByRole("button", { name: /all posts|back to journal/i })).toBeVisible({ timeout: 5_000 });

    // URL should reflect the post slug.
    expect(page.url()).toMatch(/\/journal\/[a-z0-9-]+/);
  });
});

test.describe("section pages (promoted off the home page)", () => {
  test("Story opens /story and the big back header returns to For You", async ({ page }) => {
    await page.goto("/");

    // Open /story via the home "Our Story" Explore card. It renders on
    // both mobile and desktop, unlike the desktop-only top-nav "Story"
    // link that the mobile bottom-nav redesign dropped. The card's
    // accessible name is "Our Story — Armenia → Cypress".
    await page.getByRole("button", { name: /our story.*armenia.*cypress/i }).click();
    await expect(page).toHaveURL(/\/story\/?$/, { timeout: 5_000 });

    // The promoted page renders the big "‹ For You" back control.
    const back = page.getByRole("button", { name: /back to the for you page/i });
    await expect(back).toBeVisible({ timeout: 5_000 });

    // Tapping it returns to the For You home and resets the URL to root.
    await back.click();
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
  });
});
