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
  test("loads without console errors and shows brand + product", async ({ page, isMobile }) => {
    const errors = [];
    watchForConsoleErrors(page, errors);

    await page.goto("/");
    // "Lusik & Sons" renders in several places — the desktop top-nav (hidden at
    // mobile breakpoints via lg:), the footer (desktop-only), and the home
    // content footer line. Assert a VISIBLE instance so this liveness check
    // holds on both the desktop and mobile projects (plain .first() resolved to
    // the hidden desktop-nav brand on mobile and timed out).
    await expect(
      page.getByText("Lusik & Sons").filter({ visible: true }).first()
    ).toBeVisible();
    // Hero CTA liveness signal — now viewport-dependent. On desktop the brand
    // hero shows the "See what Lusik makes" CTA. On mobile the For You page
    // collapses to the Apple-Store card layout (the hero + its CTA are hidden
    // via `simplified`), so assert the leading "Selected for you" product card
    // instead — the equivalent mobile liveness signal.
    if (isMobile) {
      await expect(
        page.getByRole("button", { name: /selected for you/i })
      ).toBeVisible({ timeout: 10_000 });
    } else {
      await expect(
        page.getByRole("button", { name: /see what lusik makes/i })
      ).toBeVisible({ timeout: 10_000 });
    }

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

  test("tapping a bag item jumps back to its product page", async ({ page }) => {
    // Add the blanket, land in the drawer via the post-add sheet, then
    // tap the item's title — it should close the drawer and navigate to
    // the canonical PDP so the customer can re-read the full page.
    await page.goto("/shop/blankets/armenian-alphabet-blanket");
    await page.getByRole("button", { name: /^Armenian\b/ }).first().click();
    await page.getByRole("button", { name: /add to bag.*\$/i }).first().click();
    await page.getByRole("button", { name: /^continue$/i }).first().click();

    await page.getByRole("button", { name: /view .* product page/i }).first().click();
    await expect(page).toHaveURL(/\/shop\/blankets\/armenian-alphabet-blanket$/, { timeout: 5_000 });
    // Drawer is gone — its "Your cart" heading is no longer visible.
    await expect(page.getByRole("heading", { name: /^your cart$/i })).not.toBeVisible();
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

    // Add now opens the Apple-style "You may also like" sheet first; its
    // Continue button proceeds to the bag (drawer on desktop, /cart page
    // on mobile), where the added item appears. The row's title is a
    // tap-back-to-product button (aria-label "View <name> product page"),
    // so assert on that semantic control rather than a <p>.
    await page.getByRole("button", { name: /^continue$/i }).first().click();
    await expect(
      page.getByRole("button", { name: /armenian alphabet blanket product page/i }).first()
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

    // Add opens the "You may also like" sheet → Continue opens the bag → Checkout.
    await page.getByRole("button", { name: /^continue$/i }).first().click();
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
    // The ZIP→city/state confirmation echo (first-party zip-lookup).
    await page.route("**/.netlify/functions/zip-lookup*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ zip: "90630", city: "Cypress", state: "CA" }),
      }));

    // Direct-nav to the blanket PDP (same reason as the test above).
    await page.goto("/shop/blankets/armenian-alphabet-blanket");
    // Picker button's accessible name is "Armenian Ա Բ Գ" (label + glyphs).
    // Match just the label so we don't depend on the exact glyph rendering.
    await page.getByRole("button", { name: /^Armenian\b/ }).first().click();
    await page.getByRole("button", { name: /add to bag.*\$/i }).first().click();
    await page.getByRole("button", { name: /^continue$/i }).first().click();
    await page.getByRole("button", { name: /^checkout/i }).click();
    // Below the free-shipping threshold the shipping ZIP is required
    // (it prices the zone-based rate) — the Pay button stays disabled
    // until a valid ZIP is in.
    await page.getByLabel(/shipping zip code/i).first().fill("90630");
    // The city/state echo confirms the typed ZIP before paying.
    await expect(page.getByText(/Cypress, CA 90630/)).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: /pay with stripe/i }).first().click();

    // Wait for the route handler to capture the request.
    await expect.poll(() => receivedBody, { timeout: 5_000 }).not.toBeNull();
    expect(Array.isArray(receivedBody.cart)).toBe(true);
    expect(receivedBody.cart.length).toBeGreaterThan(0);
    // The destination ZIP must ride along — it's what the server
    // prices the zone-based shipping option from.
    expect(receivedBody.ship_zip).toBe("90630");
    // Every cart item must carry a productKey, and it must be in the
    // shape TRUSTED_PRODUCTS recognizes (starts with "blanket-" or
    // "bib"). This is the assertion that would have failed during
    // the cart-ID mismatch bug.
    for (const item of receivedBody.cart) {
      expect(item.productKey, `cart item missing productKey: ${JSON.stringify(item)}`).toBeTruthy();
      expect(item.productKey).toMatch(/^(blanket-|bib)/);
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

  test("Buy it now sends exactly one item straight to checkout", async ({ page, isMobile }) => {
    // Express "Buy it now" is a DESKTOP-only control now: on mobile the
    // persistent MobilePurchaseBar shows a single pinned "Add to Bag"
    // (the in-flow PurchaseCard — which holds Buy-it-now — is hidden via
    // `hidden lg:block`). Mobile buyers use Add-to-Bag → checkout instead.
    test.skip(isMobile, "Express Buy-it-now is desktop-only; mobile uses the sticky Add-to-Bag sheet.");
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
    await page.getByLabel(/shipping zip code/i).first().fill("90630");
    await page.getByRole("button", { name: /pay with stripe/i }).first().click();

    await expect.poll(() => receivedBody, { timeout: 5_000 }).not.toBeNull();
    expect(Array.isArray(receivedBody.cart)).toBe(true);
    // Express checkout is a single transient item — never the whole bag.
    expect(receivedBody.cart.length).toBe(1);
    expect(receivedBody.cart[0].productKey).toBeTruthy();
    expect(receivedBody.cart[0].productKey).toMatch(/^(blanket-|bib)/);
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

  test("live Full Alphabet Crib Blanket page shows the buy flow", async ({ page }) => {
    // The Full Alphabet Crib Blanket is now LIVE (no longer a placeholder).
    // Navigate straight to the PDP — the home→shop→category hierarchy is
    // already covered by the test above, and the crib blanket appears on
    // the category page in both the grid and a "heirloom" feature card, so
    // a card-based click would be ambiguous.
    await page.goto("/shop/blankets/full-alphabet-crib-blanket");

    // Product name in the page heading — confirms the live PDP rendered.
    await expect(
      page.getByRole("heading", { name: /full alphabet crib blanket/i })
    ).toBeVisible({ timeout: 5_000 });

    // The live configurator: the Apple-style color row (a "Blue" swatch
    // radio under the gallery) + an Add-to-Cart button priced at the
    // server-trusted $245 (CribBlanketCard).
    await expect(page.getByRole("radio", { name: /^Blue$/ }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /\$245/ }).first()).toBeVisible({ timeout: 5_000 });
  });

  test("live heritage bib set page wires options into a custom add", async ({ page }) => {
    // The hand cross-stitched heritage bibs (e.g. the Bari Akhorzhak set)
    // are live BibSetCard surfaces with a thread-color picker + an optional
    // matching cap. Assert the page renders the buy flow and that adding it
    // POSTs a cart with the heritage productKey shape (bib-...), proving the
    // server-trusted SKU mapping is wired — not the legacy $22 `bib` key.
    let receivedBody = null;
    await page.route("**/.netlify/functions/create-checkout-session*", async (route) => {
      receivedBody = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: null }) });
    });

    await page.goto("/shop/bibs/bari-akhorzhak-bib-burp-cloth-set");
    await expect(
      page.getByRole("heading", { name: /bari akhorzhak/i })
    ).toBeVisible({ timeout: 10_000 });

    // Add to bag (base price $40 since the June 2026 price drop; the
    // Founding-Price promo is retired). Then drive the same in-app
    // add → Checkout → Pay path the blanket checkout test uses, so the
    // in-memory cart survives (a hard nav would wipe it).
    // Scope to the VISIBLE instance: on phones this product renders in
    // the immersive pill sheet, which keeps the (hidden) MobilePurchaseBar
    // add button in the DOM — .first() alone would resolve to that hidden
    // twin and wait forever.
    await page
      .getByRole("button", { name: /add to bag.*40/i })
      .filter({ visible: true })
      .first()
      .click();
    // Add opens the "You may also like" sheet → Continue opens the bag.
    await page.getByRole("button", { name: /^continue$/i }).first().click();
    await page.getByRole("button", { name: /^checkout/i }).click();
    // Shipping ZIP is required below the free-shipping threshold —
    // it prices the zone-based rate before the Stripe hand-off.
    await page.getByLabel(/shipping zip code/i).first().fill("90630");
    await page.getByRole("button", { name: /pay with stripe/i }).first().click();

    await expect.poll(() => receivedBody, { timeout: 8_000 }).not.toBeNull();
    const keys = receivedBody.cart.map((i) => i.productKey);
    expect(keys.some((k) => /^bib-bari-akhorzhak-set/.test(k))).toBe(true);
    for (const item of receivedBody.cart) {
      expect(item.productKey).toMatch(/^(blanket-|bib)/);
    }
  });

  test("immersive sheet: photo tap collapses the card, second tap opens the zoom viewer", async ({ page, isMobile }) => {
    test.skip(!isMobile, "The immersive pill sheet is mobile-only (touch taps required).");
    // The pill-sheet products (bib sets + crib blanket) open with the buy
    // card at medium height over the photo backdrop. Tapping the photo
    // behind the card collapses it to the pill; tapping the photo again
    // opens the zoomable full-photo lightbox (object-contain, all edges
    // visible). This is the detent-aware tap contract.
    await page.goto("/shop/bibs/bari-akhorzhak-bib-burp-cloth-set");
    const gallery = page.locator('[class*="ImmersiveBuySheet_gallery"]').first();
    await expect(gallery).toBeVisible({ timeout: 10_000 });

    // Tap the photo peeking above the medium sheet → collapses to the
    // pill (whose accessible name flips to "Expand product details").
    await gallery.tap({ position: { x: 196, y: 150 } });
    await expect(
      page.getByRole("button", { name: /expand product details/i })
    ).toBeVisible({ timeout: 5_000 });

    // Tap the photo again → the zoom viewer opens; close it via the X.
    await gallery.tap({ position: { x: 196, y: 300 } });
    const dialog = page.getByRole("dialog", { name: /photo viewer/i });
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: /close photo viewer/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("a sold-out product shows the graceful sold-out state + notify", async ({ page }) => {
    // Stub the public availability snapshot so the Days-of-the-Week set
    // reads as sold out (remaining 0). The real cap is server-enforced at
    // checkout; this exercises the front-of-house sold-out UX.
    await page.route("**/.netlify/functions/inventory*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ inventory: { "bib-days-of-week": { remaining: 0, limit: 5, soldOut: true } } }),
      });
    });

    await page.goto("/shop/bibs/days-of-the-week-bib-set");
    await expect(page.getByRole("heading", { name: /days-of-the-week/i })).toBeVisible({ timeout: 10_000 });

    // Warm sold-out copy + a restock-notify button, and NO add-to-bag.
    await expect(page.getByText(/sold out for now/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: /notify me when it.s back/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /add to bag/i })).toHaveCount(0);
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
    // accessible name is "Our Story — Armenia → California".
    await page.getByRole("button", { name: /our story.*armenia.*california/i }).click();
    await expect(page).toHaveURL(/\/story\/?$/, { timeout: 5_000 });

    // The promoted page renders the big "‹ For You" back control.
    const back = page.getByRole("button", { name: /back to the for you page/i });
    await expect(back).toBeVisible({ timeout: 5_000 });

    // Tapping it returns to the For You home and resets the URL to root.
    await back.click();
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
  });
});
