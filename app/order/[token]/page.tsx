import type { Metadata } from "next";
import { OrderFollowRoute } from "../../../src/routes/OrderFollowRoute.jsx";

// The signed follow-along link from a customer's email. Read-only, and
// deliberately kept out of search results: the URL is a capability, so
// it should never be crawled, indexed, or listed in the sitemap.
export const metadata: Metadata = {
  title: "Your order · Lusik & Sons",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <OrderFollowRoute />;
}
