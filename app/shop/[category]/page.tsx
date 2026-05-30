import type { Metadata } from "next";
import { CATALOG, getCategoryBySlug } from "../../../src/data/catalog.js";
import { pageMetadata } from "../../../src/lib/seo.js";
import { CategoryRoute } from "../../../src/routes/CategoryRoute.jsx";

type Params = { category: string };

export function generateStaticParams(): Params[] {
  return (Object.values(CATALOG) as any[]).map((c) => ({ category: c.slug }));
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const category = getCategoryBySlug(params.category);
  if (!category) return {};
  return pageMetadata({
    title: category.label,
    description: category.description || "",
    path: `/shop/${category.slug}`,
  });
}

export default function Page() {
  return <CategoryRoute />;
}
