// ============================================================
// Playwright config — E2E smoke tests against the Next.js build
// ============================================================
// The site is served by Next.js (Vite retired). The webServer block
// runs `next build` then `next start`, and Playwright waits for the
// port before running the suite.
//
// Timeouts are generous because some routes (the product configurator)
// are client-only `dynamic(ssr:false)` components that hydrate after
// the initial HTML, so interactions can land a beat later than on a
// pre-hydrated SPA.
// ============================================================
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  retries: process.env.CI ? 2 : 0,
  // Per-test budget — room for next build's client chunks to hydrate.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 800 },
    // Auto-wait budgets for clicks/fills and navigations.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  // Build + serve the Next app. `next build` runs first (slow on a cold
  // CI cache), then `next start`; the 300s timeout covers both.
  webServer: {
    command: `npm run next:build && npx next start --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 300_000,
  },
});
