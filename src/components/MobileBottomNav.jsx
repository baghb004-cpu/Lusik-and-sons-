// ============================================================
// MobileBottomNav — bottom tab bar for phones
// ============================================================
// Fixed-position bar that appears on mobile (`lg:hidden`).
// Four tabs: Home, Shop, Cart, Account. Admin is shown via the
// Account tab (which is highlighted for view === "admin" too).
//
// Honors iOS safe-area-inset-bottom so it doesn't overlap the
// home-bar gesture area on iPhone X+ devices.
//
// MIRRORED FROM index.html (~line 8761).
// ============================================================

import React from "react";
import { Home, Store, ShoppingBag, User } from "./icons.jsx";

export function MobileBottomNav({ view, cartCount, onHome, onShop, onCart, onAccount }) {
  // Each tab's "active" highlight. Cart is a drawer (not a
  // view), so it gets the active style when the count > 0 as a
  // gentler signal that something's in there.
  const isHome    = view === "home";
  const isAccount = view === "account" || view === "admin";
  const itemColor = (active) => ({
    color: active ? "var(--text-primary)" : "var(--text-muted)",
    fontWeight: active ? 600 : 500,
  });
  const labelCls = "text-[0.55rem] tracking-[0.12em] uppercase mt-1";
  const btnCls   = "flex-1 flex flex-col items-center justify-center py-2 px-1 transition";

  // Flush-to-bottom frosted bar (NOT a floating island) — keeps
  // the layout math in src/styles/index.css for stacked floating
  // widgets (back-to-top, text-us, active-order banner) unchanged.
  // The .lg-panel-tall + lg-bottom-bar combo gives the iOS-26-style
  // frosted bottom bar look without floating the surface.
  return (
    <nav
      className="lg-panel-tall lg-bottom-bar lg:hidden fixed bottom-0 inset-x-0 z-30 theme-surface"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0)",
      }}
      aria-label="Bottom navigation"
    >
      <div className="flex items-stretch">
        <button onClick={onHome} className={btnCls} aria-label="Home" aria-current={isHome ? "page" : undefined}>
          <Home size={20} strokeWidth={isHome ? 2 : 1.5} style={itemColor(isHome)} />
          <span className={labelCls} style={itemColor(isHome)}>Home</span>
        </button>
        <button onClick={onShop} className={btnCls} aria-label="Shop">
          <Store size={20} strokeWidth={1.5} style={itemColor(false)} />
          <span className={labelCls} style={itemColor(false)}>Shop</span>
        </button>
        <button onClick={onCart} className={btnCls} aria-label={`Cart${cartCount > 0 ? ` (${cartCount} item${cartCount === 1 ? "" : "s"})` : ""}`}>
          <span className="relative">
            <ShoppingBag size={20} strokeWidth={cartCount > 0 ? 2 : 1.5} style={itemColor(cartCount > 0)} />
            {cartCount > 0 && (
              <span
                className="absolute -top-1.5 -right-2 tabular-nums text-[0.6rem] leading-none flex items-center justify-center"
                style={{
                  background: "#B08842",
                  color: "#F5EFE3",
                  minWidth: 16,
                  height: 16,
                  padding: "0 4px",
                  borderRadius: 9,
                  fontWeight: 600,
                }}
              >
                {cartCount}
              </span>
            )}
          </span>
          <span className={labelCls} style={itemColor(cartCount > 0)}>Cart</span>
        </button>
        <button onClick={onAccount} className={btnCls} aria-label="Account" aria-current={isAccount ? "page" : undefined}>
          <User size={20} strokeWidth={isAccount ? 2 : 1.5} style={itemColor(isAccount)} />
          <span className={labelCls} style={itemColor(isAccount)}>Account</span>
        </button>
      </div>
    </nav>
  );
}
