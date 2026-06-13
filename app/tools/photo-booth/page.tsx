// /tools/photo-booth — the Event Photo Booth Builder (§30, Phase 8).
// Server shell only; the builder is a client bundle loaded dynamically. Noindexed.

import type { Metadata } from "next";
import { PhotoBoothRoute } from "../../../src/builder/studio/photobooth/ui/PhotoBoothRoute.tsx";

export const metadata: Metadata = {
  title: "Photo Booth Builder",
  robots: { index: false, follow: false },
};

export default function PhotoBoothPage() {
  return <PhotoBoothRoute />;
}
