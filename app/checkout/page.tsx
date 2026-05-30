import type { Metadata } from "next";
import { CheckoutRoute } from "../../src/routes/CheckoutRoute.jsx";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default function Page() {
  return <CheckoutRoute />;
}
