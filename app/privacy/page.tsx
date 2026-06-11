import type { Metadata } from "next";
import { Suspense } from "react";
import { PrivacyRoute } from "../../src/routes/PrivacyRoute.jsx";
import { pageMetadata } from "../../src/lib/seo.js";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How Lusik & Sons handles your information — what we collect to make and ship your order, who can see it, the advertising opt-out switch, and your California privacy rights.",
  path: "/privacy",
});

export default function Page() {
  // Suspense because PrivacyRoute reads useSearchParams (the ?choices=1
  // deep link to the do-not-share switch) — Next requires a boundary
  // around search-param readers during static prerendering.
  return (
    <Suspense fallback={null}>
      <PrivacyRoute />
    </Suspense>
  );
}
