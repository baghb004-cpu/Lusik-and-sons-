// ============================================================
// Playwright config — browser smoke tests for the Lusik & Sons SPA
// ============================================================
// What this runs:
//   `npm run test:e2e`    headless Chromium against a local
//                         `vite preview` server (no Netlify
//                         Functions, no Identity, no Stripe).
//                         Backend calls are stubbed via
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
// The `webServer` block automatically:
//   1. Builds the SPA (`vite build` produces dist/)
//   2. Serves dist/ on PORT (`vite preview`)
//   3. Waits for the server to respond before running tests
//   4. Tears it down on exit
// `reuseExistingServer` skips steps 1-2 when running locally if
// you already have `vite preview` running — handy for the UI mode.
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
  // Build + preview. Post-Vite-flip the repo root index.html is a
  // minimal entry that references /src/main.jsx as a module — that
  // means we NEED a build step before serving, because a raw .jsx
  // file can't be executed by the browser. `vite preview` serves
  // the built dist/ folder. The `&&` chain handles both steps in
  // one webServer command; Playwright then waits for the port.
  //
  // Build cost: ~2 seconds. Wait timeout bumped to 90s for CI cold
  // cache (where npm just installed and Vite has nothing primed).
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 90_000,
  },
});
