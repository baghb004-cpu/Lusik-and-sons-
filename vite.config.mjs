// ============================================================
// Vite configuration — Lusik & Sons SPA migration
// ============================================================
// This config is in place but NOT yet wired into the Netlify
// deploy. The current production deploy still serves the
// hand-edited index.html from the repo root (netlify.toml has
// `publish = "."` and `command = ""`). When the migration is
// complete and the old <script type="text/babel"> block has
// been deleted from index.html, the netlify.toml flip is:
//
//   [build]
//     publish = "dist"
//     command = "npm ci && npm run build"
//
// Until then, `npm run build` works locally for testing the
// migration progress without affecting production.
//
// See CLAUDE.md § "Vite migration (in progress)" for the full
// step-by-step plan and current checkpoint.
// ============================================================

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // Output a flat `dist/` (Netlify will serve this as the publish
  // dir post-migration). `assetsDir` keeps the hashed JS/CSS
  // bundle filenames under `dist/assets/`.
  build: {
    outDir: "dist",
    assetsDir: "assets",
    target: "es2020",
    sourcemap: true,
    // IMPORTANT: do NOT auto-inline assets into the JS bundle.
    // The current index.html has base64 product photos that need
    // to migrate to /public/img/*.jpg — and Vite's default 4 KB
    // assetsInlineLimit would silently inline anything small
    // enough, bloating the JS instead of caching the photos
    // separately. Forcing 0 makes the migration's intent explicit.
    assetsInlineLimit: 0,
  },

  // Local dev convenience: when an engineer runs `vite` directly
  // (instead of `netlify dev`), proxy function calls to the
  // Netlify dev server on its default port so Identity + Functions
  // still work. The recommended workflow is still `netlify dev`
  // — this proxy is the safety net.
  server: {
    port: 5173,
    proxy: {
      "/.netlify/functions": {
        target: "http://localhost:9999",
        changeOrigin: false,
      },
      "/api": {
        target: "http://localhost:9999",
        changeOrigin: false,
      },
    },
  },
});
