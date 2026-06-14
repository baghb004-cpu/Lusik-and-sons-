// /tools — Creation Studio hub: one front door for every offline tool (§30 P1).
// Noindexed; the tools themselves are personal/local.

import type { Metadata } from "next";
import { StudioHub } from "../../src/builder/studio/ui/StudioHub.tsx";

export const metadata: Metadata = {
  title: "Creation Studio",
  robots: { index: false, follow: false },
};

export default function ToolsHubPage() {
  return <StudioHub />;
}
