"use client";

import { useSiteNav } from "../state/useSiteNav.js";

// SSR: direct import (was dynamic({ ssr:false })) so the server renders
// real shop/product content in the initial HTML. ShopIndexView and its children are
// SSR-safe — all browser access (localStorage, window, matchMedia, cart
// add-to-bag, URL share-decode) runs in effects/handlers, not at render.
import { ShopIndexView } from "../components/shop/ShopIndexView.jsx";

export function ShopIndexRoute() {
  const nav = useSiteNav();
  return (
    <ShopIndexView
      onNavigateHome={nav.goForYou}
      onNavigateCategory={nav.goShopCategory}
      onNavigateProduct={nav.goShopProduct}
      onNavigateJournalPost={nav.goJournalPost}
      onNavigateJournal={nav.goJournal}
      onPrefetch={nav.prefetch}
    />
  );
}

export default ShopIndexRoute;
