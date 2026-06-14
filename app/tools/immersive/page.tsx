// /tools/immersive — the Immersive Builder (scroll-story 3D, §30 Phase 2).
// Server shell only; the builder is a client bundle loaded dynamically. Noindexed.

import type { Metadata } from "next";
import { ImmersiveRoute } from "../../../src/builder/studio/immersive/ui/ImmersiveRoute.tsx";

export const metadata: Metadata = {
  title: "Immersive Builder",
  robots: { index: false, follow: false },
};

export default function ImmersivePage() {
  return <ImmersiveRoute />;
}
