import type { Metadata } from "next";
import { AdminRoute } from "../../src/routes/AdminRoute.jsx";

// Admin-only — never index.
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function Page() {
  return <AdminRoute />;
}
