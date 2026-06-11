import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Host/port tuned for Replit's webview: bind all interfaces, take the
// workspace PORT when provided, and pin HMR to 443 since the webview is
// served over https. Runs identically with plain `npm run dev` locally.
// The backend (lusikandsons.com Netlify Functions) is deliberately
// same-origin-only — no CORS headers, by design. The app therefore
// calls RELATIVE /.netlify/functions/* URLs and this proxy forwards
// them server-side, exactly like `netlify dev` does for the website.
// Bonus: in local dev the function sees a localhost Origin, which is
// on the server's return-URL allowlist — so Stripe's ?order=success
// comes back to the app end-to-end.
const functionsProxy = {
  "/.netlify": {
    target: "https://lusikandsons.com",
    changeOrigin: false, // keep the browser's Origin (localhost is allowlisted)
    secure: true,
    headers: { host: "lusikandsons.com" },
  },
};

export default defineConfig({
  plugins: [react()],
  // Inline (empty) PostCSS config — without it Vite walks up the repo and
  // finds the website's root postcss.config.mjs (Tailwind), whose plugins
  // aren't installed here.
  css: { postcss: { plugins: [] } },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 3000,
    hmr: { clientPort: 443 },
    proxy: functionsProxy,
  },
  preview: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 3000,
    proxy: functionsProxy,
  },
});
