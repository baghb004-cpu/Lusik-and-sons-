// /tools/tour — the Virtual Tour Builder (360 photo/video, §30 Phase 6).
// Server shell only; the builder is a client bundle loaded dynamically. Noindexed.

import type { Metadata } from "next";
import { TourRoute } from "../../../src/builder/studio/tour/ui/TourRoute.tsx";

export const metadata: Metadata = {
  title: "Virtual Tour Builder",
  robots: { index: false, follow: false },
};

export default function TourPage() {
  return <TourRoute />;
}
