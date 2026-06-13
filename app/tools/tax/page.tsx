// /tools/tax — the private offline Tax Assistant (Phase 1 UI).
// Server shell only; the assistant is a client bundle, noindexed.
// Everything runs in the browser; nothing is uploaded.

import type { Metadata } from "next";
import { TaxRoute } from "../../../src/builder/tax/ui/TaxRoute.tsx";

export const metadata: Metadata = {
  title: "Tax Assistant",
  robots: { index: false, follow: false },
};

export default function TaxPage() {
  return <TaxRoute />;
}
