// ============================================================
// App — the root component
// ============================================================
// Owns: cart, view, auth, cart-drawer state, swipe state,
// global keydown handlers, view-change scroll-reset on mobile,
// analytics page-view dispatch, ?d= URL hydration on PDP mount,
// post-checkout polling, the journal pathname↔state effect.
//
// MIRRORED FROM index.html (~line 5143). 1,390 lines — the
// biggest single component in the codebase.
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from "react";

// Data + config
import { CONFIG } from "./data/config.js";
import { PRODUCT } from "./data/product.js";
import { CUSTOM_PRODUCTS } from "./data/customProducts.js";
import {
  CATALOG,
  getCategoryBySlug,
  getProductBySlugs,
  categoryPath,
  productPath,
} from "./data/catalog.js";
import { SOCIAL_PLATFORMS } from "./data/socialPlatforms.js";
import { JOURNAL_POSTS } from "./data/journalPosts.js";

// Lib
import { auth } from "./lib/auth.js";
import { db } from "./lib/db.js";
import { track } from "./lib/analytics.js";
import { mapLegacyId } from "./lib/cartId";

// i18n
import { useT, useLang } from "./i18n/LangContext.jsx";

// Components — viewport / overlay / nav
import { ToastProvider, useToast } from "./components/ToastProvider.jsx";
import { ActiveOrderTopBar } from "./components/ActiveOrderTopBar.jsx";
import { MobileBottomNav } from "./components/MobileBottomNav.jsx";
import { BackToTopButton } from "./components/BackToTopButton.jsx";
import { TextUsWidget } from "./components/TextUsWidget.jsx";
import { ChatAssistant } from "./components/ChatAssistant.jsx";
import { AuthDrawer } from "./components/AuthDrawer.jsx";
import { PolicyModal } from "./components/PolicyModal.jsx";
import { WaitlistModal } from "./components/WaitlistModal.jsx";
import { HeartBurst } from "./components/HeartBurst.jsx";
import { MobilePageHeader } from "./components/MobilePageHeader.jsx";
import { haptic } from "./lib/haptic.js";
import { CartContents } from "./components/CartContents.jsx";

// Lang machinery
import { FirstVisitLangBanner } from "./components/FirstVisitLangBanner.jsx";
import { FooterLangToggle } from "./components/FooterLangToggle.jsx";
import { BetaTranslationBadge } from "./components/BetaTranslationBadge.jsx";

// Home + ancillary
import { ShopMegaMenu } from "./components/ShopMegaMenu.jsx";
import { NewsletterSignup } from "./components/NewsletterSignup.jsx";
import { ThemeToggle } from "./components/ThemeToggle.jsx";

// Views
import { HomeView } from "./components/HomeView.jsx";
import { JournalView } from "./components/JournalView.jsx";
import { AccountView } from "./components/AccountView.jsx";
import { GalleryView } from "./components/GalleryView.jsx";
import { AdminView } from "./components/AdminView.jsx";
import { AdminOrderDetail } from "./components/AdminOrderDetail.jsx";
import { CheckoutView } from "./components/CheckoutView.jsx";
import { MobileSearchView } from "./components/MobileSearchView.jsx";
import { ShopIndexView } from "./components/shop/ShopIndexView.jsx";
import { CategoryView } from "./components/shop/CategoryView.jsx";
import { ProductView } from "./components/shop/ProductView.jsx";

// Icons used directly inside App
import {
  ArrowRight, AtSign, Check, ChevronDown,
  Instagram, Mail, MapPin, Menu, Phone, Plus, Send,
  ShoppingBag, User, X,
} from "./components/icons.jsx";

export function App() {
  const t = useT();
  const toast = useToast();
  const [cart, setCart] = useState([]);
  const [view, setView] = useState("home");
  // Search query lives in App so both the bottom-nav search input
  // (in collapsed mode) and the MobileSearchView results panel
  // share the same string. Cleared when navigating away from search.
  const [searchQuery, setSearchQuery] = useState("");
  // Clear the search query whenever the customer navigates away
  // from the search view. This keeps the input fresh for the next
  // visit and avoids stale results lingering in the background.
  useEffect(() => {
    if (view !== "search") setSearchQuery("");
  }, [view]);
  // Mirror the drawer's edit-mode reset for the full-page Bag view:
  // leaving the cart page (e.g. via the bottom nav) drops edit mode
  // so the next visit starts in the default read-only state. The
  // drawer-close effect below handles the desktop drawer case.
  useEffect(() => {
    if (view !== "cart") setCartEditMode(false);
  }, [view]);
  const [cartOpen, setCartOpen] = useState(false);
  // Cart edit mode: when true, QuantityPicker + remove buttons are
  // visible on each cart row. When false, only "Qty: N" text shows.
  // Resets to false whenever the drawer closes.
  const [cartEditMode, setCartEditMode] = useState(false);
  // Swipe-to-dismiss state for the cart drawer. cartDragX is the
  // current rightward drag offset in px; 0 means resting. Reset
  // every time the drawer closes so the next open animates in cleanly.
  const [cartDragX, setCartDragX] = useState(0);
  // Toggled true once a horizontal drag is claimed; flipped back false
  // on release. While true the transform style has no transition so
  // the drawer tracks the finger 1:1; after release we let the 0.2s
  // ease-out smooth the spring-back / off-screen slide.
  const [cartDragging, setCartDragging] = useState(false);
  const cartDragStartRef = useRef(null);
  const cartDragIntentRef = useRef(null); // null | "horizontal" | "vertical"
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false); // sign-in/sign-up drawer
  const [policyOpen, setPolicyOpen] = useState(null); // null | "privacy" | "terms" | "finalSale"
  // Placeholder-catalog item the customer just clicked. Drives the
  // WaitlistModal — null when closed, a product object when open.
  const [waitlistProduct, setWaitlistProduct] = useState(null);
  // Currently-selected journal post slug. null = render the list.
  // Synced to the URL hash (#journal/<slug>) so individual posts
  // get shareable, copy-pasteable URLs even though we're a SPA.
  const [journalSlug, setJournalSlug] = useState(null);
  // When viewing a single order in admin mode (view === "admin-order"),
  // this holds the order id passed to AdminOrderDetail. The list view
  // sets it and flips view; the detail's "Back to orders" clears it.
  const [adminOrderId, setAdminOrderId] = useState(null);
  // Shop routing state. The pathname is the source of truth (synced
  // both ways with shopCategorySlug + shopProductSlug below). When
  // view === "shop", both are null. When view === "shop-category",
  // shopCategorySlug is set. When view === "shop-product", both are
  // set. Mirrors the journalSlug pattern.
  const [shopCategorySlug, setShopCategorySlug] = useState(null);
  const [shopProductSlug,  setShopProductSlug]  = useState(null);
  // Whether the PDP's mobile sticky add-to-cart bar is currently
  // showing. Lifted up from ProductShowcase so the global mobile
  // bottom-nav can step out of the way — they share the same
  // pixels on phones.
  const [pdpStickyCtaShown, setPdpStickyCtaShown] = useState(false);

  // Session-conditional home title (mobile only). The large "Lusik & Sons"
  // masthead shows on the FIRST home view of a browser session — it orients
  // first-time and search/direct visitors. Once they navigate away, it
  // retires for the rest of the session, and return visits to home show a
  // quiet "For You" label instead (Apple Store style). SEO is unaffected:
  // the page <title> tag and the hero <h1> are separate from this label.
  const [showHomeIntro, setShowHomeIntro] = useState(() => {
    try { return sessionStorage.getItem("ls_home_intro_seen") !== "1"; }
    catch { return true; }
  });
  const prevViewRef = useRef(view);
  useEffect(() => {
    const prev = prevViewRef.current;
    prevViewRef.current = view;
    if (prev === "home" && view !== "home" && showHomeIntro) {
      try { sessionStorage.setItem("ls_home_intro_seen", "1"); } catch { /* ignore */ }
      setShowHomeIntro(false);
    }
  }, [view, showHomeIntro]);

  // Listen for cross-policy link clicks inside the modal (e.g. clicking
  // "Final Sale Policy" from the bottom of "Privacy Policy"). The modal fires
  // a CustomEvent because it doesn't have a direct setter handle.
  useEffect(() => {
    const handler = (e) => setPolicyOpen(e.detail);
    window.addEventListener("openPolicy", handler);
    return () => window.removeEventListener("openPolicy", handler);
  }, []);

  // --- AUTH STATE ---
  // user: Netlify Identity user object (id, email, ...) or null when logged out
  // profile: row from `profiles` table — full_name, phone, avatar_url
  // authReady: false while we're checking for an existing session on mount.
  //   Used to avoid flashing "Sign in" briefly on refresh for logged-in users.
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  // Mirror of Identity's app_metadata.roles.includes("admin"). Recomputed on
  // every auth-state change so the Admin link in the account view appears
  // immediately when Lusik signs in.
  const [isAdmin, setIsAdmin] = useState(false);

  // Heart-burst + cart-pulse feedback state. `bursts` is a list of {id, x, y} —
  // each maps to a HeartBurst component. They're auto-removed after the animation finishes.
  const [bursts, setBursts] = useState([]);
  const [cartPulsing, setCartPulsing] = useState(false);

  // --- CART HYDRATION FROM localStorage (guests) ---
  // We restore the guest cart immediately on mount. If the user logs in later,
  // we'll merge this with their saved DB cart.
  //
  // Shape validation: localStorage is mutable by the user, a browser
  // extension, or a hostile other tab on the same origin. Even though
  // server-side TRUSTED_PRODUCTS re-prices at checkout, a bogus
  // negative price in storage would surface as a nonsense subtotal
  // in the UI and a nonsense `totalCents` in analytics. Drop any
  // line item that doesn't have the minimal shape we know about.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONFIG.CART_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const cleaned = parsed.filter((it) =>
        it &&
        typeof it === "object" &&
        typeof it.id === "string" && it.id.length > 0 && it.id.length <= 256 &&
        typeof it.name === "string" &&
        Number.isFinite(it.price) && it.price >= 0 && it.price <= 100000 &&
        Number.isFinite(it.qty)   && it.qty   >= 1 && it.qty   <= 99,
      );
      if (cleaned.length > 0) setCart(cleaned);
    } catch (_) {
      // Corrupted localStorage — ignore and continue with empty cart.
    }
  }, []);

  // --- CART PERSISTENCE TO localStorage (always) ---
  // Mirror cart state to localStorage on every change so guests keep their cart
  // across refreshes. Tiny operation, fine to run on every change.
  useEffect(() => {
    try {
      localStorage.setItem(CONFIG.CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (_) { /* quota / private mode — silently ignore */ }
  }, [cart]);

  // --- AUTH SESSION RESTORATION ---
  // On mount, ask Identity for an existing session. If present, fetch profile
  // and merge any guest cart into the user's saved DB cart. Also subscribe to
  // future auth changes (sign in, sign out, token refresh, email confirmation).
  useEffect(() => {
    let mounted = true;

    const handleSession = async (session) => {
      if (!mounted) return;
      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }
      setUser(session.user);
      setIsAdmin(auth.isAdmin());
      // Fetch profile + saved cart in parallel
      const [{ profile: p }, { cart: savedCart }] = await Promise.all([
        db.getProfile(),
        db.getSavedCart(),
      ]);
      if (!mounted) return;
      setProfile(p ?? null);

      // Cart merge logic: combine current local cart with DB cart, dedupe by id.
      // Local-cart quantities win for items in both (user just added them).
      if (savedCart && Array.isArray(savedCart)) {
        setCart((local) => {
          if (local.length === 0) return savedCart;
          const merged = [...savedCart];
          for (const localItem of local) {
            const idx = merged.findIndex((m) => m.id === localItem.id);
            if (idx >= 0) merged[idx] = localItem; // local wins
            else merged.push(localItem);
          }
          return merged;
        });
      }
      setAuthReady(true);
    };

    // Initial check
    auth.getSession()
      .then(({ session }) => handleSession(session))
      .catch((err) => {
        // Identity unreachable, no network, etc. Treat as logged-out.
        console.warn("Auth session check failed:", err);
        if (mounted) setAuthReady(true);
      });

    // Subscribe to auth changes (login, logout, token refresh)
    let subscription = null;
    try {
      const { data } = auth.onAuthStateChange((_event, session) => {
        handleSession(session);
      });
      subscription = data?.subscription;
    } catch (err) {
      // Identity widget didn't load — site continues without auth.
      console.warn("Auth subscription failed:", err);
    }

    return () => {
      mounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  // --- POST-CHECKOUT URL HANDLING ---
  // After Stripe redirects back with ?order=success, route to the account
  // page so the customer immediately sees their order land. We also clear
  // the cart since payment succeeded — the saved DB cart will get the
  // empty array on next debounced write.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const orderStatus = params.get("order");
    if (orderStatus === "success") {
      setCart([]);
      track("order-complete", { sessionId: params.get("session_id") });
      // If we have a session, send them to the account page; if not, stay
      // home with a banner. Future polish: show a "checkout success" banner.
      if (user) {
        setView("account");
      }
    } else if (orderStatus === "cancelled") {
      // Strip the param, no action; the cart still has their items.
      const url = new URL(window.location.href);
      url.searchParams.delete("order");
      window.history.replaceState({}, "", url.toString());
    }
    // Post-account-deletion redirect target. The deletion
    // endpoint returns OK + the AccountView does a hard reload
    // to /?account=deleted, which lands us here. We toast and
    // strip the param so a refresh doesn't re-toast.
    if (params.get("account") === "deleted") {
      toast({ kind: "success", message: "Your account has been deleted. Thank you for trying us." });
      const url = new URL(window.location.href);
      url.searchParams.delete("account");
      window.history.replaceState({}, "", url.toString());
    }
  }, [user]);

  // --- LEGACY ?d= DESIGN LINK REDIRECT ---
  // Saved-design URLs previously landed on the home page (where
  // <ProductShowcase> was inlined) and hydrated from ?d=<base64>.
  // After the /shop hierarchy refactor, ProductShowcase only mounts
  // at /shop/blankets/armenian-alphabet-blanket. Anyone with an old
  // shared link gets redirected there so the hydration still fires.
  // Uses replaceState so the old URL doesn't pollute history.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const pathname = window.location.pathname;
    const search   = window.location.search;
    if (pathname === "/" && /[?&]d=/.test(search)) {
      const target = "/shop/blankets/armenian-alphabet-blanket" + search + window.location.hash;
      try { window.history.replaceState({}, "", target); } catch {}
      // Force the route effect to re-read the new pathname.
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, []);

  // (The legacy "strip stale #admin" cleanup that lived here was
  // removed during the merge with main — main brought back an
  // active #admin hash router that NEEDS the fragment to remain
  // long enough to read it. See the checkAdminHash effect below
  // which now owns this fragment.)

  // --- JOURNAL + SHOP ROUTING (history API) ---
  // Real URLs, not hash fragments. Two route hierarchies use this:
  //
  //   /journal                          → JournalView (list)
  //   /journal/<slug>                   → JournalView (post)
  //   /shop                             → ShopIndexView
  //   /shop/<categorySlug>              → CategoryView
  //   /shop/<categorySlug>/<prodSlug>   → ProductView
  //
  // Netlify's SPA fallback in netlify.toml rewrites both /journal*
  // and /shop* to index.html so the React app handles them in the
  // browser. Two-way sync:
  //   (1) on mount and on popstate (back/forward), parse the
  //       pathname into view + slugs;
  //   (2) on every internal navigation, push a new history entry
  //       so the browser back button walks the user through their
  //       own navigation history.
  //
  // Backward compatibility: any shared `#journal/<slug>` URL hash
  // from before the journal-routes commit gets silently rewritten
  // to the clean pathname on first load.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const applyFromUrl = () => {
      const path = window.location.pathname;

      // ----- /shop hierarchy -----
      const shopMatch = path.match(/^\/shop(?:\/([\w-]+)(?:\/([\w-]+))?)?\/?$/);
      if (shopMatch) {
        const [, catSlug, prodSlug] = shopMatch;
        if (catSlug && prodSlug) {
          // /shop/<cat>/<slug> — verify the pair exists; bad URLs
          // bounce to /shop index rather than crashing.
          if (getProductBySlugs(catSlug, prodSlug)) {
            setView("shop-product");
            setShopCategorySlug(catSlug);
            setShopProductSlug(prodSlug);
          } else {
            setView("shop");
            setShopCategorySlug(null);
            setShopProductSlug(null);
            window.history.replaceState({}, "", "/shop");
          }
          return;
        }
        if (catSlug) {
          if (getCategoryBySlug(catSlug)) {
            setView("shop-category");
            setShopCategorySlug(catSlug);
            setShopProductSlug(null);
          } else {
            setView("shop");
            setShopCategorySlug(null);
            setShopProductSlug(null);
            window.history.replaceState({}, "", "/shop");
          }
          return;
        }
        setView("shop");
        setShopCategorySlug(null);
        setShopProductSlug(null);
        return;
      }

      // ----- /journal hierarchy -----
      const m = path.match(/^\/journal(?:\/([\w-]+))?\/?$/);
      if (m) {
        setView("journal");
        setJournalSlug(m[1] ?? null);
        return;
      }
      const h = window.location.hash.match(/^#journal(?:\/([\w-]+))?/);
      if (h) {
        const slug = h[1] ?? null;
        const newPath = slug ? `/journal/${slug}` : "/journal";
        window.history.replaceState({}, "", newPath);
        setView("journal");
        setJournalSlug(slug);
      }
    };
    applyFromUrl();
    window.addEventListener("popstate", applyFromUrl);
    return () => window.removeEventListener("popstate", applyFromUrl);
  }, []);

  // Push history state on internal shop navigation, mirroring the
  // journal effect below. We push (not replace) so the back button
  // walks the customer through their own navigation history:
  //   product → category → /shop → home.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let next = null;
    if (view === "shop")                next = "/shop";
    else if (view === "shop-category" && shopCategorySlug)
                                        next = `/shop/${shopCategorySlug}`;
    else if (view === "shop-product"  && shopCategorySlug && shopProductSlug)
                                        next = `/shop/${shopCategorySlug}/${shopProductSlug}`;
    if (next && window.location.pathname !== next) {
      window.history.pushState({}, "", next);
    }
  }, [view, shopCategorySlug, shopProductSlug]);

  // When the customer leaves the shop entirely (clicks a non-shop
  // link), restore the root path so the URL bar doesn't lie about
  // where they are. Mirrors the journal-exit effect below.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (view === "shop" || view === "shop-category" || view === "shop-product") return;
    if (window.location.pathname.startsWith("/shop")) {
      window.history.pushState({}, "", "/");
    }
  }, [view]);

  // Legacy short URLs that predate the /shop hierarchy. /blanket
  // and /bib redirect to the canonical product pages so old shared
  // links continue to land in the right spot. /gallery is a real
  // standalone view added on main (no /shop equivalent).
  useEffect(() => {
    const applyProductPath = () => {
      if (typeof window === "undefined") return;
      const p = window.location.pathname;
      if (p === "/blanket") {
        try { window.history.replaceState({}, "", "/shop/blankets/armenian-alphabet-blanket"); } catch {}
        setShopCategorySlug("blankets");
        setShopProductSlug("armenian-alphabet-blanket");
        setView("shop-product");
        return;
      }
      if (p === "/bib") {
        try { window.history.replaceState({}, "", "/shop/bibs/baby-bib"); } catch {}
        setShopCategorySlug("bibs");
        setShopProductSlug("baby-bib");
        setView("shop-product");
        return;
      }
      if (p === "/gallery") {
        setView("gallery");
      }
    };
    applyProductPath();
    window.addEventListener("popstate", applyProductPath);
    return () => window.removeEventListener("popstate", applyProductPath);
  }, []);

  // Push state when the customer is on /gallery so the URL bar
  // reflects the view. /blanket and /bib don't reach here because
  // applyProductPath above redirects them on mount.
  useEffect(() => {
    if (view !== "gallery") return;
    if (window.location.pathname !== "/gallery") {
      try { window.history.replaceState({}, "", "/gallery"); } catch {}
    }
  }, [view]);

  // ---------------------------------------------------------------
  // Admin hash routing — clicking the Admin nav button (injected by
  // index.html for users with the admin role) sets
  // window.location.hash = "#admin". This effect listens for that
  // hash and switches the SPA to the admin view if the user is
  // confirmed-admin by identity, then clears the hash so the
  // address bar stays clean.
  // ---------------------------------------------------------------
  useEffect(() => {
    const checkAdminHash = () => {
      if (window.location.hash !== "#admin") return;
      // Defer one tick so the Identity widget can hydrate currentUser()
      // after a fresh page load before we read the role.
      setTimeout(() => {
        try {
          if (typeof auth?.isAdmin === "function" && auth.isAdmin()) {
            setView("admin");
            try { history.replaceState(null, "", location.pathname + location.search); } catch {}
          }
        } catch {}
      }, 0);
    };
    checkAdminHash();
    window.addEventListener("hashchange", checkAdminHash);
    return () => window.removeEventListener("hashchange", checkAdminHash);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (view !== "journal") return;
    const next = journalSlug ? `/journal/${journalSlug}` : "/journal";
    if (window.location.pathname !== next) {
      // pushState (not replaceState) so the browser back button
      // walks the customer through their own navigation history:
      // post → list → wherever they came from. The exception is
      // the initial pop-from-URL on mount, which uses
      // replaceState above (so the bookmark URL isn't doubled).
      window.history.pushState({}, "", next);
    }
  }, [view, journalSlug, shopCategorySlug, shopProductSlug]);

  // When the customer leaves the journal entirely (e.g. clicks
  // "Back to the shop"), restore the root path so the URL bar
  // doesn't lie about where they are.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (view === "journal") return;
    if (window.location.pathname.startsWith("/journal")) {
      window.history.pushState({}, "", "/");
    }
  }, [view]);

  // --- DOCUMENT TITLE + CANONICAL per route ---
  // Without these, every URL on the site reports the same <title>
  // and the same canonical link, so Google treats individual
  // journal posts as duplicates of the home page. Updating both
  // per route is what makes posts indexable as standalone pages.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const BRAND = "Lusik & Sons";
    let title = `${BRAND} — Hand-Embroidered Armenian Alphabet Blankets | Cypress, CA`;
    let canonical = "https://lusikandsons.com/";
    if (view === "journal") {
      if (journalSlug) {
        const post = JOURNAL_POSTS.find((p) => p.slug === journalSlug);
        if (post) {
          title     = `${post.title} · ${BRAND}`;
          canonical = `https://lusikandsons.com/journal/${journalSlug}`;
        } else {
          title     = `The Journal · ${BRAND}`;
          canonical = "https://lusikandsons.com/journal";
        }
      } else {
        title     = `The Journal · ${BRAND}`;
        canonical = "https://lusikandsons.com/journal";
      }
    } else if (view === "shop") {
      title     = `Shop · ${BRAND}`;
      canonical = "https://lusikandsons.com/shop";
    } else if (view === "shop-category" && shopCategorySlug) {
      const cat = getCategoryBySlug(shopCategorySlug);
      if (cat) {
        title     = `${cat.label} · ${BRAND}`;
        canonical = `https://lusikandsons.com/shop/${cat.slug}`;
      }
    } else if (view === "shop-product" && shopCategorySlug && shopProductSlug) {
      const pair = getProductBySlugs(shopCategorySlug, shopProductSlug);
      if (pair) {
        title     = `${pair.product.name} · ${BRAND}`;
        canonical = `https://lusikandsons.com/shop/${pair.category.slug}/${pair.product.slug}`;
      }
    } else if (view === "account") {
      title = `Your account · ${BRAND}`;
    } else if (view === "admin") {
      title = `Admin · ${BRAND}`;
    } else if (view === "admin-order") {
      title = `Order · Admin · ${BRAND}`;
    } else if (view === "search") {
      title = `Search · ${BRAND}`;
    } else if (view === "cart") {
      title = `Your Cart · ${BRAND}`;
    } else if (view === "checkout") {
      title = `Checkout · ${BRAND}`;
    }
    document.title = title;
    let link = document.querySelector("link[rel='canonical']");
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", canonical);
  }, [view, journalSlug, shopCategorySlug, shopProductSlug]);

  // --- PRIVACY-FIRST ANALYTICS (opt-in via CONFIG.ANALYTICS) ---
  // On mount, if the customer set CONFIG.ANALYTICS.UMAMI_WEBSITE_ID,
  // inject the script tag. The script self-installs window.umami
  // and starts tracking the initial pageview. Re-mounts are
  // protected by the data-umami marker so hot-reload doesn't
  // stack scripts.
  //
  // A separate effect below fires window.umami.track() on every
  // view + slug change — without that, the SPA's internal
  // navigation wouldn't show up as distinct pageviews in the
  // analytics dashboard. Umami's track() with no args sends a
  // fresh pageview using the current URL.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id  = CONFIG.ANALYTICS?.UMAMI_WEBSITE_ID;
    if (!id) return;
    if (document.querySelector("script[data-umami]")) return;
    const src = CONFIG.ANALYTICS?.UMAMI_SRC_URL || "https://cloud.umami.is/script.js";
    const s = document.createElement("script");
    s.src   = src;
    s.defer = true;
    s.dataset.websiteId = id;
    s.dataset.umami     = "installed";
    document.head.appendChild(s);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!CONFIG.ANALYTICS?.UMAMI_WEBSITE_ID) return;
    // Umami's track() with no args grabs the current location
    // and fires a pageview. Wrapped in a queueMicrotask so it
    // runs after the title/canonical updates above — Umami picks
    // up the new title/URL automatically that way.
    queueMicrotask(() => { try { window.umami?.track(); } catch {} });
  }, [view, journalSlug, shopCategorySlug, shopProductSlug]);

  // Mobile-only: reset scroll to the top on every view change. Without
  // this, switching from a deep-scrolled position (e.g. the bib at the
  // bottom of the home page → Checkout) leaves the new view's header
  // off-screen. Desktop's taller viewport hides the issue, so we gate
  // on Tailwind's <lg breakpoint to avoid a scroll jump on big screens.
  //
  // We previously also toggled the viewport meta tag to reset pinch-
  // zoom on view change, but iOS Safari handled the rapid toggle
  // inconsistently — sometimes it left the page laid out for the
  // narrower no-scale viewport even after the restore, which produced
  // a too-narrow page where elements like the announcement banner
  // didn't fill the screen. Reverted; mobile users keep their zoom
  // level across view changes, which is the platform default anyway.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia?.("(max-width: 1023px)").matches) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [view, journalSlug, shopCategorySlug, shopProductSlug]);

  // --- PAID-FEATURE STUBS (off by default; see CONFIG.PAID_FEATURES) ---
  // Each block below mounts the third-party script ONLY if its
  // flag is enabled AND the credentials are present. With both
  // empty, every effect short-circuits at the top and the page
  // never makes an outbound request to the provider.
  useEffect(() => {
    const c = CONFIG.PAID_FEATURES?.LIVE_CHAT;
    if (!c?.ENABLED || !c.PROPERTY_ID) return;
    if (document.querySelector("script[data-live-chat]")) return;
    const s = document.createElement("script");
    s.async = true;
    s.dataset.liveChat = c.PROVIDER || "tawk";
    if (c.PROVIDER === "tawk") {
      s.src = `https://embed.tawk.to/${c.PROPERTY_ID}/default`;
      s.setAttribute("crossorigin", "*");
    } else if (c.PROVIDER === "crisp") {
      window.$crisp = []; window.CRISP_WEBSITE_ID = c.PROPERTY_ID;
      s.src = "https://client.crisp.chat/l.js";
    } else if (c.PROVIDER === "intercom") {
      s.src = `https://widget.intercom.io/widget/${c.PROPERTY_ID}`;
    }
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    const c = CONFIG.PAID_FEATURES?.BEHAVIORAL_ANALYTICS;
    if (!c?.ENABLED || !c.POSTHOG_KEY) return;
    if (document.querySelector("script[data-posthog]")) return;
    // PostHog's array-init stub — replaced by the real client
    // when the loader script finishes. Captures events fired
    // before init and replays them once ready.
    window.posthog = window.posthog || [];
    const s = document.createElement("script");
    s.src = "https://us.i.posthog.com/static/array.js";
    s.async = true;
    s.dataset.posthog = "installed";
    s.onload = () => {
      try { window.posthog.init?.(c.POSTHOG_KEY, { api_host: c.POSTHOG_HOST }); } catch {}
    };
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    const c = CONFIG.PAID_FEATURES?.IMAGE_CDN;
    if (!c?.ENABLED || !c.CLOUDINARY_CLOUD_NAME) return;
    // Preconnect — saves one round-trip on the first product
    // photo. Actual <img> URLs are rewritten at the call sites
    // when this flag is on.
    if (document.querySelector("link[data-cloudinary-preconnect]")) return;
    const link = document.createElement("link");
    link.rel  = "preconnect";
    link.href = `https://res.cloudinary.com`;
    link.dataset.cloudinaryPreconnect = "installed";
    document.head.appendChild(link);
  }, []);

  // --- DEBOUNCED CART SYNC TO DB (logged-in users only) ---
  // Avoid hammering the database on every +/- click. Wait until cart changes
  // settle for CART_PERSIST_DEBOUNCE_MS, then write once. We skip the very
  // first sync after login because that change came FROM the database.
  const skipNextDbWriteRef = useRef(false);
  useEffect(() => {
    if (!user) return;
    if (skipNextDbWriteRef.current) {
      skipNextDbWriteRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      // Strip base64 blobs before the PUT — the saved_carts JSONB
      // column is capped at 1 MB server-side, and a single custom-image
      // bib would blow that cap on its own. The dropped fields are
      // recreated next time the user opens the customizer.
      const stored = cart.map((item) => {
        const { customImage, ...rest } = item;
        const isDataUrl = typeof rest.image === "string" && rest.image.startsWith("data:");
        return { ...rest, image: isDataUrl ? null : rest.image };
      });
      db.saveCart(stored).catch((err) => console.warn("Cart save failed:", err));
    }, CONFIG.CART_PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [cart, user]);

  const triggerCartFeedback = (clientX, clientY) => {
    // Pulse the cart icon — works regardless of motion preferences (it's subtle).
    setCartPulsing(true);
    setTimeout(() => setCartPulsing(false), 500);

    // Skip the heart particles for users with reduced-motion enabled.
    const reduceMotion = typeof window !== "undefined"
      && window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    if (clientX == null || clientY == null) return;

    const id = Date.now() + Math.random();
    setBursts((b) => [...b, { id, x: clientX, y: clientY }]);
    // Cleanup once animation is done so we don't leak DOM nodes.
    setTimeout(() => setBursts((b) => b.filter((burst) => burst.id !== id)), CONFIG.HEART_BURST_LIFETIME_MS);
  };

  // Coerce qty + price defensively: saved-cart hydration can produce
  // rows whose shape doesn't quite match what the current code expects
  // (cart schema evolved across deploys), and a single `undefined` in
  // the reduce poisons the whole subtotal to NaN — which then renders
  // as "$NaN.00" and turns the checkout-start analytics event into a
  // NaN cents payload that crashes Math.round downstream.
  const cartCount = cart.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const subtotal = cart.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);

  // Open the cart in the right surface for the viewport: on mobile
  // the full-page Bag view (where the bottom nav stays visible, so
  // the customer is never trapped); on desktop the slide-in drawer
  // (desktop has the top nav, no bottom tab bar, drawer fits there).
  // Used by every "show the cart" trigger EXCEPT the desktop-only
  // top-nav cart icon (which always opens the drawer directly).
  const openCart = () => {
    const isMobile = typeof window !== "undefined"
      && window.matchMedia?.("(max-width: 1023px)").matches;
    if (isMobile) setView("cart");
    else setCartOpen(true);
  };

  const addToCart = (color, qty = 1, selection = null, layout = null, colors = null) => {
    haptic(12);
    track("add-to-cart", { kind: "blanket", alphabet: selection?.key ?? null, layout: layout?.key ?? null });
    // `selection` is either a `letter` (legacy single-letter bib) or an
    // `alphabet` (current — Armenian/English). When alphabet, `layout` is
    // also expected — it carries the spatial arrangement, the letter count,
    // and the price for THIS particular variant.
    // `colors` is an object: { block, letter, letterColors?, presetKey? }
    //   - block/letter: single threadColor entries with { dmc, name, hex }
    //   - letterColors: array of threadColor entries when multi-color preset
    //     is active (Armenian Flag). null when single-color.
    const isAlphabet = selection && typeof selection === "object" && Array.isArray(selection.letters);
    const isLetter = selection && typeof selection === "object" && "display" in selection;

    let id, subtitle, price;
    if (isAlphabet) {
      // Each alphabet+layout+color combo is its own SKU so the cart shows them
      // as distinct rows. Two customers ordering Armenian with different
      // colors get their own line items, not a stacked qty=2.
      // Include multi-color signature in the SKU when present.
      const layoutKey = layout?.key ?? "default";
      const blockDmc = colors?.block?.dmc ?? "default";
      const letterDmc = colors?.letter?.dmc ?? "default";
      const multiSig = Array.isArray(colors?.letterColors)
        ? "-multi-" + colors.letterColors.map((c) => c.dmc).join("_")
        : "";
      id = `blanket-${selection.key}-${layoutKey}-${blockDmc}-${letterDmc}${multiSig}`;
      const lettersStr = selection.letters.join(", ");
      const layoutLabel = layout?.shortLabel ?? "";
      // Friendly color description — no DMC numbers, just names. When
      // multi-color, list the per-letter colors joined together.
      let colorStr = "";
      if (colors) {
        if (Array.isArray(colors.letterColors) && colors.letterColors.length > 0) {
          const letterNames = colors.letterColors.map((c) => c.name).join(", ");
          colorStr = ` · ${colors.block.name} cube, letters in ${letterNames}`;
        } else {
          colorStr = ` · ${colors.block.name} cube, ${colors.letter.name} letter`;
        }
      }
      // Optional personalization — only included in subtitle when at least
      // one of the two text fields was filled in. If both are empty, skip
      // entirely so the subtitle stays clean.
      const cLine1 = (colors?.customLine1 ?? "").trim();
      const cLine2 = (colors?.customLine2 ?? "").trim();
      let customStr = "";
      if (cLine1 || cLine2) {
        const parts = [cLine1, cLine2].filter(Boolean).map(p => `"${p}"`).join(" + ");
        customStr = ` · personalized ${parts}`;
        // Bake the optional text into the SKU id so two orders with different
        // personalization don't collapse into a single qty=2 cart row.
        id += `-c${cLine1}_${cLine2}`;
      }
      subtitle = `${selection.label} alphabet — ${lettersStr} · ${layoutLabel}${colorStr}${customStr}`;
      price = layout ? layout.priceCents / 100 : PRODUCT.price;
    } else if (isLetter) {
      id = `blanket-${selection.language}-${selection.display}`;
      subtitle = `Letter: ${selection.display} (${selection.transliteration}, ${selection.language})`;
      price = PRODUCT.price;
    } else {
      id = `blanket-${color.name}`;
      subtitle = `Letter color: ${color.name}`;
      price = PRODUCT.price;
    }

    setCart((c) => {
      const existing = c.find((i) => i.id === id);
      if (existing) return c.map((i) => (i.id === id ? { ...i, qty: i.qty + qty } : i));
      return [...c, {
        id, name: PRODUCT.name, subtitle,
        price, image: PRODUCT.gallery[0],
        qty, colorHex: color.hex,
        alphabet: isAlphabet ? selection : null,
        letter: isLetter ? selection : null,
        layout: isAlphabet ? layout : null,
        threadColors: isAlphabet && colors ? colors : null,
        // The order metadata that flows browser → Stripe → webhook → orders DB.
        // EVERYTHING Lusik needs to make this exact blanket goes here. If she's
        // ever unsure about a stitched order, this is the field to look up.
        // Internal `dmc` codes are kept here as stable identifiers even though
        // they are NOT displayed to the customer anywhere — they serve as the
        // canonical reference Lusik uses to know which thread shade to grab.
        customMetadata: isAlphabet ? {
          alphabet_key: selection.key,
          alphabet_label: selection.label,
          letters: selection.letters.join(","),
          layout_key: layout?.key ?? null,
          layout_label: layout?.label ?? null,
          layout_short_label: layout?.shortLabel ?? null,
          layout_description: layout?.description ?? null,
          letter_count: layout?.letterCount ?? null,
          // Block/cube outline color
          block_color_name: colors?.block?.name ?? null,
          block_color_hex: colors?.block?.hex ?? null,
          block_color_ref: colors?.block?.dmc ?? null,   // internal ID, not "DMC" anymore
          // Letter color — single-color case
          letter_color_name: colors?.letter?.name ?? null,
          letter_color_hex: colors?.letter?.hex ?? null,
          letter_color_ref: colors?.letter?.dmc ?? null,
          // Per-letter colors — when Armenian Flag (or any future multi-color
          // preset) is selected, this records the ordered list of letter colors.
          // Maps to letter positions in stitch order: index 0 = first letter
          // (e.g. Ա / A), index 1 = second (Բ / B), etc. For the 6-letter
          // double-diagonal layout, the list cycles — letters 4-6 reuse colors 1-3.
          letter_colors_multi: Array.isArray(colors?.letterColors)
            ? colors.letterColors.map((c) => `${c.name} (${c.hex})`).join(" | ")
            : null,
          color_preset_key: colors?.presetKey ?? null,
          // Optional personalization — null when blank so order data shows
          // clearly that customer didn't request any optional text.
          custom_line_1: (colors?.customLine1 ?? "").trim() || null,
          custom_line_2: (colors?.customLine2 ?? "").trim() || null,
        } : null,
      }];
    });
    openCart();
  };

  // Cart drawer dismissal: Escape key + swipe-right-to-dismiss on mobile.
  // The X button at top-right and the backdrop click are still wired up
  // in the JSX below; these are additional affordances for users who
  // expect them (keyboard users on desktop, iOS users who instinctively
  // swipe drawers off-screen).
  useEffect(() => {
    if (!cartOpen) {
      // Reset gesture state when the drawer closes so the next open
      // doesn't start mid-drag.
      setCartDragX(0);
      setCartDragging(false);
      setCartEditMode(false);
      cartDragStartRef.current = null;
      cartDragIntentRef.current = null;
      return;
    }
    const onKey = (e) => { if (e.key === "Escape") setCartOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cartOpen]);

  const onCartDrawerTouchStart = (e) => {
    const t = e.touches[0];
    cartDragStartRef.current = { x: t.clientX, y: t.clientY };
    cartDragIntentRef.current = null;
  };
  const onCartDrawerTouchMove = (e) => {
    if (!cartDragStartRef.current) return;
    // Bail on multi-touch (a pinch should not be misread as a swipe).
    if (e.touches.length > 1) {
      onCartDrawerTouchCancel();
      return;
    }
    const t = e.touches[0];
    const dx = t.clientX - cartDragStartRef.current.x;
    const dy = t.clientY - cartDragStartRef.current.y;
    if (cartDragIntentRef.current === null) {
      if (Math.abs(dx) < CONFIG.SWIPE.CLAIM_DIST_PX && Math.abs(dy) < CONFIG.SWIPE.CLAIM_DIST_PX) return;
      cartDragIntentRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
    }
    if (cartDragIntentRef.current !== "horizontal") return;
    // Only react to rightward drag (positive dx). Leftward swipes are
    // already claimed by SwipeableRow inside the drawer for per-item
    // delete; this stays out of that lane by clamping to >= 0.
    if (!cartDragging) setCartDragging(true);
    setCartDragX(Math.max(0, dx));
  };
  // Used for both touchcancel (system interruption) and for multi-
  // touch promotion (pinch starting mid-swipe). Springs back to 0.
  const onCartDrawerTouchCancel = () => {
    setCartDragging(false);
    setCartDragX(0);
    cartDragStartRef.current = null;
    cartDragIntentRef.current = null;
  };
  const onCartDrawerTouchEnd = () => {
    if (cartDragIntentRef.current === "horizontal") {
      setCartDragging(false);
      // Dismiss past the configured threshold (about a third of a
      // typical drawer width). Otherwise spring back to 0.
      if (cartDragX > CONFIG.SWIPE.DISMISS_THRESHOLD_PX) {
        setCartDragX(window.innerWidth);
        setTimeout(() => setCartOpen(false), CONFIG.SWIPE.COMMIT_ANIM_MS);
      } else {
        setCartDragX(0);
      }
    }
    cartDragStartRef.current = null;
    cartDragIntentRef.current = null;
  };

  const updateQty = (id, delta) => {
    // Minus on qty=1 routes to removeFromCart so the customer gets the
    // undo toast instead of a no-op clamp. Same UX as Amazon / Shopify
    // checkouts and avoids stranding an item the customer wanted gone.
    if (delta < 0) {
      const item = cart.find((i) => i.id === id);
      if (item && item.qty + delta < 1) {
        removeFromCart(id);
        return;
      }
    }
    setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)));
  };
  // Set qty to an exact value (used by the QuantityPicker popover --
  // tapping "3" in the list shouldn't have to compute deltas at the
  // call site). Clamped at the same 1-99 envelope as the validator.
  const setQtyExact = (id, qty) => {
    const clamped = Math.min(99, Math.max(1, Math.floor(Number(qty) || 1)));
    setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: clamped } : i)));
  };
  const removeFromCart = (id) => {
    haptic(8);
    // Capture the removed line item so the toast's "Undo" can put it
    // back exactly as it was — including custom metadata and qty.
    // We preserve its position in the cart so an undo restores order.
    let removed = null;
    let removedIndex = -1;
    setCart((c) => {
      removedIndex = c.findIndex((i) => i.id === id);
      if (removedIndex < 0) return c;
      removed = c[removedIndex];
      return c.filter((i) => i.id !== id);
    });
    if (!removed) return;
    toast({
      kind: "info",
      message: `Removed ${removed.name} from your cart.`,
      action: {
        label: "Undo",
        onClick: () => {
          setCart((c) => {
            // If the customer added the same SKU again before clicking
            // Undo, merge quantities rather than duplicate the row.
            const existing = c.findIndex((i) => i.id === removed.id);
            if (existing >= 0) {
              return c.map((i, idx) => idx === existing
                ? { ...i, qty: i.qty + removed.qty }
                : i);
            }
            const next = [...c];
            const insertAt = Math.min(removedIndex, next.length);
            next.splice(insertAt, 0, removed);
            return next;
          });
        },
      },
    });
  };

  const addCustomToCart = ({ productKey, name, price, size, customImage, customImageName, subtitleOverride, customMetadata }) => {
    haptic(12);
    track("add-to-cart", { kind: "custom", productKey });
    // Each custom upload gets a unique id so multiple custom items don't merge.
    const id = `${productKey}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setCart((c) => [...c, {
      id,
      name,
      subtitle: subtitleOverride || `Size: ${size}`,
      price,
      // For hand-stitched products there's no uploaded image. Fall back to
      // the blanket hero image so the cart row still has a thumbnail.
      image: customImage || PRODUCT.gallery[0],
      qty: 1,
      isCustom: true,
      productKey,
      size,
      customImageName,
      customMetadata: customMetadata || null,
    }]);
    openCart();
  };

  const goCheckout = () => {
    setCartOpen(false);
    setView("checkout");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Navigate to the dedicated account page. Used both from the auth drawer
  // ("Manage account →") and the nav (when already signed in).
  const goAccount = () => {
    setAuthOpen(false);
    setView("account");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ----- Shop navigation helpers -----
  // Centralized here so every entry point (nav bar, mobile menu,
  // footer, mega-menu, hero CTA, mobile bottom-nav, breadcrumbs)
  // uses the same call. They keep the view + slug state in sync,
  // close any open mobile menus, and reset scroll to the top so
  // the customer doesn't land mid-page.
  const goShopIndex = () => {
    setShopCategorySlug(null);
    setShopProductSlug(null);
    setView("shop");
    setMobileNavOpen(false);
    setCartOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const goShopCategory = (categorySlug) => {
    if (!getCategoryBySlug(categorySlug)) return goShopIndex();
    setShopCategorySlug(categorySlug);
    setShopProductSlug(null);
    setView("shop-category");
    setMobileNavOpen(false);
    setCartOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const goShopProduct = (categorySlug, productSlug) => {
    if (!getProductBySlugs(categorySlug, productSlug)) return goShopIndex();
    setShopCategorySlug(categorySlug);
    setShopProductSlug(productSlug);
    setView("shop-product");
    setMobileNavOpen(false);
    setCartOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  // Convenience for shop-mega-menu placeholder clicks — opens the
  // waitlist modal anywhere, without leaving the current page.
  const openWaitlist = (product) => {
    setWaitlistProduct(product);
  };

  // Sign out: clears the Identity session, which fires onAuthStateChange and resets
  // user/profile state. We deliberately do NOT clear the local cart on logout —
  // the user might want to keep shopping anonymously.
  const handleSignOut = async () => {
    const { error } = await auth.signOut();
    setView("home");
    if (error) {
      toast({ kind: "error", message: error.message || "Couldn't sign you out — please try again." });
    } else {
      toast({ kind: "success", message: "Signed out. See you again soon." });
    }
  };

  // Reorder — re-add a past order's items to the current cart.
  // Today this handles the blanket only, by reconstructing the
  // cart selection from custom_metadata fields the webhook
  // persisted. Anything else (bibs, future products) is skipped
  // with a friendly toast so the customer isn't left wondering.
  // Limitation: depends on alphabet/layout/color keys still
  // existing in the live PRODUCT data. If Lusik retires an
  // alphabet or color, old orders referencing it will skip.
  const reorderFromHistory = (order) => {
    const items = order?.order_items ?? [];
    if (items.length === 0) {
      toast({ kind: "info", message: "That order has no items to re-add." });
      return;
    }
    let restored = 0;
    let skipped  = 0;
    for (const item of items) {
      const pk = item.product_key || "";
      const meta = item.custom_metadata || {};
      if (pk.startsWith("blanket")) {
        const alphabet    = PRODUCT.alphabets.find((a) => a.key === meta.alphabet_key);
        const layout      = PRODUCT.layouts.find((l) => l.key === meta.layout_key);
        const blockColor  = PRODUCT.threadColors.find((c) => c.dmc === meta.block_color_ref);
        const letterColor = PRODUCT.threadColors.find((c) => c.dmc === meta.letter_color_ref);
        if (!alphabet || !layout || !blockColor || !letterColor) {
          skipped++;
          continue;
        }
        // Multi-color presets persist their letter colors as a
        // pipe-joined string ("Name (#hex) | ...") in metadata —
        // parse the hexes back out and re-resolve to threadColors.
        let letterColors = null;
        if (typeof meta.letter_colors_multi === "string" && meta.letter_colors_multi.length > 0) {
          const hexes = meta.letter_colors_multi.match(/#[0-9A-Fa-f]{6}/g) ?? [];
          const resolved = hexes
            .map((h) => PRODUCT.threadColors.find((c) => c.hex.toLowerCase() === h.toLowerCase()))
            .filter(Boolean);
          if (resolved.length > 0) letterColors = resolved;
        }
        addToCart(blockColor, item.quantity || 1, alphabet, layout, {
          block:        blockColor,
          letter:       letterColor,
          letterColors,
          presetKey:    meta.color_preset_key ?? null,
          customLine1:  meta.custom_line_1 ?? "",
          customLine2:  meta.custom_line_2 ?? "",
        });
        restored++;
      } else {
        // Bibs / future products — not handled in v1.
        skipped++;
      }
    }
    if (restored > 0) {
      toast({
        kind: "success",
        message: `Added ${restored} item${restored === 1 ? "" : "s"} from order ${order.order_number} to your cart.`,
      });
      // On desktop this opens the drawer; on mobile it routes to the
      // full-page Bag (openCart handles the viewport split).
      openCart();
    }
    if (skipped > 0) {
      toast({
        kind: "info",
        message: `${skipped} item${skipped === 1 ? "" : "s"} from that order couldn't be re-added automatically — please add them by hand.`,
      });
    }
  };


  const scrollTo = (id) => {
    if (view !== "home") setView("home");
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 80);
    setMobileNavOpen(false);
  };

  return (
    <div className="min-h-screen pb-28 lg:pb-0">
      {/* Skip-to-content link for keyboard + screen-reader users.
          Visually hidden until focused; the first Tab on any page
          surfaces it as the first interactive element so users
          who can't see the page can jump past the nav directly to
          the main content. Standard WCAG 2.1 § 2.4.1 pattern. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:text-sm focus:rounded"
        style={{ background: "var(--ink)", color: "var(--text-on-ink)" }}
      >
        Skip to main content
      </a>
      {/* `pb-20 lg:pb-0` reserves space for the mobile bottom-nav
          on phones so footer content + bottom of long pages aren't
          hidden behind it. On desktop the nav doesn't exist, so
          no padding is needed. */}
      {/* ANNOUNCEMENT / ACTIVE-ORDER BAR
          Swaps its content based on whether the signed-in user has
          a live order in flight. Renders the brand announce string
          otherwise. Hidden on mobile where the Apple Store-style
          layout replaces it with the MobilePageHeader. On desktop
          it sits above the sticky nav as always. */}
      <div className="hidden lg:block">
        <ActiveOrderTopBar user={user} onOpenAccount={() => setView("account")} />
      </div>

      {/* NAV — sticky frosted top bar. The .lg-top-bar tweak (in
          styles/index.css) squares the top corners and lifts the
          shadow to a downward gradient so the bar reads as a
          horizon line over the page content, not a floating chip. */}
      <nav className="lg-panel-tall lg-top-bar sticky top-0 z-40 theme-surface hidden lg:block">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-5 flex items-center justify-between">
          <button onClick={() => setView("home")}>
            <span className="font-display text-2xl lg:text-3xl tracking-tight" style={{ fontWeight: 500 }}>
              Lusik <span style={{ color: "#B08842" }}>&</span> Sons
            </span>
          </button>
          <div className="hidden md:flex items-center gap-10 text-sm tracking-wide">
            <ShopMegaMenu
              onNavigateShop={goShopIndex}
              onNavigateCategory={goShopCategory}
              onNavigateProduct={goShopProduct}
            />
            <button onClick={() => scrollTo("story")} className="hover:opacity-60">{t("nav.story")}</button>
            <button onClick={() => { setJournalSlug(null); setView("journal"); }} className="hover:opacity-60">Journal</button>
            <button onClick={() => scrollTo("faq")} className="hover:opacity-60">{t("nav.faq")}</button>
            <button onClick={() => scrollTo("shipping")} className="hover:opacity-60">{t("nav.shipping")}</button>
            <button onClick={() => scrollTo("contact")} className="hover:opacity-60">{t("nav.contact")}</button>
            <button onClick={() => setConnectOpen(true)} className="hover:opacity-60 flex items-center gap-2">
              <AtSign size={16} strokeWidth={1.5} />
              <span>{t("nav.connect")}</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => setView("admin")}
                className="hover:opacity-60 flex items-center gap-2"
                style={{ color: "#B08842", fontWeight: 500 }}
                aria-label="Open admin dashboard"
                data-testid="nav-admin"
              >
                <span>Admin</span>
              </button>
            )}
            <button
              onClick={() => (user ? goAccount() : setAuthOpen(true))}
              className="hover:opacity-60 flex items-center gap-2"
              aria-label={user ? t("nav.account") : t("nav.signIn")}
            >
              {user && profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" style={{ border: "1px solid rgba(26,22,18,0.15)" }} />
              ) : (
                <User size={16} strokeWidth={1.5} />
              )}
              <span>{user ? t("nav.account") : t("nav.signIn")}</span>
            </button>
            <div className="cart-tooltip-wrap">
              <button
                onClick={() => setCartOpen(true)}
                className="relative flex items-center gap-2 hover:opacity-60"
                aria-label={`Your cart${cartCount > 0 ? ` (${cartCount} item${cartCount === 1 ? "" : "s"})` : ""}`}
              >
                <span className={cartPulsing ? "cart-pulse inline-block" : "inline-block"}>
                  <ShoppingBag size={18} />
                </span>
                <span>{t("nav.cart")}{cartCount > 0 && ` (${cartCount})`}</span>
              </button>
              <div className="cart-tooltip" role="tooltip">
                {cartCount === 0 ? (
                  <>
                    <div className="cart-tooltip-title">{t("cart.empty")}</div>
                    <div className="cart-tooltip-meta">Add a blanket to get started</div>
                  </>
                ) : (
                  <>
                    <div className="cart-tooltip-title">
                      View cart · {cartCount} item{cartCount !== 1 && "s"}
                    </div>
                    <div className="cart-tooltip-meta">Subtotal ${subtotal.toFixed(2)}</div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="md:hidden flex items-center gap-4">
            <div className="cart-tooltip-wrap">
              <button
                onClick={() => setCartOpen(true)}
                className="relative"
                aria-label={`Your cart${cartCount > 0 ? ` (${cartCount} item${cartCount === 1 ? "" : "s"})` : ""}`}
              >
                <span className={cartPulsing ? "cart-pulse inline-block" : "inline-block"}>
                  <ShoppingBag size={20} />
                </span>
                {cartCount > 0 && <span className="absolute -top-1 -right-1 text-xs rounded-full w-4 h-4 flex items-center justify-center" style={{ background: "#8B2C2C", color: "#F5EFE3" }}>{cartCount}</span>}
              </button>
              {/* The CSS hides this on touch devices via @media (hover: hover) */}
              <div className="cart-tooltip" role="tooltip">
                {cartCount === 0 ? (
                  <>
                    <div className="cart-tooltip-title">Your cart is empty</div>
                    <div className="cart-tooltip-meta">Add a blanket to get started</div>
                  </>
                ) : (
                  <>
                    <div className="cart-tooltip-title">
                      View cart · {cartCount} item{cartCount !== 1 && "s"}
                    </div>
                    <div className="cart-tooltip-meta">Subtotal ${subtotal.toFixed(2)}</div>
                  </>
                )}
              </div>
            </div>
            <button onClick={() => setConnectOpen(true)} aria-label="Connect with us" data-tooltip="Reach us — phone, email, social" data-tooltip-pos="bottom">
              <AtSign size={20} />
            </button>
            <button onClick={() => (user ? goAccount() : setAuthOpen(true))} aria-label={user ? "My account" : "Sign in"} data-tooltip={user ? "My account & order history" : "Sign in or make an account"} data-tooltip-pos="bottom">
              {user && profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" style={{ border: "1px solid rgba(26,22,18,0.15)" }} />
              ) : (
                <User size={20} />
              )}
            </button>
            <button onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label="Menu" data-tooltip="Menu" data-tooltip-pos="bottom">
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="md:hidden border-t" style={{ borderColor: "rgba(26,22,18,0.08)" }}>
            <div className="px-6 py-4 flex flex-col gap-3 text-sm">
              {/* Shop section — uses native <details> for collapsible group,
                  matches the FAQ accordion pattern. Closed by default so the
                  mobile nav isn't overwhelming on small screens. */}
              <details className="group">
                <summary className="text-left cursor-pointer list-none flex items-center justify-between py-1">
                  <span>Shop</span>
                  <Plus size={14} strokeWidth={1.5} className="open-icon opacity-60" />
                </summary>
                <div className="pl-3 pt-3 pb-1 flex flex-col gap-3" style={{ borderLeft: "1px solid rgba(26,22,18,0.08)" }}>
                  {Object.entries(CATALOG).map(([catKey, category]) => (
                    <div key={catKey}>
                      <p className="text-[0.6rem] tracking-[0.2em] uppercase opacity-50 mb-1.5">{category.label}</p>
                      <div className="flex flex-col gap-1.5">
                        {category.products.map((p) => (
                          <button
                            key={p.key}
                            onClick={() => {
                              // Mobile menu: every product link goes to its
                              // own product page (live or placeholder). The
                              // placeholder page renders its own "Notify me"
                              // CTA — no waitlist modal needed here.
                              goShopProduct(category.slug, p.slug);
                              setMobileNavOpen(false);
                            }}
                            className={`text-left text-[0.85rem] ${p.status === "placeholder" ? "opacity-55" : ""}`}
                          >
                            {p.name}
                            {p.status === "placeholder" && <span className="text-[0.65rem] opacity-60"> · Notify me</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
              <button onClick={() => scrollTo("story")} className="text-left">{t("nav.story")}</button>
              <button onClick={() => { setJournalSlug(null); setView("journal"); setMobileNavOpen(false); }} className="text-left">Journal</button>
              <button onClick={() => scrollTo("faq")} className="text-left">{t("nav.faq")}</button>
              <button onClick={() => scrollTo("shipping")} className="text-left">{t("nav.shipping")}</button>
              <button onClick={() => scrollTo("contact")} className="text-left">{t("nav.contact")}</button>
              {isAdmin && (
                <button
                  onClick={() => { setView("admin"); setMobileNavOpen(false); }}
                  className="text-left"
                  style={{ color: "#B08842", fontWeight: 500 }}
                >
                  Admin dashboard
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      <main id="main-content" tabIndex={-1}>
      {/* MOBILE PAGE HEADER — Apple Store-style large title.
          Replaces the hidden sticky top nav on phones. The title
          derives from the current view so it feels like tapping a
          tab in a native app. Hidden on desktop (lg:hidden inside
          the component). The search view is excluded — it renders
          its own dedicated full-screen panel with its own title. */}
      {view !== "search" && view !== "cart" && (
        <MobilePageHeader
          title={
            view === "home" ? (showHomeIntro ? "Lusik & Sons" : "For You") :
            view === "shop" ? "Shop" :
            view === "shop-category" ? "Shop" :
            view === "shop-product" ? "Shop" :
            view === "checkout" ? "Checkout" :
            view === "account" ? "Your Account" :
            view === "admin" ? "Admin" :
            view === "admin-order" ? "Admin" :
            view === "journal" ? "Journal" :
            view === "gallery" ? "Gallery" :
            "Lusik & Sons"
          }
          subtitle={
            view === "checkout" ? "Almost in Lusik's hands" :
            null
          }
          labelMode={view === "home" && !showHomeIntro}
          user={user}
          onAvatarTap={() => user ? setView("account") : setAuthOpen(true)}
          onBack={
            view === "shop-product" && shopCategorySlug
              ? () => goShopCategory(shopCategorySlug)
              : view === "shop-category"
                ? goShopIndex
                : undefined
          }
        />
      )}
      {/* Page-transition wrapper. The `key` changes whenever the
          view or the in-view content changes (slug switches, etc.),
          which causes React to unmount the old tree and mount a
          fresh one. The .page-enter CSS class fires a 220ms
          fade-up animation on mount — subtle but enough to make
          every navigation feel intentional instead of instantaneous.
          prefers-reduced-motion disables the animation in CSS. */}
      <div key={[view, shopCategorySlug, shopProductSlug, journalSlug, adminOrderId].filter(Boolean).join("/")} className="page-enter">
      {/* HomeView is brand-only now — the inline ProductShowcase
          and CustomProductCard moved to /shop/blankets/... and
          /shop/bibs/baby-bib. Legacy /blanket and /bib URLs get
          redirected to those new product pages by the
          applyProductPath effect above. */}
      {view === "home" && (
        <HomeView
          product={PRODUCT}
          scrollTo={scrollTo}
          onNavigateShop={goShopIndex}
          onNavigateCategory={goShopCategory}
          onNavigateProduct={goShopProduct}
        />
      )}
      {view === "checkout" && <CheckoutView cart={cart} subtotal={subtotal} user={user} profile={profile} onBack={() => setView("home")} />}
      {view === "account" && <AccountView user={user} profile={profile} onProfileUpdate={setProfile} onBack={() => setView("home")} onSignOut={handleSignOut} onReorder={reorderFromHistory} product={PRODUCT} onOpenAdmin={isAdmin ? () => setView("admin") : null} />}
      {view === "gallery" && <GalleryView />}

      {view === "admin" && isAdmin && (
        <AdminView
          user={user}
          onBack={() => setView("home")}
          onOpenOrder={(id) => { setAdminOrderId(id); setView("admin-order"); }}
          onSignOut={handleSignOut}
        />
      )}
      {view === "admin-order" && isAdmin && adminOrderId && (
        <AdminOrderDetail
          orderId={adminOrderId}
          onBack={() => { setAdminOrderId(null); setView("admin"); }}
          onViewSite={() => { setAdminOrderId(null); setView("home"); }}
          onSignOut={handleSignOut}
        />
      )}
      {view === "journal" && <JournalView slug={journalSlug} onSelectPost={(s) => setJournalSlug(s)} onBack={() => { setJournalSlug(null); setView("home"); }} />}

      {/* Search is rendered OUTSIDE the page-enter wrapper (below)
          as a fixed full-screen panel — a position:fixed child of
          a CSS-transformed ancestor would be positioned relative
          to that ancestor during the page-enter animation, which
          would break the full-screen layout. */}

      {view === "shop" && (
        <ShopIndexView
          onNavigateHome={() => setView("home")}
          onNavigateCategory={goShopCategory}
          onNavigateProduct={goShopProduct}
          onNavigateJournalPost={(slug) => { setJournalSlug(slug); setView("journal"); }}
          onNavigateJournal={() => { setJournalSlug(null); setView("journal"); }}
        />
      )}
      {view === "shop-category" && shopCategorySlug && (() => {
        const cat = getCategoryBySlug(shopCategorySlug);
        if (!cat) return null;
        return (
          <CategoryView
            category={cat}
            onNavigateHome={() => setView("home")}
            onNavigateShop={goShopIndex}
            onNavigateProduct={goShopProduct}
          />
        );
      })()}
      {view === "shop-product" && shopCategorySlug && shopProductSlug && (() => {
        const pair = getProductBySlugs(shopCategorySlug, shopProductSlug);
        if (!pair) return null;
        return (
          <ProductView
            category={pair.category}
            product={pair.product}
            productData={PRODUCT}
            customProductData={CUSTOM_PRODUCTS?.bib}
            onAdd={addToCart}
            onAddCustom={addCustomToCart}
            onCartFeedback={triggerCartFeedback}
            user={user}
            onRequireSignIn={() => setAuthOpen(true)}
            onStickyCtaShown={setPdpStickyCtaShown}
            onOpenWaitlist={openWaitlist}
            onNavigateHome={() => setView("home")}
            onNavigateShop={goShopIndex}
            onNavigateCategory={goShopCategory}
          />
        );
      })()}
      </div>{/* /page-enter */}

      {/* MOBILE SEARCH — dedicated fixed full-screen panel, rendered
          outside the page-enter wrapper so its position:fixed is
          viewport-relative (not relative to a transformed ancestor).
          Results anchor to the top and snap into view as the
          customer types. */}
      {view === "search" && (
        <MobileSearchView
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onNavigateProduct={goShopProduct}
          onSelectJournalPost={(slug) => { setJournalSlug(slug); setView("journal"); }}
          onScrollTo={scrollTo}
          user={user}
          onAvatarTap={() => user ? setView("account") : setAuthOpen(true)}
        />
      )}

      {/* MOBILE BAG — full-page cart (Apple Store style). Phones get
          this instead of the slide-in drawer; the fixed bottom nav
          stays visible + tappable so the customer can navigate away
          anytime. Rendered outside the page-enter transform wrapper
          (same reason as the search view) and as a normal in-flow
          block — the bottom nav is position:fixed and floats above
          it. min-height fills the screen for short carts; the page
          variant's footer carries ~120px bottom padding so the
          Checkout button clears the nav island. Desktop keeps the
          drawer; this block is lg:hidden. */}
      {view === "cart" && (
        <div className="lg:hidden flex flex-col" style={{ minHeight: "100vh", paddingBottom: 24 }}>
          <CartContents
            variant="page"
            cart={cart}
            subtotal={subtotal}
            cartEditMode={cartEditMode}
            onToggleEdit={setCartEditMode}
            setQtyExact={setQtyExact}
            removeFromCart={removeFromCart}
            onCheckout={goCheckout}
            onShopBlankets={() => goShopCategory("blankets")}
            onOpenSavedDesigns={() => setView("account")}
            user={user}
          />
        </div>
      )}
      </main>

      {/* Waitlist modal for placeholder catalog items */}
      <WaitlistModal product={waitlistProduct} onClose={() => setWaitlistProduct(null)} />

      {/* Mobile bottom navigation — hidden on desktop. Steps out
          of the way when the PDP sticky add-to-cart bar is
          showing, the customer is in checkout, or Lusik is in
          the admin view (any of those is a focused context that
          shouldn't compete with shop-level nav). */}
      {view !== "checkout" && view !== "admin" && view !== "admin-order" && !pdpStickyCtaShown && (
        <MobileBottomNav
          view={view}
          cartCount={cart.reduce((n, i) => n + (i.qty || 0), 0)}
          onHome={() => { setView("home"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          onShop={goShopIndex}
          onJournal={() => { setJournalSlug(null); setView("journal"); }}
          onCart={() => setView("cart")}
          onSearch={() => setView("search")}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />
      )}

      {/* FOOTER */}
      <footer className="border-t mt-12 theme-surface" style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
          {/* Main columns */}
          <div className="grid md:grid-cols-12 gap-10 lg:gap-12">
            {/* Brand */}
            <div className="md:col-span-4">
              <p className="font-display text-2xl mb-3" style={{ fontWeight: 500 }}>
                Lusik <span style={{ color: "#B08842" }}>&</span> Sons
              </p>
              <p className="text-sm opacity-70 leading-relaxed mb-4">
                {t("footer.brand")}
              </p>
              <p className="text-xs opacity-50 italic font-display" style={{ fontWeight: 400 }}>
                {t("footer.tagline")}
              </p>
            </div>

            {/* Shop */}
            <div className="md:col-span-2">
              <p className="text-xs tracking-[0.3em] uppercase mb-4 opacity-70">{t("footer.shop")}</p>
              <div className="flex flex-col gap-2 text-sm">
                <button onClick={() => goShopCategory("blankets")} className="text-left hover:opacity-60">{t("nav.blanket")}</button>
                <button onClick={() => goShopCategory("bibs")} className="text-left hover:opacity-60">{t("nav.custom")}</button>
                <button onClick={() => scrollTo("story")} className="text-left hover:opacity-60">{t("nav.story")}</button>
                <button onClick={() => { setJournalSlug(null); setView("journal"); }} className="text-left hover:opacity-60">Journal</button>
                <button onClick={() => scrollTo("faq")} className="text-left hover:opacity-60">{t("nav.faq")}</button>
              </div>
            </div>

            {/* Help & Policies */}
            <div className="md:col-span-3">
              <p className="text-xs tracking-[0.3em] uppercase mb-4 opacity-70">{t("footer.help")}</p>
              <div className="flex flex-col gap-2 text-sm">
                <button onClick={() => scrollTo("shipping")} className="text-left hover:opacity-60">{t("footer.shippingTracking")}</button>
                <button onClick={() => setPolicyOpen("finalSale")} className="text-left hover:opacity-60">{t("footer.finalSalePolicy")}</button>
                <button onClick={() => setPolicyOpen("privacy")} className="text-left hover:opacity-60">{t("footer.privacyPolicy")}</button>
                <button onClick={() => setPolicyOpen("terms")} className="text-left hover:opacity-60">{t("footer.termsOfService")}</button>
                <button onClick={() => scrollTo("contact")} className="text-left hover:opacity-60">{t("footer.contactUs")}</button>
              </div>
            </div>

            {/* Find Us */}
            <div className="md:col-span-3">
              <p className="text-xs tracking-[0.3em] uppercase mb-4 opacity-70">{t("footer.findUs")}</p>
              <div className="flex flex-col gap-2 text-sm">
                <a href="tel:+17608742333" className="hover:opacity-60 flex items-center gap-2"><Phone size={14} /> (760) 874-2333</a>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-60 flex items-center gap-2"><Instagram size={14} /> @lusikandsons</a>
                <a href="mailto:hello@lusikandsons.com" className="hover:opacity-60 flex items-center gap-2"><Mail size={14} /> hello@lusikandsons.com</a>
              </div>
              <p className="text-xs opacity-50 mt-4 leading-relaxed">
                {t("footer.repliesNote")}
              </p>
            </div>
          </div>

          {/* Beta translation notice — appears only for non-English languages */}
          <BetaTranslationBadge />

          <div className="gold-line my-10" />

          {/* Newsletter signup — quiet, real-incentive copy. Posts
              to Netlify Forms via the build-time-detected form
              near the top of <body>. */}
          <NewsletterSignup />

          {/* Trust signals — small but earn their place */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8 text-xs opacity-70">
            <div className="flex items-center gap-2.5">
              <MapPin size={14} strokeWidth={1.5} style={{ color: "#B08842", flexShrink: 0 }} />
              <span>{t("footer.trustMade")}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Check size={14} strokeWidth={1.75} style={{ color: "#B08842", flexShrink: 0 }} />
              <span>{t("footer.trustSecure")}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Send size={14} strokeWidth={1.5} style={{ color: "#B08842", flexShrink: 0 }} />
              <span>{t("footer.trustShips")}</span>
            </div>
          </div>

          {/* Bottom row — copyright + language toggle + theme toggle + bilingual touch */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs opacity-60 pt-6" style={{ borderTop: "1px solid var(--border-soft)" }}>
            <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <FooterLangToggle />
              <ThemeToggle />
            </div>
            <p className="font-display italic" style={{ fontWeight: 400 }}>
              <span style={{ color: "var(--accent)" }}>{t("footer.thanks")}</span> · {t("footer.thanksEn")} · {t("footer.madeWith")}
            </p>
          </div>

          {/* Trademark disclaimer — small, quiet, factual.
              Lives below the visible-footer bottom row, set apart by a faint
              divider. Standard nominative-fair-use protection for any brand
              names referenced on the site (Stripe checkout, shipping carriers,
              social platforms). Full wording is also in Terms of Service for
              customers who go looking. */}
          <p className="text-[0.6rem] opacity-40 leading-relaxed pt-4 mt-4" style={{ borderTop: "1px solid rgba(26,22,18,0.05)" }}>
            All trademarks belong to their respective owners. Lusik &amp; Sons is not affiliated with, endorsed by, or sponsored by any of the companies mentioned on this site. See our <button onClick={() => setPolicyOpen("terms")} className="underline hover:opacity-100">Terms of Service</button> for full details.
          </p>
        </div>
      </footer>

      {/* CART DRAWER */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setCartOpen(false)}>
          <div className="absolute inset-0 lg-scrim" />
          <div
            className="lg-panel-tall lg-drawer relative w-full max-w-md drawer-in flex flex-col"
            style={{
              // While the user is dragging, follow the finger 1:1. The
              // transition kicks in only on release (spring-back to 0
              // or dismiss-off-screen). Mid-drag we want crisp tracking
              // with no smoothing lag, so the transition is null then.
              transform: `translateX(${cartDragX}px)`,
              transition: cartDragging ? "none" : "transform 0.2s ease-out",
              touchAction: "pan-y",
            }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onCartDrawerTouchStart}
            onTouchMove={onCartDrawerTouchMove}
            onTouchEnd={onCartDrawerTouchEnd}
            onTouchCancel={onCartDrawerTouchCancel}
          >
            {/* Drawer body shares CartContents with the mobile Bag
                page (view === "cart"). The drawer-specific chrome
                (scrim, slide-in container, swipe handlers) stays
                here; only the inner body is the shared component. */}
            <CartContents
              variant="drawer"
              cart={cart}
              subtotal={subtotal}
              cartEditMode={cartEditMode}
              onToggleEdit={setCartEditMode}
              setQtyExact={setQtyExact}
              removeFromCart={removeFromCart}
              onCheckout={goCheckout}
              onShopBlankets={() => { setCartOpen(false); goShopCategory("blankets"); }}
              onOpenSavedDesigns={() => { setCartOpen(false); setView("account"); }}
              user={user}
              onClose={() => setCartOpen(false)}
            />
          </div>
        </div>
      )}

      {/* CONNECT DRAWER */}
      {connectOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setConnectOpen(false)}>
          <div className="absolute inset-0" style={{ background: "rgba(26,22,18,0.4)" }} />
          <div className="relative w-full max-w-md drawer-in flex flex-col overflow-y-auto" style={{ background: "var(--bg-page)" }} onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-start justify-between p-6 lg:p-8 border-b" style={{ borderColor: "rgba(26,22,18,0.1)" }}>
              <div>
                <p className="text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "#B08842" }}>Reach Us</p>
                <h2 className="font-display text-3xl lg:text-4xl" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
                  However <em style={{ fontWeight: 400 }}>you</em> like.
                </h2>
              </div>
              <button onClick={() => setConnectOpen(false)} className="p-1 hover:opacity-60 -mt-1 -mr-1" aria-label="Close" data-tooltip="Close" data-tooltip-pos="left">
                <X size={22} />
              </button>
            </div>

            <div className="p-6 lg:p-8 space-y-10 flex-1">

              {/* Direct line */}
              <div>
                <p className="text-xs tracking-[0.3em] uppercase mb-5 opacity-60">Direct line</p>
                <div>
                  {[
                    { Icon: Phone, label: "Call us", detail: "(760) 874-2333", href: "tel:+17608742333", external: false },
                    { Icon: Mail, label: "Email", detail: "hello@lusikandsons.com", href: "mailto:hello@lusikandsons.com", external: false },
                  ].map((c, i) => (
                    <a key={i} href={c.href} target={c.external ? "_blank" : undefined} rel={c.external ? "noreferrer" : undefined} className="flex items-center gap-4 py-4 group hover:bg-[rgba(26,22,18,0.04)] -mx-2 px-2" style={{ borderTop: i === 0 ? "1px solid rgba(26,22,18,0.1)" : "none", borderBottom: "1px solid rgba(26,22,18,0.1)" }}>
                      <c.Icon size={20} strokeWidth={1.25} style={{ color: "#B08842" }} />
                      <div className="flex-1">
                        <p className="font-display text-lg" style={{ fontWeight: 400 }}>{c.label}</p>
                        <p className="text-sm opacity-70">{c.detail}</p>
                      </div>
                      <ArrowRight size={16} strokeWidth={1.25} className="opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Gold flourish */}
              <div className="flex items-center gap-3">
                <div className="flex-1 gold-line" />
                <span className="text-[0.6rem] tracking-[0.4em] uppercase opacity-50" style={{ color: "#B08842" }}>&</span>
                <div className="flex-1 gold-line" />
              </div>

              {/* By Post */}
              <div>
                <p className="text-xs tracking-[0.3em] uppercase mb-5 opacity-60">By Post</p>
                <div className="p-5" style={{ border: "1px solid rgba(26,22,18,0.12)" }}>
                  <div className="flex items-start gap-3 mb-4">
                    <MapPin size={18} strokeWidth={1.25} style={{ color: "#B08842", marginTop: "3px", flexShrink: 0 }} />
                    <div className="text-sm leading-relaxed flex-1">
                      <p className="font-display text-base" style={{ fontWeight: 500 }}>Lusik & Sons</p>
                      <p className="opacity-60 text-xs">c/o The UPS Store</p>
                      <p className="opacity-90 mt-1.5">5825 Lincoln Ave, Ste D<br />Buena Park, CA 90620</p>
                    </div>
                  </div>
                  <div className="text-xs space-y-1.5 pt-3" style={{ borderTop: "1px solid rgba(26,22,18,0.1)" }}>
                    <p className="opacity-60 italic mb-2">Mail pickup hours</p>
                    <div className="flex justify-between"><span className="opacity-80">Mon – Fri</span><span style={{ fontWeight: 500 }}>9 AM – 7 PM</span></div>
                    <div className="flex justify-between"><span className="opacity-80">Saturday</span><span style={{ fontWeight: 500 }}>9 AM – 5 PM</span></div>
                    <div className="flex justify-between opacity-55"><span>Sunday</span><span>Closed</span></div>
                  </div>
                </div>
              </div>

              {/* Gold flourish */}
              <div className="flex items-center gap-3">
                <div className="flex-1 gold-line" />
                <span className="text-[0.6rem] tracking-[0.4em] uppercase opacity-50" style={{ color: "#B08842" }}>&</span>
                <div className="flex-1 gold-line" />
              </div>

              {/* Online — two tiers */}
              <div>
                <p className="text-xs tracking-[0.3em] uppercase mb-2 opacity-60">Find us online</p>
                <p className="text-[0.65rem] opacity-50 mb-5 leading-relaxed italic">
                  Some accounts are still being set up. If a link doesn't work yet, please email us.
                </p>

                {/* Tier 1 — the platforms that make sense for a craft business */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {SOCIAL_PLATFORMS.tier1.map((c, i) => (
                    <a key={i} href={c.href} target="_blank" rel="noopener noreferrer"
                       className="flex flex-col gap-2.5 p-4 hover:bg-[rgba(26,22,18,0.04)] transition"
                       style={{ border: "1px solid rgba(26,22,18,0.12)" }}>
                      <c.Icon size={20} strokeWidth={1.25} style={{ color: "#B08842" }} />
                      <div>
                        <p className="font-display text-base leading-tight" style={{ fontWeight: 500 }}>{c.label}</p>
                        <p className="text-xs opacity-60 truncate mt-0.5">{c.handle}</p>
                      </div>
                    </a>
                  ))}
                </div>

                {/* Tier 2 — more platforms, smaller, compact grid */}
                <details className="group">
                  <summary className="text-xs tracking-[0.2em] uppercase opacity-60 hover:opacity-100 cursor-pointer flex items-center gap-2 py-2 list-none">
                    <span>More ways to reach us</span>
                    <ChevronDown size={14} className="transition group-open:rotate-180" />
                  </summary>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4">
                    {SOCIAL_PLATFORMS.tier2.map((c, i) => (
                      <a key={i} href={c.href} target="_blank" rel="noopener noreferrer"
                         className="flex flex-col items-center gap-1.5 p-3 hover:bg-[rgba(26,22,18,0.04)] transition text-center"
                         style={{ border: "1px solid rgba(26,22,18,0.08)" }}
                         data-tooltip={c.handle}
                         data-tooltip-pos="top">
                        <c.Icon size={18} strokeWidth={1.25} style={{ color: "#B08842" }} />
                        <p className="text-[0.65rem] font-display leading-tight" style={{ fontWeight: 500 }}>{c.label}</p>
                      </a>
                    ))}
                  </div>
                </details>
              </div>

              {/* Tagline */}
              <p className="text-sm opacity-60 text-center pt-2 leading-relaxed font-display italic" style={{ fontWeight: 400 }}>
                Lusik writes back herself, in her own time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AUTH DRAWER — sign in / sign up / forgot password */}
      {authOpen && (
        <AuthDrawer
          onClose={() => setAuthOpen(false)}
          onAuthed={() => { setAuthOpen(false); /* user/profile state arrives via onAuthStateChange */ }}
        />
      )}

      {/* POLICY MODAL — Privacy / Terms / Refunds, opened from the footer */}
      {policyOpen && (
        <PolicyModal policyKey={policyOpen} onClose={() => setPolicyOpen(null)} />
      )}

      {/* FIRST-VISIT LANGUAGE BANNER — shown to first-time visitors, asks once. */}
      <FirstVisitLangBanner />

      {/* HEART BURSTS — render at root so they float above everything except modals */}
      {bursts.map((b) => (
        <HeartBurst key={b.id} x={b.x} y={b.y} />
      ))}

      {/* TEXT-US WIDGET — floating, available on every view */}
      <TextUsWidget />

      {/* CLAUDE AI CHAT — floating, gated by CONFIG.PAID_FEATURES.CHAT_ASSISTANT.ENABLED.
          Renders nothing until the flag is flipped + ANTHROPIC_API_KEY is set. */}
      <ChatAssistant />

      {/* BACK-TO-TOP BUTTON — floating above the text-us widget, fades in
          once the user scrolls past the threshold. */}
      <BackToTopButton />
    </div>
  );
}
