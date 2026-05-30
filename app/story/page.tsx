import type { Metadata } from "next";
import { HomeRoute } from "../../src/routes/HomeRoute.jsx";
import { pageMetadata } from "../../src/lib/seo.js";

export const metadata: Metadata = pageMetadata({
  title: "Our Story",
  description:
    "The story of Lusik & Sons — from Armenia to Cypress, California, and the hand cross-stitch craft passed down through the family.",
  path: "/story",
  type: "article",
});

export default function Page() {
  return <HomeRoute pageSlug="story" />;
}
