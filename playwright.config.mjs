// ============================================================
// Playwright config — E2E smoke tests against the Next.js build
// ============================================================
// Runs the e2e suite the same way Netlify serves the site: a real
// production build (`next build`) served by `next start`. This is what's
// deployed, so the tests exercise the shipped output (pre-compiled routes,
// minified bundles, production React) rather than the dev server.
//
// `next:build` runs its `prenext:build` hook first (generates
// src/data/journalPostsData.js), so the search index is present before the
// build. The server gets a generous boot budget (build + start) via the
// webServer timeout.
// ============================================================
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  retries: 2,
  timeout: 300_000,
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
    { name: "mobile-chromium", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: `npm run next:build && npx next start --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 300_000,
  },
});
