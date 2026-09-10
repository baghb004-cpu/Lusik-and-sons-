import type { Metadata } from "next";
import { DesignRoute } from "../../../src/routes/DesignRoute.jsx";
import { pageMetadata } from "../../../src/lib/seo.js";
import { decodeDesignFromUrl, fromUrlSafe } from "../../../src/lib/designUrl";

type Params = { design: string };

// The share card. The name comes out of the same blob the page renders,
// so what a friend sees in the message preview is what they will see on
// the page.
//
// The IMAGE is the product's own photograph rather than a render of this
// particular design: composing one at request time would mean running a
// text renderer per share, with a font it would have to be handed, on a
// route anybody can call with any string. The photograph is honest about
// what the piece is, and it exists.
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { design } = await params;
  const compact = decodeDesignFromUrl(fromUrlSafe(design ?? ""));
  const name = typeof compact?.n1 === "string" ? compact.n1.trim().slice(0, 24) : "";
  return {
    ...pageMetadata({
      title: name ? `A blanket for ${name}` : "A blanket design",
      description: name
        ? `Someone is having Lusik hand cross-stitch an Armenian alphabet blanket for ${name}. Here is the design.`
        : "An Armenian alphabet blanket design, hand cross-stitched to order by Lusik.",
      path: `/design/${design ?? ""}`,
      image: "/img/abc-blanket/cover.jpg",
    }),
    // A shared design is somebody's private message to a friend, not a
    // page this shop wants in a search index.
    robots: { index: false, follow: true },
  };
}

export default function Page() {
  return <DesignRoute />;
}
