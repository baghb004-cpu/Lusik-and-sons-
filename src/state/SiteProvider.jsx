"use client";

// ============================================================
// SiteProvider — shared cart + auth state for the Next routes
// ============================================================
// The Next App Router replaces App.jsx's single-component state ownership
// with file-based routes, so the cross-route state (cart + auth) lifts into
// this provider, mounted once in app/providers.tsx above every route.
//
// Cart ops mirror App.jsx exactly and build items via the shared
// src/lib/cartItems.js builders, so the cart-id → trusted-products Stripe
// contract is identical. Navigation is intentionally NOT done here — routes
// compose next/navigation around these setters (e.g. buy-now sets the item,
// the route pushes /checkout) so this provider stays router-agnostic.
//
// MIGRATION NOTE: App.jsx (the Vite production entry) is untouched and keeps
// its own copy of this state until it's retired at the Phase 8 flip.
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useToast } from "../components/ToastProvider.jsx";
import { auth } from "../lib/auth.js";
import { db } from "../lib/db.js";
import { track } from "../lib/analytics.js";
import { haptic } from "../lib/haptic.js";
import { buildBlanketCartItem, buildCustomCartItem } from "../lib/cartItems.js";
import { mapLegacyId } from "../lib/cartId";
import { inventoryGroup, remainingForKey, isSoldOutKey } from "../lib/inventory";

const SiteContext = createContext(null);

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useSite must be used within <SiteProvider>");
  return ctx;
}

// ── Guest-cart persistence ────────────────────────────────
// The cart lives in React state, so before this it evaporated on every
// reload for guests (signed-in users got a server restore, but nothing ever
// WROTE the server copy, so in practice everyone lost their bag). The cart
// now mirrors to localStorage on every change and rehydrates on boot;
// signed-in users additionally sync to the saved-cart Function (below).
const CART_STORAGE_KEY = "lusik_cart_v1";
const CART_STORAGE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — stale carts re-pitch poorly
const CART_STORAGE_MAX_ITEMS = 40;

// localStorage is same-device data, but it's still external input: validate
// the shape so a corrupt/ancient entry can't crash the cart math. Prices are
// only ever display-deep — Stripe re-prices from trusted-products.mjs.
function readStoredCart() {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return [];
    if (Date.now() - (Number(parsed.at) || 0) > CART_STORAGE_MAX_AGE_MS) return [];
    return parsed.items
      .filter((i) => i && typeof i.id === "string" && typeof i.name === "string" && Number.isFinite(Number(i.price)))
      .slice(0, CART_STORAGE_MAX_ITEMS)
      .map((i) => ({ ...i, qty: Math.min(99, Math.max(1, Math.floor(Number(i.qty) || 1))) }));
  } catch {
    return [];
  }
}

export function SiteProvider({ children }) {
  const toast = useToast();

  // ── Cart ────────────────────────────────────────────────
  const [cart, setCart] = useState([]);
  const [buyNowItem, setBuyNowItem] = useState(null);
  // "Open the cart" signal. Adding to the bag should surface the cart (drawer
  // on desktop, /cart page on mobile) — parity with the old App.jsx openCart().
  // The cart-open *UI* lives in SiteChrome, so we expose a monotonically
  // increasing counter it watches; bumping it on each add re-triggers the open
  // even when the same item is added twice.
  const [cartOpenSignal, setCartOpenSignal] = useState(0);
  const requestOpenCart = useCallback(() => setCartOpenSignal((n) => n + 1), []);
  // The productKey most recently added — drives the "You may also like"
  // post-add sheet (SiteChrome reads it off the cartOpenSignal bump).
  const [lastAddedKey, setLastAddedKey] = useState(null);

  const cartCount = useMemo(() => cart.reduce((s, i) => s + (Number(i.qty) || 0), 0), [cart]);
  const subtotal  = useMemo(() => cart.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0), [cart]);

  // ── Handmade-stock availability (display + friendly client cap) ──
  // The server is the authoritative overselling guard at checkout; this
  // just keeps the UI honest and stops a customer from piling more into
  // the bag than Lusik can make. `inventory` is null until the first
  // fetch — until then every cap defaults to "available" (Infinity).
  const [inventory, setInventory] = useState(null);
  const refreshInventory = useCallback(async () => {
    try { setInventory(await db.getInventory()); } catch { /* keep prior snapshot */ }
  }, []);
  useEffect(() => { refreshInventory(); }, [refreshInventory]);

  const remainingFor = useCallback((productKey) => remainingForKey(inventory, productKey), [inventory]);
  const isSoldOut    = useCallback((productKey) => isSoldOutKey(inventory, productKey), [inventory]);

  // Units of a given inventory group already sitting in the cart.
  const groupCountInCart = (cartArr, group) =>
    cartArr.reduce((n, it) => {
      const k = it.productKey ?? mapLegacyId(it.id);
      return inventoryGroup(k) === group ? n + (Number(it.qty) || 0) : n;
    }, 0);

  const stockToast = useCallback((remaining) => {
    toast({
      kind: "info",
      message: remaining <= 0
        ? "That one just sold out — these are handmade in small batches. Tap “Notify me” on the product to hear when it’s back."
        : `Only ${remaining} of this is available right now — that’s all Lusik can make in this batch.`,
    });
  }, [toast]);

  const addToCart = useCallback((color, qty = 1, selection = null, layout = null, colors = null) => {
    const item = buildBlanketCartItem(color, qty, selection, layout, colors);
    const key = item.productKey ?? mapLegacyId(item.id);
    const group = inventoryGroup(key);
    const remaining = remainingFor(key);
    let addQty = qty;
    if (group != null && Number.isFinite(remaining)) {
      const room = remaining - groupCountInCart(cart, group);
      if (room <= 0) { stockToast(remaining); return; }
      if (qty > room) { addQty = room; stockToast(remaining); }
    }
    haptic(12);
    track("add-to-cart", { kind: "blanket", alphabet: selection?.key ?? null, layout: layout?.key ?? null });
    setCart((c) => {
      const existing = c.find((i) => i.id === item.id);
      if (existing) return c.map((i) => (i.id === item.id ? { ...i, qty: i.qty + addQty } : i));
      return [...c, { ...item, qty: addQty }];
    });
    setLastAddedKey(key);
    requestOpenCart();
  }, [requestOpenCart, cart, remainingFor, stockToast]);

  const addCustomToCart = useCallback((payload) => {
    const group = inventoryGroup(payload.productKey);
    const remaining = remainingFor(payload.productKey);
    if (group != null && Number.isFinite(remaining)) {
      const inCart = groupCountInCart(cart, group);
      if (inCart + 1 > remaining) { stockToast(remaining); return; }
    }
    haptic(12);
    track("add-to-cart", { kind: "custom", productKey: payload.productKey });
    setCart((c) => [...c, buildCustomCartItem(payload)]);
    setLastAddedKey(payload.productKey);
    requestOpenCart();
  }, [requestOpenCart, cart, remainingFor, stockToast]);

  // Buy-now sets the single transient item; the calling route pushes /checkout.
  const buyNowBlanket = useCallback((color, qty = 1, selection = null, layout = null, colors = null) => {
    haptic(12);
    track("buy-now", { kind: "blanket", alphabet: selection?.key ?? null, layout: layout?.key ?? null });
    setBuyNowItem(buildBlanketCartItem(color, qty, selection, layout, colors));
  }, []);

  const buyNowCustom = useCallback((payload) => {
    haptic(12);
    track("buy-now", { kind: "custom", productKey: payload.productKey });
    setBuyNowItem(buildCustomCartItem(payload));
  }, []);

  const removeFromCart = useCallback((id) => {
    haptic(8);
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
            const existing = c.findIndex((i) => i.id === removed.id);
            if (existing >= 0) return c.map((i, idx) => (idx === existing ? { ...i, qty: i.qty + removed.qty } : i));
            const next = [...c];
            next.splice(Math.min(removedIndex, next.length), 0, removed);
            return next;
          });
        },
      },
    });
  }, [toast]);

  // Largest qty this single line may hold without its group exceeding
  // remaining stock (accounts for other lines of the same group).
  const maxQtyForLine = useCallback((item) => {
    const key = item.productKey ?? mapLegacyId(item.id);
    const group = inventoryGroup(key);
    const remaining = remainingFor(key);
    if (group == null || !Number.isFinite(remaining)) return 99;
    const others = groupCountInCart(cart, group) - (Number(item.qty) || 0);
    return Math.max(1, Math.min(99, remaining - others));
  }, [cart, remainingFor]);

  const updateQty = useCallback((id, delta) => {
    if (delta < 0) {
      const item = cart.find((i) => i.id === id);
      if (item && item.qty + delta < 1) { removeFromCart(id); return; }
    }
    if (delta > 0) {
      const item = cart.find((i) => i.id === id);
      if (item && item.qty + delta > maxQtyForLine(item)) { stockToast(remainingFor(item.productKey ?? mapLegacyId(item.id))); return; }
    }
    setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)));
  }, [cart, removeFromCart, maxQtyForLine, stockToast, remainingFor]);

  const setQtyExact = useCallback((id, qty) => {
    const item = cart.find((i) => i.id === id);
    const ceiling = item ? maxQtyForLine(item) : 99;
    const clamped = Math.min(ceiling, Math.max(1, Math.floor(Number(qty) || 1)));
    if (item && Math.floor(Number(qty) || 1) > ceiling) stockToast(remainingFor(item.productKey ?? mapLegacyId(item.id)));
    setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: clamped } : i)));
  }, [cart, maxQtyForLine, stockToast, remainingFor]);

  // ── Cart persistence (see readStoredCart above) ─────────
  // True when this page load is the return leg of a successful Stripe
  // checkout (/?order=success). The full-page redirect used to be the only
  // thing "clearing" the cart — React state simply reset. With persistence
  // that accident goes away, so the success landing explicitly clears the
  // stored copy (local below, server in the session handler) instead of
  // restoring a bag the customer just paid for.
  const [orderJustCompleted] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("order") === "success"
  );

  const cartHydratedRef = useRef(false);
  useEffect(() => {
    if (orderJustCompleted) {
      try { window.localStorage.removeItem(CART_STORAGE_KEY); } catch { /* storage blocked */ }
    } else {
      const stored = readStoredCart();
      if (stored.length) setCart((c) => (c.length ? c : stored));
    }
    cartHydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cartHydratedRef.current) return;
    try {
      if (cart.length) window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ at: Date.now(), items: cart }));
      else window.localStorage.removeItem(CART_STORAGE_KEY);
    } catch { /* storage full/blocked — the in-memory cart still works */ }
  }, [cart]);

  // ── Auth (mirrors App.jsx's session effect) ─────────────
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  // Guards the saved-cart write-back: stays false until the session handler
  // has reconciled the server copy into local state, so a slow first
  // getSavedCart can't be overwritten by an early PUT of an empty cart.
  const serverCartSyncedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    const handleSession = async (session) => {
      if (!session?.user) {
        if (!mounted) return;
        serverCartSyncedRef.current = false;
        setUser(null); setProfile(null); setIsAdmin(false); setAuthReady(true);
        return;
      }
      setUser(session.user);
      setIsAdmin(auth.isAdmin());
      // Re-reconcile from scratch for this session — pause the write-back
      // until the fetch below lands so it can't clobber the server copy.
      serverCartSyncedRef.current = false;
      try {
        const [{ profile: p }, { cart: savedCart }] = await Promise.all([db.getProfile(), db.getSavedCart()]);
        if (!mounted) return;
        setProfile(p ?? null);
        if (savedCart && Array.isArray(savedCart)) {
          if (orderJustCompleted) {
            // Back from Stripe success: the server copy is the cart that was
            // just purchased — clear it rather than refill the bag.
            db.saveCart([]).catch(() => {});
          } else {
            setCart((local) => {
              if (local.length === 0) return savedCart;
              const merged = [...savedCart];
              for (const localItem of local) {
                const idx = merged.findIndex((m) => m.id === localItem.id);
                if (idx >= 0) merged[idx] = localItem; else merged.push(localItem);
              }
              return merged;
            });
          }
        }
        // Server copy is now reconciled with local state — the debounced
        // write-back below may start persisting changes from here on.
        serverCartSyncedRef.current = true;
      } catch (err) {
        console.warn("Profile/cart hydrate failed:", err);
      }
      if (mounted) setAuthReady(true);
    };

    auth.getSession()
      .then(({ session }) => handleSession(session))
      .catch((err) => { console.warn("Auth session check failed:", err); if (mounted) setAuthReady(true); });

    let subscription = null;
    try {
      const { data } = auth.onAuthStateChange((_e, session) => handleSession(session));
      subscription = data?.subscription;
    } catch (err) {
      console.warn("Auth subscription failed:", err);
    }
    return () => { mounted = false; if (subscription) subscription.unsubscribe(); };
  }, []);

  // Saved-cart write-back. The /saved-cart Function always supported PUT but
  // nothing ever called it, so "your cart follows your account" only worked
  // until the first change. Debounced so a qty-stepper flurry lands as one
  // request; errors are swallowed — persistence must never break the cart.
  const saveCartTimerRef = useRef(null);
  useEffect(() => {
    if (!user || !serverCartSyncedRef.current) return undefined;
    clearTimeout(saveCartTimerRef.current);
    saveCartTimerRef.current = setTimeout(() => {
      Promise.resolve(db.saveCart(cart)).catch(() => {});
    }, 1200);
    return () => clearTimeout(saveCartTimerRef.current);
  }, [cart, user]);

  const signOut = useCallback(async () => {
    const { error } = await auth.signOut();
    if (!error) { setUser(null); setProfile(null); setIsAdmin(false); }
    return { error };
  }, []);

  const value = useMemo(() => ({
    cart, setCart, cartCount, subtotal, buyNowItem, setBuyNowItem,
    addToCart, addCustomToCart, buyNowBlanket, buyNowCustom, removeFromCart, updateQty, setQtyExact,
    cartOpenSignal, requestOpenCart, lastAddedKey,
    inventory, remainingFor, isSoldOut, refreshInventory,
    user, profile, setProfile, isAdmin, authReady, signOut,
  }), [cart, cartCount, subtotal, buyNowItem, addToCart, addCustomToCart, buyNowBlanket, buyNowCustom,
       removeFromCart, updateQty, setQtyExact, cartOpenSignal, requestOpenCart, lastAddedKey,
       inventory, remainingFor, isSoldOut, refreshInventory,
       user, profile, isAdmin, authReady, signOut]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}
