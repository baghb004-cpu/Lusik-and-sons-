"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { getCategoryBySlug } from "../data/catalog.js";
import { useSiteNav } from "../state/useSiteNav.js";

const CategoryView = dynamic(() => import("../components/shop/CategoryView.jsx").then((m) => m.CategoryView), { ssr: false });

export function CategoryRoute() {
  const nav = useSiteNav();
  const params = useParams();
  const category = getCategoryBySlug(typeof params?.category === "string" ? params.category : "");
  if (!category) return null;
  return (
    <CategoryView
      category={category}
      onNavigateHome={nav.goForYou}
      onNavigateShop={nav.goShopIndex}
      onNavigateProduct={nav.goShopProduct}
    />
  );
}

export default CategoryRoute;
