// /tools/store — Store Manager, the offline small-business app (§30, Phase 4).
// Server shell only; the app is a client bundle loaded dynamically. Noindexed.

import type { Metadata } from "next";
import { StoreRoute } from "../../../src/builder/studio/store/ui/StoreRoute.tsx";

export const metadata: Metadata = {
  title: "Store Manager",
  robots: { index: false, follow: false },
};

export default function StorePage() {
  return <StoreRoute />;
}
