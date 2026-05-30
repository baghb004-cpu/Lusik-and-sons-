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

export function generateMetadata({ params }: { params: Params }): Metadata {
  const pair = getProductBySlugs(params.category, params.product);
  if (!pair) return {};
  return pageMetadata({
    title: pair.product.name,
    description: pair.product.tagline || pair.product.description || "",
    path: `/shop/${pair.category.slug}/${pair.product.slug}`,
    type: "website",
  });
}

export default function Page({ params }: { params: Params }) {
  const pair = getProductBySlugs(params.category, params.product);
  return (
    <>
      {pair && <script {...jsonLdScript(productJsonLd(pair.category, pair.product))} />}
      <ProductRoute />
    </>
  );
}
