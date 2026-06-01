"use client";

// ============================================================
// useSiteNav — App.jsx's go* navigation, on next/navigation
// ============================================================
// The Vite SPA navigated by setView + history.pushState. Under the Next
// App Router each destination is a real URL, so these helpers just push the
// SAME paths App.jsx used — every URL is preserved. Views keep their existing
// onNavigate* / onBack callback contracts; routes pass these in.
// ============================================================

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { prefetchAllowed } from "../lib/connection";

export function useSiteNav() {
  const router = useRouter();

  const push = useCallback((href) => router.push(href), [router]);

  return useMemo(() => ({
    // Warm a route's JS + RSC payload before the user taps, so the navigation
    // feels instant. Gated by prefetchAllowed() so a data-saver / slow link is
    // never charged for speculative fetches. Safe no-op on failure — navigation
    // still works via push.
    prefetch:        (href) => { try { if (prefetchAllowed()) router.prefetch(href); } catch {} },
    goForYou:        () => push("/"),
    goHome:          () => push("/"),
    goPage:          (slug) => push(`/${slug}`),          // /story, /faq, …
    goShopIndex:     () => push("/shop"),
    goShopCategory:  (categorySlug) => push(`/shop/${categorySlug}`),
    goShopProduct:   (categorySlug, productSlug) => push(`/shop/${categorySlug}/${productSlug}`),
    goJournal:       () => push("/journal"),
    goJournalPost:   (slug) => push(`/journal/${slug}`),
    goAccount:       () => push("/account"),
    goAdmin:         () => push("/admin"),
    goGallery:       () => push("/gallery"),
    goCheckout:      () => push("/checkout"),
    goCart:          () => push("/cart"),
  }), [push]);
}
