import type { Metadata } from "next";
import { ReturnsRoute } from "../../src/routes/ReturnsRoute.jsx";
import { pageMetadata } from "../../src/lib/seo.js";

export const metadata: Metadata = pageMetadata({
  title: "Returns & Exchanges",
  description:
    "Lusik & Sons returns policy — every piece is made to order, so change-of-mind returns aren't possible, but defective, damaged, or incorrect orders are repaired, remade, or refunded within 14 days of delivery, free of any fees.",
  path: "/returns",
});

export default function Page() {
  return <ReturnsRoute />;
}
