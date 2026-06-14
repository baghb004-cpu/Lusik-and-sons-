// /tools/media-studio — the offline Media Studio (Phase 1 UI).
// Server shell only; the studio is a client bundle loaded dynamically.
// Noindexed — it's a personal, local tool.

import type { Metadata } from "next";
import { MediaStudioRoute } from "../../../src/builder/media-studio/ui/MediaStudioRoute.tsx";

export const metadata: Metadata = {
  title: "Media Studio",
  robots: { index: false, follow: false },
};

export default function MediaStudioPage() {
  return <MediaStudioRoute />;
}
