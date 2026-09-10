import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewRoute } from "../../../src/routes/ReviewRoute.jsx";

// A capability URL for one order. It has no business in a search index,
// and it carries no description worth sharing.
export const metadata: Metadata = {
  title: "How is it holding up?",
  robots: { index: false, follow: false },
};

export default function Page() {
  // Suspense because the route reads useSearchParams for the order id,
  // which Next requires a boundary around during prerendering.
  return (
    <Suspense fallback={null}>
      <ReviewRoute />
    </Suspense>
  );
}
