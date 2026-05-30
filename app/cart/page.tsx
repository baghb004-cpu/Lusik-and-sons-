import type { Metadata } from "next";
import { CartRoute } from "../../src/routes/CartRoute.jsx";

export const metadata: Metadata = { title: "Your Bag", robots: { index: false, follow: false } };

export default function Page() {
  return <CartRoute />;
}
