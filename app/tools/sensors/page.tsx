// /tools/sensors — the Sensor Interaction Builder (§30, Phase 7).
// Server shell only; the builder is a client bundle loaded dynamically. Noindexed.

import type { Metadata } from "next";
import { SensorsRoute } from "../../../src/builder/studio/sensors/ui/SensorsRoute.tsx";

export const metadata: Metadata = {
  title: "Sensor Builder",
  robots: { index: false, follow: false },
};

export default function SensorsPage() {
  return <SensorsRoute />;
}
