// ============================================================
// CartContext — the bag store (Chunk 1: in-memory add + count)
// ============================================================
// The JS sibling of ios/LusikSons/Models/Cart.swift. Chunk 4 adds
// persistence, the server-math display mirrors (bundle savings,
// free-shipping progress), qty editing, and the full BagView.
// Haptics live HERE, not at call sites (the iOS Chunk-8 rule:
// CartStore owns the buzzes so every surface feels identical).

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { haptics } from "../lib/haptics.js";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);

  // One line in the bag: { id, checkoutKey, name, subtitle,
  // priceDollars, qty, photoURL } — CartItem.swift parity.
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

  const unitCount = useMemo(() => items.reduce((n, x) => n + x.qty, 0), [items]);

  const value = useMemo(() => ({ items, add, unitCount }), [items, add, unitCount]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
