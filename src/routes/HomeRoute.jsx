"use client";

import { PRODUCT } from "../data/product.js";
import { useSiteNav } from "../state/useSiteNav.js";

// SSR: HomeView is imported directly (not dynamic({ ssr:false })) so the server
// sends real "For You" content in the initial HTML instead of an empty shell
// that waits for JavaScript — faster first paint, no pop-in. HomeView and its
// children are SSR-safe: anything browser-only (localStorage "recently viewed",
// matchMedia, window) runs in effects/handlers, not at render time.
import { HomeView } from "../components/HomeView.jsx";

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
      onPrefetch={nav.prefetch}
      onOpenPolicy={(key) => window.dispatchEvent(new CustomEvent("openPolicy", { detail: key }))}
      // Mobile For You collapses to the Apple-Store card layout: the brand
      // hero (eyebrow / headline / description / slideshow) + trust badges are
      // hidden on phones (hidden lg:block) so the page leads with the
      // "We think you'll love" card and recent activity. Desktop keeps the
      // full hero. Only the home feed simplifies — the promoted section pages
      // (/story, /workshop, …) keep their current layout.
      simplified={!pageSlug}
    />
  );
}

export default HomeRoute;
