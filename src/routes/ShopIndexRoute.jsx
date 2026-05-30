"use client";

import dynamic from "next/dynamic";
import { useSiteNav } from "../state/useSiteNav.js";

const ShopIndexView = dynamic(() => import("../components/shop/ShopIndexView.jsx").then((m) => m.ShopIndexView), { ssr: false });

export function ShopIndexRoute() {
  const nav = useSiteNav();
  return (
    <ShopIndexView
      onNavigateHome={nav.goForYou}
      onNavigateCategory={nav.goShopCategory}
      onNavigateProduct={nav.goShopProduct}
      onNavigateJournalPost={nav.goJournalPost}
      onNavigateJournal={nav.goJournal}
    />
  );
}

export default ShopIndexRoute;
