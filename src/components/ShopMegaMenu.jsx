"use client";

// ============================================================
// ShopMegaMenu — desktop "Shop" dropdown
// ============================================================
// Four columns matching CATALOG categories. Each column header
// is a link to the category landing page. Each product row
// is a link to its product page (live or placeholder).
//
// Placeholder products still get a real link — the product
// page itself surfaces the "Coming soon / Notify me" UX.
// (Previously placeholder clicks opened the WaitlistModal
// directly from this menu; that's been replaced by the
// placeholder product page for a more consistent experience.)
// ============================================================

import React from "react";
import { CATALOG } from "../data/catalog.js";
import { ChevronDown } from "./icons.jsx";
import { useT } from "../i18n/LangContext.jsx";

export function ShopMegaMenu({ onNavigateShop, onNavigateCategory, onNavigateProduct }) {
  const t = useT();

  return (
    <div className="shop-menu-wrap">
      <button
        className="shop-menu-trigger hover:opacity-60 flex items-center gap-1"
        onClick={() => onNavigateShop?.()}
      >
        Shop
        <ChevronDown size={14} strokeWidth={1.5} className="opacity-70" />
      </button>
      <div className="shop-menu" role="menu">
        <div className="grid grid-cols-4 gap-8">
          {Object.entries(CATALOG).map(([catKey, category]) => (
            <div key={catKey} className="shop-menu-col">
              <button
                onClick={() => onNavigateCategory?.(category.slug)}
                className="shop-menu-col-label text-left w-full hover:opacity-100"
                role="menuitem"
              >
                {category.label} →
              </button>
              {category.products.map((p) => (
                <button
                  key={p.key}
                  onClick={() => onNavigateProduct?.(category.slug, p.slug)}
                  className={`shop-menu-item text-left w-full ${p.status === "placeholder" ? "placeholder" : ""}`}
                  role="menuitem"
                >
                  {p.name}
                  {p.status === "placeholder" && (
                    <span className="shop-menu-item-meta">· Coming soon</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
        <p className="text-[0.65rem] opacity-40 italic mt-6 pt-4" style={{ borderTop: "1px solid rgba(26,22,18,0.06)" }}>
          Items marked "Coming soon" aren't yet listed for online purchase — open the page to leave your email and we'll write the moment it launches.
        </p>
      </div>
    </div>
  );
}
