"use client";

import dynamic from "next/dynamic";
import { PRODUCT } from "../data/product.js";
import { useSiteNav } from "../state/useSiteNav.js";

const HomeView = dynamic(() => import("../components/HomeView.jsx").then((m) => m.HomeView), { ssr: false });

// `/` (For You) and the promoted section pages (/story, /workshop, /faq,
// /contact, /shipping, /newsletter) — all render HomeView; the section pages
// pass their pageSlug. Mirrors App.jsx's `view === "home"` branch.
/**
 * @param {{ pageSlug?: string | null }} props
 */
export function HomeRoute({ pageSlug = null }) {
  const nav = useSiteNav();
  return (
    <HomeView
      product={PRODUCT}
      pageSlug={pageSlug}
      onNavigatePage={nav.goPage}
      onBackToForYou={nav.goForYou}
      onNavigateShop={nav.goShopIndex}
      onNavigateCategory={nav.goShopCategory}
      onNavigateProduct={nav.goShopProduct}
      onNavigateJournal={nav.goJournal}
      onOpenPolicy={() => { /* policy modal — wired in a later phase */ }}
      simplified={false}
    />
  );
}

export default HomeRoute;
