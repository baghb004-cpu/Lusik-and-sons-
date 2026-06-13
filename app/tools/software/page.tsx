// /tools/software — Software Creation Mode, "visual vibe coding" (§31, Phase 1).
// Server shell only; the builder is a client bundle loaded dynamically. Noindexed.

import type { Metadata } from "next";
import { SoftwareRoute } from "../../../src/builder/studio/software/ui/SoftwareRoute.tsx";

export const metadata: Metadata = {
  title: "Software Creation",
  robots: { index: false, follow: false },
};

export default function SoftwarePage() {
  return <SoftwareRoute />;
}
