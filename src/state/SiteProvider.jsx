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

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "../components/ToastProvider.jsx";
import { auth } from "../lib/auth.js";
import { db } from "../lib/db.js";
import { track } from "../lib/analytics.js";
import { haptic } from "../lib/haptic.js";
import { buildBlanketCartItem, buildCustomCartItem } from "../lib/cartItems.js";

const SiteContext = createContext(null);

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useSite must be used within <SiteProvider>");
  return ctx;
}

export function SiteProvider({ children }) {
  const toast = useToast();

  // ── Cart ────────────────────────────────────────────────
  const [cart, setCart] = useState([]);
  const [buyNowItem, setBuyNowItem] = useState(null);

  const cartCount = useMemo(() => cart.reduce((s, i) => s + (Number(i.qty) || 0), 0), [cart]);
  const subtotal  = useMemo(() => cart.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0), [cart]);

  const addToCart = useCallback((color, qty = 1, selection = null, layout = null, colors = null) => {
    haptic(12);
    track("add-to-cart", { kind: "blanket", alphabet: selection?.key ?? null, layout: layout?.key ?? null });
    const item = buildBlanketCartItem(color, qty, selection, layout, colors);
    setCart((c) => {
      const existing = c.find((i) => i.id === item.id);
      if (existing) return c.map((i) => (i.id === item.id ? { ...i, qty: i.qty + qty } : i));
      return [...c, item];
    });
  }, []);

  const addCustomToCart = useCallback((payload) => {
    haptic(12);
    track("add-to-cart", { kind: "custom", productKey: payload.productKey });
    setCart((c) => [...c, buildCustomCartItem(payload)]);
  }, []);

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

  const updateQty = useCallback((id, delta) => {
    if (delta < 0) {
      const item = cart.find((i) => i.id === id);
      if (item && item.qty + delta < 1) { removeFromCart(id); return; }
    }
    setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)));
  }, [cart, removeFromCart]);

  const setQtyExact = useCallback((id, qty) => {
    const clamped = Math.min(99, Math.max(1, Math.floor(Number(qty) || 1)));
    setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: clamped } : i)));
  }, []);

  // ── Auth (mirrors App.jsx's session effect) ─────────────
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const handleSession = async (session) => {
      if (!session?.user) {
        if (!mounted) return;
        setUser(null); setProfile(null); setIsAdmin(false); setAuthReady(true);
        return;
      }
      setUser(session.user);
      setIsAdmin(auth.isAdmin());
      try {
        const [{ profile: p }, { cart: savedCart }] = await Promise.all([db.getProfile(), db.getSavedCart()]);
        if (!mounted) return;
        setProfile(p ?? null);
        if (savedCart && Array.isArray(savedCart)) {
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

  const signOut = useCallback(async () => {
    const { error } = await auth.signOut();
    if (!error) { setUser(null); setProfile(null); setIsAdmin(false); }
    return { error };
  }, []);

  const value = useMemo(() => ({
    cart, setCart, cartCount, subtotal, buyNowItem, setBuyNowItem,
    addToCart, addCustomToCart, buyNowBlanket, buyNowCustom, removeFromCart, updateQty, setQtyExact,
    user, profile, setProfile, isAdmin, authReady, signOut,
  }), [cart, cartCount, subtotal, buyNowItem, addToCart, addCustomToCart, buyNowBlanket, buyNowCustom,
       removeFromCart, updateQty, setQtyExact, user, profile, isAdmin, authReady, signOut]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}
