// /builder — the visual builder / CMS shell (admin-only).
// Server shell only; the editor itself is a client bundle loaded
// dynamically from BuilderRoute, so this route costs the public
// site nothing and search engines are told to stay out.

import type { Metadata } from "next";
import { BuilderRoute } from "../../src/builder/editor/BuilderRoute.tsx";

export const metadata: Metadata = {
  title: "Baghdo’s Workshop",
  robots: { index: false, follow: false },
};

export default function BuilderPage() {
  return <BuilderRoute />;
}
