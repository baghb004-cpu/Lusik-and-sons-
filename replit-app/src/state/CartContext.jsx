// ============================================================
// CartContext — the bag store (Chunk 4: persistence + the math)
// ============================================================
// The JS sibling of ios/LusikSons/Models/Cart.swift. Persisted to
// localStorage (shape-validated on read — a corrupt or stale blob
// must never crash the app), with the display mirrors of the server
// math: bundle savings ($1 off every unit after the first, $25 cap,
// subtotal floor — exact _lib/bundle-discount.mjs parity) and the
// free-shipping-at-$150 progress. All amounts are DISPLAY ONLY: the
// server recomputes prices, the bundle coupon, and shipping from its
// own trusted tables at checkout.
// Haptics live HERE, not at call sites (the iOS Chunk-8 rule:
// the store owns the buzzes so every surface feels identical).

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PRODUCTS } from "../data/catalog.js";
import { haptics } from "../lib/haptics.js";

const STORAGE_KEY = "lusik.cart.v1"; // Cart.swift's key
const FREE_SHIPPING_DOLLARS = 150;
const BUNDLE_PER_EXTRA_CENTS = 100; // _lib/bundle-discount.mjs
const BUNDLE_MAX_CENTS = 2500;

// One line in the bag (CartItem.swift parity):
// { id, checkoutKey, name, subtitle, priceDollars, qty, photoURL }
const isCartItem = (x) =>
  x && typeof x === "object" &&
  typeof x.id === "string" &&
  typeof x.checkoutKey === "string" &&
  typeof x.name === "string" &&
  typeof x.subtitle === "string" &&
  Number.isFinite(x.priceDollars) &&
  Number.isInteger(x.qty) && x.qty >= 1 && x.qty <= 99;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : [];
  } catch {
    return [];
  }
}

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch { /* private mode — the in-memory bag still works */ }
  }, [items]);

  // ── mutations (each owns its haptic) ──
  const add = useCallback((item) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.id === item.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: Math.min(99, next[i].qty + item.qty) };
        return next;
      }
      return [...prev, item];
    });
    haptics.add();
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => {
      const next = prev.filter((x) => x.id !== id);
      if (next.length !== prev.length) haptics.remove();
      return next;
    });
  }, []);

  const setQty = useCallback((id, qty) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.id === id);
      if (i < 0) return prev;
      const clamped = Math.max(1, Math.min(99, qty));
      if (clamped === prev[i].qty) return prev;
      const next = [...prev];
      next[i] = { ...next[i], qty: clamped };
      haptics.step();
      return next;
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  // ── totals (Cart.swift parity) ──
  const unitCount = useMemo(() => items.reduce((n, x) => n + x.qty, 0), [items]);
  const subtotalDollars = useMemo(() => items.reduce((n, x) => n + x.priceDollars * x.qty, 0), [items]);

  // "$1 off every piece after the first", capped — exact mirror of
  // bundleDiscountCents() on the server (incl. the subtotal floor).
  const bundleSavingsDollars = useMemo(() => {
    const subtotalCents = subtotalDollars * 100;
    if (unitCount <= 1 || subtotalCents <= 0) return 0;
    const raw = (unitCount - 1) * BUNDLE_PER_EXTRA_CENTS;
    return Math.max(0, Math.min(raw, BUNDLE_MAX_CENTS, subtotalCents - 50)) / 100;
  }, [unitCount, subtotalDollars]);

  const qualifiesForFreeShipping = subtotalDollars >= FREE_SHIPPING_DOLLARS;
  const freeShippingProgress = Math.min(1, subtotalDollars / FREE_SHIPPING_DOLLARS);
  const dollarsAwayFromFreeShipping = Math.max(0, FREE_SHIPPING_DOLLARS - subtotalDollars);

  // The catalog product behind a bag row (variant suffix stripped) —
  // powers tap-the-row-to-revisit-the-product.
  const productFor = useCallback((item) => {
    const baseId = item.id.endsWith("-with-cap") ? item.id.slice(0, -"-with-cap".length) : item.id;
    return PRODUCTS.find((p) => p.id === baseId) ?? null;
  }, []);

  const value = useMemo(
    () => ({
      items, add, remove, setQty, clear, productFor,
      unitCount, subtotalDollars, bundleSavingsDollars,
      qualifiesForFreeShipping, freeShippingProgress, dollarsAwayFromFreeShipping,
      freeShippingThresholdDollars: FREE_SHIPPING_DOLLARS,
    }),
    [items, add, remove, setQty, clear, productFor, unitCount, subtotalDollars,
     bundleSavingsDollars, qualifiesForFreeShipping, freeShippingProgress, dollarsAwayFromFreeShipping]
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
