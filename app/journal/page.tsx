import type { Metadata } from "next";
import { JournalRoute } from "../../src/routes/JournalRoute.jsx";
import { pageMetadata } from "../../src/lib/seo.js";

export const metadata: Metadata = pageMetadata({
  title: "Journal",
  description:
    "Lusik's Journal — short essays on Armenian craft heritage: the alphabet, cross-stitch, the pomegranate, and the meaning behind the pieces.",
  path: "/journal",
});

export default function Page() {
  return <JournalRoute />;
}
