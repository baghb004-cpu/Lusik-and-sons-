import type { Metadata } from "next";
import { WelcomeRoute } from "../../src/routes/WelcomeRoute.jsx";
import { pageMetadata } from "../../src/lib/seo.js";

export const metadata: Metadata = pageMetadata({
  title: "Welcome",
  description:
    "Where the printed card lands: how to order from Lusik & Sons, why colors vary, how long a hand cross-stitched piece takes, what to do with a coupon code, and how to care for a piece once it arrives.",
  path: "/welcome",
});

export default function Page() {
  return <WelcomeRoute />;
}
