// Root layout — Next.js App Router migration (Phase 2).
// Not yet wired into production (the Vite build still serves the site via
// netlify.toml publish = "dist"). Global providers (LangProvider,
// ToastProvider, Identity init) get mounted here as a client boundary in a
// later phase — see NEXTJS_MIGRATION_PLAN.md.
//
// globals.css re-exports the canonical stylesheet (src/styles/index.css) so
// Next and Vite share one source of truth during the migration.
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Lusik & Sons",
  description:
    "Hand cross-stitched Armenian alphabet baby blankets, made to order in Cypress, California.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
