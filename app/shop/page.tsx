import type { Metadata } from "next";
import { ShopIndexRoute } from "../../src/routes/ShopIndexRoute.jsx";
import { pageMetadata } from "../../src/lib/seo.js";

export const metadata: Metadata = pageMetadata({
  title: "Shop",
  description:
    "Shop Lusik & Sons — hand cross-stitched Armenian alphabet blankets, bibs, and heirloom pieces, made to order in Cypress, California.",
  path: "/shop",
});

export default function Page() {
  return <ShopIndexRoute />;
}
