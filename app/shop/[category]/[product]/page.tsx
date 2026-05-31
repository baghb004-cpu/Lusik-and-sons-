import type { Metadata } from "next";
import { CATALOG, getProductBySlugs } from "../../../../src/data/catalog.js";
import { pageMetadata, productJsonLd, jsonLdScript } from "../../../../src/lib/seo.js";
import { ProductRoute } from "../../../../src/routes/ProductRoute.jsx";

type Params = { category: string; product: string };

// Prerender every catalog product page at build (SSG) so each indexes with
// its own SSR <head> + structured data.
export function generateStaticParams(): Params[] {
  const params: Params[] = [];
  for (const category of Object.values(CATALOG) as any[]) {
    for (const product of category.products) {
      params.push({ category: category.slug, product: product.slug });
    }
  }
  return params;
}

// Next 15: `params` is async and must be awaited.
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category, product } = await params;
  const pair = getProductBySlugs(category, product);
  if (!pair) return {};
  // `pair.product` is inferred as a union of catalog literals; coverImage /
  // gallery exist only on some members, so cast for the optional share-image
  // lookup. Falls back to the site default inside pageMetadata.
  const p = pair.product as any;
  return pageMetadata({
    title: pair.product.name,
    description: pair.product.tagline || pair.product.description || "",
    path: `/shop/${pair.category.slug}/${pair.product.slug}`,
    type: "website",
    image: p.coverImage || (p.gallery && p.gallery[0]),
  });
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { category, product } = await params;
  const pair = getProductBySlugs(category, product);
  return (
    <>
      {pair && <script {...jsonLdScript(productJsonLd(pair.category, pair.product))} />}
      <ProductRoute />
    </>
  );
}
