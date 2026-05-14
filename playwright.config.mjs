// ============================================================
// Playwright config — browser smoke tests for the Lusik & Sons SPA
// ============================================================
// What this runs:
//   `npm run test:e2e`    headless Chromium against a local static
//                         server (no Netlify Functions, no Identity,
//                         no Stripe). Backend calls are stubbed via
//                         Playwright's `route` API inside each test.
//   `npm run test:e2e:ui` same tests, with Playwright's interactive
//                         UI mode so you can step through visually.
//
// Why not netlify dev? Netlify CLI adds setup friction (login,
// site link, env var pull) and is slow to spin up — these tests
// are smoke tests, not integration tests against real backends.
// They catch the kind of bugs that broke the site mid-session
// (JSX runtime crashes, missing imports, broken routes, cart
// flow regressions) without depending on production services.
//
// The `webServer` block automatically launches `npx serve` before
// the tests run and tears it down after, so you don't have to
// remember to start anything yourself.
// ============================================================

import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // One worker is plenty for a small suite and avoids flaky races
  // on the shared server. Bump if/when the suite grows past 30s.
  workers: 1,
  // Fail fast in CI; keep verbose locally.
  reporter: process.env.CI ? "github" : "list",
  // Auto-retry once in CI to absorb transient flakiness; never
  // retry locally (real bugs should surface, not get hidden).
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    // Mobile + desktop both matter for this site (lots of mobile-
    // specific code), but desktop is the default; mobile is a
    // separate project below.
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  // `npx serve` boots a tiny static server on `index.html`. Playwright
  // waits for it to respond on the port before running tests, and
  // tears it down on exit. `reuseExistingServer` lets a long-running
  // local server (if you happen to have one) skip the boot — handy
  // for `npm run test:e2e:ui`.
  webServer: {
    command: `npx --yes serve -l ${PORT} -s .`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 30_000,
  },
});
