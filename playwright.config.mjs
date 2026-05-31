// ============================================================
// Playwright config — E2E smoke tests against the Next.js build
// ============================================================
// TEMPORARY: webServer runs `next dev` (not next start) so React's
// hydration errors surface NON-MINIFIED in the console — the e2e
// "loads without console errors" test then reports the exact element.
// Revert to `next build && next start` once the hydration mismatch is fixed.
// ============================================================
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 800 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run next:dev -- --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 300_000,
  },
});
