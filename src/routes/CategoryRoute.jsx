"use client";

import { useParams } from "next/navigation";
import { getCategoryBySlug } from "../data/catalog.js";
import { useSiteNav } from "../state/useSiteNav.js";

// SSR: direct import (was dynamic({ ssr:false })) so the server renders
// real shop/product content in the initial HTML. CategoryView and its children are
// SSR-safe — all browser access (localStorage, window, matchMedia, cart
// add-to-bag, URL share-decode) runs in effects/handlers, not at render.
import { CategoryView } from "../components/shop/CategoryView.jsx";

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
      onPrefetch={nav.prefetch}
    />
  );
}

export default CategoryRoute;
