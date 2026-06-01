"use client";

// ============================================================
// SiteTopNav — desktop (lg+) sticky top bar
// ============================================================
// Reproduces App.jsx's desktop <nav> for the Next chrome (SiteChrome). The
// bar is `hidden lg:block`, so the old `md:hidden` collapsible drawer inside
// it never showed at lg+ and is intentionally omitted here. Navigation runs
// through next/navigation (useSiteNav); cart/auth come from SiteProvider.
// ============================================================

import React from "react";
import { ShopMegaMenu } from "./ShopMegaMenu.jsx";
import { AtSign, User, ShoppingBag } from "./icons.jsx";
import { useT } from "../i18n/LangContext.jsx";
import { useSite } from "../state/SiteProvider.jsx";
import { useSiteNav } from "../state/useSiteNav.js";

export function SiteTopNav({ onOpenCart, onSignIn }) {
  const t = useT();
  const nav = useSiteNav();
  const { user, profile, isAdmin, cartCount, subtotal } = useSite();

  return (
    <nav className="lg-panel-tall lg-top-bar sticky top-0 z-40 theme-surface hidden lg:block">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-5 flex items-center justify-between">
        <button onClick={nav.goForYou}>
          <span className="font-display text-2xl lg:text-3xl tracking-tight" style={{ fontWeight: 500 }}>
            Lusik <span style={{ color: "var(--accent)" }}>&</span> Sons
          </span>
        </button>
        <div className="hidden md:flex items-center gap-10 text-sm tracking-wide">
          <ShopMegaMenu
            onNavigateShop={nav.goShopIndex}
            onNavigateCategory={nav.goShopCategory}
            onNavigateProduct={nav.goShopProduct}
          />
          <button onClick={() => nav.goPage("story")} className="hover:opacity-60">{t("nav.story")}</button>
          <button onClick={nav.goJournal} className="hover:opacity-60">Journal</button>
          <button onClick={() => nav.goPage("faq")} className="hover:opacity-60">{t("nav.faq")}</button>
          <button onClick={() => nav.goPage("shipping")} className="hover:opacity-60">{t("nav.shipping")}</button>
          <button onClick={() => nav.goPage("contact")} className="hover:opacity-60 flex items-center gap-2">
            <AtSign size={16} strokeWidth={1.5} />
            <span>{t("nav.connect")}</span>
          </button>
          {isAdmin && (
            <button
              onClick={nav.goAdmin}
              className="hover:opacity-60 flex items-center gap-2"
              style={{ color: "var(--accent)", fontWeight: 500 }}
              aria-label="Open admin dashboard"
              data-testid="nav-admin"
            >
              <span>Admin</span>
            </button>
          )}
          <button
            onClick={() => (user ? nav.goAccount() : onSignIn?.())}
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
              onClick={onOpenCart}
              className="relative flex items-center gap-2 hover:opacity-60"
              aria-label={`Your cart${cartCount > 0 ? ` (${cartCount} item${cartCount === 1 ? "" : "s"})` : ""}`}
            >
              <span className="inline-block"><ShoppingBag size={18} /></span>
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
                  <div className="cart-tooltip-title">View cart · {cartCount} item{cartCount !== 1 && "s"}</div>
                  <div className="cart-tooltip-meta">Subtotal ${subtotal.toFixed(2)}</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
