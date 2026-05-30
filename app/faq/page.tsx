import type { Metadata } from "next";
import { HomeRoute } from "../../src/routes/HomeRoute.jsx";
import { pageMetadata } from "../../src/lib/seo.js";

export const metadata: Metadata = pageMetadata({
  title: "Good Questions",
  description:
    "Answers about Lusik & Sons' hand-stitched pieces — sizing, materials, made-to-order timing, shipping, and returns.",
  path: "/faq",
});

export default function Page() {
  return <HomeRoute pageSlug="faq" />;
}
