// /tools/embroidery — Embroidery Studio: counted cross-stitch design + an
// experimental DST machine-file export (§31, Phase 5). Offline; noindexed.

import type { Metadata } from "next";
import { EmbroideryRoute } from "../../../src/builder/studio/software/embroidery/ui/EmbroideryRoute.tsx";

export const metadata: Metadata = {
  title: "Embroidery Studio",
  robots: { index: false, follow: false },
};

export default function EmbroideryPage() {
  return <EmbroideryRoute />;
}
