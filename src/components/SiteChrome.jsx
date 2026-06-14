"use client";

// ============================================================
// SiteChrome — global app chrome for the Next App Router build
// ============================================================
// Vite→Next migration, Phase 7.5. App.jsx rendered the nav/header/footer +
// overlays around every view; under the App Router that lives here, mounted
// once in app/layout.tsx around {children}. Derives the "current view" from
// the pathname (next/navigation) and pulls cart/auth from SiteProvider, so it
// matches production without App.jsx (which is untouched and retired at the
// Phase 8 flip).
//
// This file = the MOBILE chrome + overlays. The desktop top-nav and footer are
// their own components (SiteTopNav / SiteFooter), composed below.
// ============================================================

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useT } from "../i18n/LangContext.jsx";
import { prefetchAllowed } from "../lib/connection";
import { AnimatePresence, m } from "framer-motion";
import { backdrop, drawerRight } from "../lib/motion";
import { MobilePageHeader } from "./MobilePageHeader.jsx";
import { MobileBottomNav } from "./MobileBottomNav.jsx";
import { MobileSearchView } from "./MobileSearchView.jsx";
import { CartContents } from "./CartContents.jsx";
import { YouMayAlsoLikeSheet } from "./YouMayAlsoLikeSheet.jsx";
import { SiteTopNav } from "./SiteTopNav.jsx";
import { AnnouncementBar } from "./AnnouncementBar.jsx";
import { SiteFooter } from "./SiteFooter.jsx";
import { AuthDrawer } from "./AuthDrawer.jsx";
import { PolicyModal } from "./PolicyModal.jsx";
import { WaitlistModal } from "./WaitlistModal.jsx";
import { BackToTopButton } from "./BackToTopButton.jsx";
import { TextUsWidget } from "./TextUsWidget.jsx";
import { useSite } from "../state/SiteProvider.jsx";
import { useSiteNav } from "../state/useSiteNav.js";

const SECTION_PATHS = new Set(["/story", "/workshop", "/faq", "/contact", "/shipping", "/newsletter"]);

function viewFromPath(pathname) {
  if (pathname === "/cart") return "cart";
  if (pathname === "/checkout") return "checkout";
  if (pathname === "/account") return "account";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname === "/gallery") return "gallery";
  if (pathname.startsWith("/shop")) return "shop";
  if (pathname.startsWith("/journal")) return "journal";
  return "home"; // "/" and the section pages
}

// Mobile per-page titles, keyed by view. Resolved through i18n at render
// time (see `titleFor` below) so the large mobile headers translate.
const TITLE_KEYS = {
  home: "pageTitles.home", shop: "pageTitles.shop", journal: "pageTitles.journal",
  account: "pageTitles.account", gallery: "pageTitles.gallery", checkout: "pageTitles.checkout",
};

export function SiteChrome({ children }) {
  const t = useT();
  const pathname = usePathname() || "/";
  const site = useSite();
  const nav = useSiteNav();

  const view = viewFromPath(pathname);
  const isSection = SECTION_PATHS.has(pathname);

  // Search is an overlay (no URL), mirroring App.jsx's view==="search".
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Desktop cart drawer (mobile uses the /cart page).
  const [cartOpen, setCartOpen] = useState(false);
  const [cartEditMode, setCartEditMode] = useState(false);
  // Apple-style "You may also like" sheet that opens on add-to-bag.
  const [recommendOpen, setRecommendOpen] = useState(false);
  // Open the bag the original way (drawer on desktop, /cart page on mobile).
  const openCartNow = () => {
    const isMobile = typeof window !== "undefined" && window.matchMedia?.("(max-width: 1023px)").matches;
    if (isMobile) nav.goCart(); else setCartOpen(true);
  };
  // Overlays driven by the chrome.
  const [authOpen, setAuthOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(null); // null | "privacy" | "terms" | "finalSale"
  const [waitlistProduct, setWaitlistProduct] = useState(null); // { key, name } | null — restock / coming-soon notify

  // Close transient surfaces on route change.
  useEffect(() => { setSearchOpen(false); setCartOpen(false); setRecommendOpen(false); }, [pathname]);

  // Warm the primary nav destinations (the bottom-nav tabs + main browse) so
  // tapping them feels instant — but never at the expense of the page the
  // visitor actually came for. Two guards aimed at slow/low-end devices:
  //   1. Skip entirely on Save-Data or a slow link (2g/3g, e.g. rural mobile):
  //      speculative prefetch would steal scarce bandwidth from the real load.
  //   2. Otherwise wait for the main thread to go idle (requestIdleCallback)
  //      so the prefetch never competes with the current page's first paint.
  // router.prefetch dedupes/caches, so each route's payload is fetched once.
  useEffect(() => {
    if (!prefetchAllowed()) return;
    const warm = () => ["/", "/shop", "/journal", "/cart"].forEach((href) => nav.prefetch(href));
    const ric = typeof window !== "undefined" ? window.requestIdleCallback : null;
    const id = ric ? ric(warm, { timeout: 2500 }) : setTimeout(warm, 800);
    return () => {
      if (ric && window.cancelIdleCallback) window.cancelIdleCallback(id);
      else clearTimeout(id);
    };
  }, [nav]);

  // Escape closes the cart drawer.
  useEffect(() => {
    if (!cartOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setCartOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cartOpen]);

  // Policy links scattered through the tree (the mobile "More" cards on the
  // For You page, the cart's fine print) open the shared PolicyModal by
  // dispatching a window "openPolicy" CustomEvent with the policy key in
  // `detail`. App.jsx used to listen for this; SiteChrome owns the modal now,
  // so it has to listen — without this the event fell on the floor and those
  // buttons did nothing.
  useEffect(() => {
    const onOpenPolicy = (e) => {
      if (e?.detail) setPolicyOpen(e.detail);
    };
    window.addEventListener("openPolicy", onOpenPolicy);
    return () => window.removeEventListener("openPolicy", onOpenPolicy);
  }, []);

  // "Notify me when it's back / available" buttons (sold-out live
  // products AND coming-soon placeholders) dispatch a window
  // "openWaitlist" CustomEvent carrying { key, name }. SiteChrome owns
  // the modal so it listens here — without this the buttons would do
  // nothing (the WaitlistModal was previously mounted nowhere).
  useEffect(() => {
    const onOpenWaitlist = (e) => {
      const d = e?.detail;
      if (d && d.key) setWaitlistProduct({ key: d.key, name: d.name ?? "this product" });
    };
    window.addEventListener("openWaitlist", onOpenWaitlist);
    return () => window.removeEventListener("openWaitlist", onOpenWaitlist);
  }, []);

  // Adding to the bag surfaces the cart — the slide-in drawer on desktop, the
  // full /cart page on mobile (where the drawer would fight the bottom nav).
  // Parity with the old App.jsx openCart(): SiteProvider bumps cartOpenSignal
  // on every add; 0 is the initial value (no add yet), so we ignore it.
  // On add-to-bag, surface the Apple-style "You may also like" sheet
  // (with the "Product added to Bag" confirmation). Its Continue button
  // then opens the bag. The bag is also always reachable from the nav.
  useEffect(() => {
    if (!site.cartOpenSignal) return;
    setRecommendOpen(true);
  }, [site.cartOpenSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  const navView = searchOpen ? "search" : view;
  const showHeader = !searchOpen && view !== "cart" && !isSection && view !== "checkout" && view !== "admin";
  // The store's bottom nav never belongs on the builder (it floats over
  // the editor's own pane bar on phones) — same exclusion as checkout/admin.
  const showBottomNav = !["checkout", "admin"].includes(view) && !pathname.startsWith("/builder");

  const onAvatarTap = () => (site.user ? nav.goAccount() : setAuthOpen(true));

  return (
    <>
      {/* Desktop top nav (lg+) */}
      {/* Studio-controlled announcement strip — renders nothing while
          disabled in content/pages/announcement.json. Above BOTH navs so
          one edit reaches phones and desktop alike. */}
      <AnnouncementBar />
      <SiteTopNav onOpenCart={() => setCartOpen(true)} onSignIn={() => setAuthOpen(true)} />

      {/* Mobile per-page header */}
      {showHeader && (
        <MobilePageHeader
          title={TITLE_KEYS[view] ? t(TITLE_KEYS[view]) : "Lusik & Sons"}
          subtitle={view === "checkout" ? "Almost in Lusik's hands" : null}
          user={site.user}
          onAvatarTap={onAvatarTap}
          onBack={
            view === "shop" && pathname !== "/shop"
              ? () => nav.goShopIndex()
              : undefined
          }
        />
      )}

      {/* Route content — wrapped in the single page <main> landmark (the nav,
          header, footer and overlays live outside it). Satisfies the
          landmark-one-main accessibility audit; error/404 pages render inside
          this, so their own wrappers are plain <div>s (no nested <main>). */}
      <main>{children}</main>

      {/* Footer (desktop only — lg:block inside the component) */}
      <SiteFooter onOpenPolicy={setPolicyOpen} />

      {/* Mobile bottom nav */}
      {showBottomNav && (
        <MobileBottomNav
          view={navView}
          cartCount={site.cartCount}
          onHome={() => { setSearchOpen(false); nav.goForYou(); }}
          onShop={() => { setSearchOpen(false); nav.goShopIndex(); }}
          onJournal={() => { setSearchOpen(false); nav.goJournal(); }}
          onCart={() => { setSearchOpen(false); nav.goCart(); }}
          onSearch={() => setSearchOpen(true)}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />
      )}

      {/* Mobile search overlay */}
      {searchOpen && (
        <MobileSearchView
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onNavigateProduct={(c, p) => { setSearchOpen(false); nav.goShopProduct(c, p); }}
          onSelectJournalPost={(slug) => { setSearchOpen(false); nav.goJournalPost(slug); }}
          onScrollTo={() => setSearchOpen(false)}
          user={site.user}
          onAvatarTap={onAvatarTap}
        />
      )}

      {/* Desktop cart drawer — frosted scrim fade + spring slide via
          AnimatePresence (so it animates out on close too, not just in). */}
      <AnimatePresence>
        {cartOpen && (
          <m.div
            className="fixed inset-0 z-50 flex justify-end"
            onClick={() => setCartOpen(false)}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <m.div className="absolute inset-0 lg-scrim" variants={backdrop} />
            <m.div
              className="lg-panel-tall lg-drawer relative w-full max-w-md flex flex-col"
              variants={drawerRight}
              style={{ willChange: "transform" }}
              onClick={(e) => e.stopPropagation()}
            >
              <CartContents
                variant="drawer"
                cart={site.cart}
                subtotal={site.subtotal}
                cartEditMode={cartEditMode}
                onToggleEdit={setCartEditMode}
                setQtyExact={site.setQtyExact}
                removeFromCart={site.removeFromCart}
                onCheckout={() => { setCartOpen(false); nav.goCheckout(); }}
                onShopBlankets={() => { setCartOpen(false); nav.goShopCategory("blankets"); }}
                onOpenSavedDesigns={() => { setCartOpen(false); nav.goAccount(); }}
                onOpenProduct={(href) => { setCartOpen(false); nav.go(href); }}
                user={site.user}
                onClose={() => setCartOpen(false)}
              />
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Apple-style "You may also like" sheet — opens on add-to-bag with a
          fading "Product added to Bag" pill; Continue proceeds to the bag. */}
      <YouMayAlsoLikeSheet
        open={recommendOpen}
        addedKey={site.lastAddedKey}
        onClose={() => setRecommendOpen(false)}
        onContinue={() => { setRecommendOpen(false); openCartNow(); }}
        onNavigateProduct={(c, s) => { setRecommendOpen(false); nav.goShopProduct(c, s); }}
      />

      {/* Auth drawer (sign in / sign up / forgot password) */}
      {authOpen && (
        <AuthDrawer onClose={() => setAuthOpen(false)} onAuthed={() => setAuthOpen(false)} />
      )}

      {/* Policy modal (privacy / terms / final sale) — opened from the footer */}
      {policyOpen && <PolicyModal policyKey={policyOpen} onClose={() => setPolicyOpen(null)} />}

      {/* Restock / coming-soon notify modal — opened via the "openWaitlist"
          CustomEvent from sold-out product pages and placeholder cards. */}
      {waitlistProduct && (
        <WaitlistModal product={waitlistProduct} onClose={() => setWaitlistProduct(null)} />
      )}

      {/* Ancillary floating widgets (match production) */}
      <TextUsWidget />
      <BackToTopButton />
    </>
  );
}
