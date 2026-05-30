import type { Metadata } from "next";
import { AccountRoute } from "../../src/routes/AccountRoute.jsx";

// Private — keep out of the index.
export const metadata: Metadata = { title: "Your Account", robots: { index: false, follow: false } };

export default function Page() {
  return <AccountRoute />;
}
