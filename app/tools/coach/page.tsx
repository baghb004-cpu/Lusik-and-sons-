// /tools/coach — the offline Communication Coach (§28).
// Server shell only; the coach is a client bundle loaded dynamically.
// Noindexed — it's a personal, local coaching tool.

import type { Metadata } from "next";
import { CoachRoute } from "../../../src/builder/coach/ui/CoachRoute.tsx";

export const metadata: Metadata = {
  title: "Communication Coach",
  robots: { index: false, follow: false },
};

export default function CoachPage() {
  return <CoachRoute />;
}
