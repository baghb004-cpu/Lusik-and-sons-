import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATALOG, getCategoryBySlug } from "../../../src/data/catalog.js";
import { pageMetadata } from "../../../src/lib/seo.js";
import { CategoryRoute } from "../../../src/routes/CategoryRoute.jsx";

type Params = { category: string };

export function generateStaticParams(): Params[] {
  return (Object.values(CATALOG) as any[]).map((c) => ({ category: c.slug }));
}

// Next 15: `params` is async and must be awaited.
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = getCategoryBySlug(categorySlug);
  if (!category) return {};
  return pageMetadata({
    title: category.label,
    description: category.description || "",
    path: `/shop/${category.slug}`,
  });
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { category: categorySlug } = await params;
  if (!getCategoryBySlug(categorySlug)) notFound();
  return <CategoryRoute />;
}
