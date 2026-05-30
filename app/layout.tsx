// Root layout — Phase 1 scaffold for the Next.js App Router migration.
// Not yet wired into production (the Vite build still serves the site).
// Global providers (LangProvider, ToastProvider, Identity init) will be
// mounted here as a client boundary in a later phase — see
// NEXTJS_MIGRATION_PLAN.md.
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
