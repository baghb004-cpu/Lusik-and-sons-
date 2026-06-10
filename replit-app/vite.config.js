import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Host/port tuned for Replit's webview: bind all interfaces, take the
// workspace PORT when provided, and pin HMR to 443 since the webview is
// served over https. Runs identically with plain `npm run dev` locally.
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
  },
  preview: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 3000,
  },
});
