import type { Metadata } from "next";
import { GalleryRoute } from "../../src/routes/GalleryRoute.jsx";
import { pageMetadata } from "../../src/lib/seo.js";

export const metadata: Metadata = pageMetadata({
  title: "Gallery",
  description:
    "A gallery of finished Lusik & Sons pieces — hand cross-stitched Armenian alphabet blankets and more.",
  path: "/gallery",
});

export default function Page() {
  return <GalleryRoute />;
}
