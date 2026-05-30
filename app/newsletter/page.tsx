import type { Metadata } from "next";
import { HomeRoute } from "../../src/routes/HomeRoute.jsx";
import { pageMetadata } from "../../src/lib/seo.js";

export const metadata: Metadata = pageMetadata({
  title: "Stay Connected",
  description:
    "Stay connected with Lusik & Sons — new pieces, journal posts, and the occasional note from the workshop.",
  path: "/newsletter",
});

export default function Page() {
  return <HomeRoute pageSlug="newsletter" />;
}
