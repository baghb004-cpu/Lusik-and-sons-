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
import { AnimatePresence, m } from "framer-motion";
import { backdrop, drawerRight } from "../lib/motion";
import { MobilePageHeader } from "./MobilePageHeader.jsx";
import { MobileBottomNav } from "./MobileBottomNav.jsx";
import { MobileSearchView } from "./MobileSearchView.jsx";
import { CartContents } from "./CartContents.jsx";
import { SiteTopNav } from "./SiteTopNav.jsx";
import { SiteFooter } from "./SiteFooter.jsx";
import { AuthDrawer } from "./AuthDrawer.jsx";
import { PolicyModal } from "./PolicyModal.jsx";
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

const TITLES = {
  home: "For You", shop: "Shop", journal: "Journal",
  account: "Your Account", gallery: "Gallery", checkout: "Checkout",
};

export function SiteChrome({ children }) {
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
  // Overlays driven by the chrome.
  const [authOpen, setAuthOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(null); // null | "privacy" | "terms" | "finalSale"

  // Close transient surfaces on route change.
  useEffect(() => { setSearchOpen(false); setCartOpen(false); }, [pathname]);

  // Escape closes the cart drawer.
  useEffect(() => {
    if (!cartOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setCartOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cartOpen]);

  // Adding to the bag surfaces the cart — the slide-in drawer on desktop, the
  // full /cart page on mobile (where the drawer would fight the bottom nav).
  // Parity with the old App.jsx openCart(): SiteProvider bumps cartOpenSignal
  // on every add; 0 is the initial value (no add yet), so we ignore it.
  useEffect(() => {
    if (!site.cartOpenSignal) return;
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia?.("(max-width: 1023px)").matches;
    if (isMobile) nav.goCart();
    else setCartOpen(true);
  }, [site.cartOpenSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Snappier taps: the app navigates with router.push (no built-in prefetch),
  // so without this the first tap to each section waited on its route chunk.
  // After the page is idle, warm the primary destinations — the bottom-nav
  // tabs — so tapping between For You / Shop / Journal / Bag feels instant.
  // Cheap + cache-friendly: Next dedupes prefetches and only fetches each once.
  useEffect(() => {
    const warm = () => ["/", "/shop", "/journal", "/cart"].forEach((r) => nav.prefetch(r));
    const ric = typeof window !== "undefined" && window.requestIdleCallback;
    if (ric) {
      const id = window.requestIdleCallback(warm, { timeout: 2000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = setTimeout(warm, 1200);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navView = searchOpen ? "search" : view;
  const showHeader = !searchOpen && view !== "cart" && !isSection && view !== "checkout" && view !== "admin";
  const showBottomNav = !["checkout", "admin"].includes(view);

  const onAvatarTap = () => (site.user ? nav.goAccount() : setAuthOpen(true));

  return (
    <>
      {/* Desktop top nav (lg+) */}
      <SiteTopNav onOpenCart={() => setCartOpen(true)} onSignIn={() => setAuthOpen(true)} />

      {/* Mobile per-page header */}
      {showHeader && (
        <MobilePageHeader
          title={TITLES[view] || "Lusik & Sons"}
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

      {/* Route content */}
      {children}

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
                user={site.user}
                onClose={() => setCartOpen(false)}
              />
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Auth drawer (sign in / sign up / forgot password) */}
      {authOpen && (
        <AuthDrawer onClose={() => setAuthOpen(false)} onAuthed={() => setAuthOpen(false)} />
      )}

      {/* Policy modal (privacy / terms / final sale) — opened from the footer */}
      {policyOpen && <PolicyModal policyKey={policyOpen} onClose={() => setPolicyOpen(null)} />}

      {/* Ancillary floating widgets (match production) */}
      <TextUsWidget />
      <BackToTopButton />
    </>
  );
}
