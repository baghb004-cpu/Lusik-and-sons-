import type { Metadata } from "next";
import { HomeRoute } from "../../src/routes/HomeRoute.jsx";
import { pageMetadata } from "../../src/lib/seo.js";

export const metadata: Metadata = pageMetadata({
  title: "Shipping & Tracking",
  description:
    "Shipping, tracking, and returns for Lusik & Sons hand-stitched pieces.",
  path: "/shipping",
});

export default function Page() {
  return <HomeRoute pageSlug="shipping" />;
}
