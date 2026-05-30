import type { Metadata } from "next";
import { HomeRoute } from "../../src/routes/HomeRoute.jsx";
import { pageMetadata } from "../../src/lib/seo.js";

export const metadata: Metadata = pageMetadata({
  title: "From Lusik's Workshop",
  description:
    "Inside Lusik's workshop — how each Armenian alphabet blanket is cross-stitched by hand, made to order.",
  path: "/workshop",
  type: "article",
});

export default function Page() {
  return <HomeRoute pageSlug="workshop" />;
}
