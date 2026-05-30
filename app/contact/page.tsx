import type { Metadata } from "next";
import { HomeRoute } from "../../src/routes/HomeRoute.jsx";
import { pageMetadata } from "../../src/lib/seo.js";

export const metadata: Metadata = pageMetadata({
  title: "Contact Lusik",
  description:
    "Get in touch with Lusik & Sons — questions about a piece, a commission, or an order.",
  path: "/contact",
});

export default function Page() {
  return <HomeRoute pageSlug="contact" />;
}
