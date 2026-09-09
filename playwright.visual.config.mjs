// ============================================================
// Playwright config — visual-regression baselines
// ============================================================
// Same production build + server as the e2e config, different test
// directory and a snapshot folder committed to the repo. Run:
//   npm run test:visual                    compare against baselines
//   npm run test:visual -- --update-snapshots   accept a deliberate change
// Baselines live in tests/visual/__snapshots__/<project>/. Update them
// only in the PR that intentionally changes a page, and say so in the
// PR body. See SITE_OVERHAUL_HANDOFF.md section 0.2.
// ============================================================
import { defineConfig } from "@playwright/test";
import base from "./playwright.config.mjs";

export default defineConfig({
  ...base,
  testDir: "./tests/visual",
  retries: 0,
  snapshotPathTemplate: "{testDir}/__snapshots__/{projectName}/{arg}{ext}",
  expect: {
    ...base.expect,
    timeout: 45_000, // stability polling for full-page captures of photo-heavy pages
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
});
