// /tools/business-app — the Business App Builder (§30, Phase 3).
// Server shell only; the builder is a client bundle loaded dynamically. Noindexed.

import type { Metadata } from "next";
import { BusinessAppRoute } from "../../../src/builder/studio/bizapp/ui/BusinessAppRoute.tsx";

export const metadata: Metadata = {
  title: "Business App Builder",
  robots: { index: false, follow: false },
};

export default function BusinessAppPage() {
  return <BusinessAppRoute />;
}
