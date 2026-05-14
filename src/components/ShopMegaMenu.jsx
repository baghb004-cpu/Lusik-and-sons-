// ShopMegaMenu — MIRRORED FROM index.html (~line 2942).
import React from "react";
import { CATALOG } from "../data/catalog.js";
import { ChevronDown } from "./icons.jsx";

export function ShopMegaMenu({ onShopBlanket, onShopCustom, onPlaceholderClick }) {
  const t = useT();

  // Click handler for a catalog item — figure out where to send the customer
  // based on the item's status and the canonical product it represents.
  const handleClick = (product) => {
    if (product.status === "live") {
      // Live products link to the existing on-page sections.
      if (product.key === "blanket-alphabet")     onShopBlanket?.();
      else if (product.key === "bib-single")      onShopCustom?.();
    } else {
      // Placeholder products — open the waitlist modal so we can
      // capture interest. A "Or email Lusik" fallback link inside
      // the modal preserves the old direct-email path for
      // customers who want a personal conversation.
      onPlaceholderClick?.(product);
    }
  };

  return (
    <div className="shop-menu-wrap">
      <button className="shop-menu-trigger hover:opacity-60 flex items-center gap-1">
        Shop
        <ChevronDown size={14} strokeWidth={1.5} className="opacity-60" />
      </button>
      <div className="shop-menu" role="menu">
        <div className="grid grid-cols-4 gap-8">
          {Object.entries(CATALOG).map(([catKey, category]) => (
            <div key={catKey} className="shop-menu-col">
              <p className="shop-menu-col-label">{category.label}</p>
              {category.products.map((p) => (
                <button
                  key={p.key}
                  onClick={() => handleClick(p)}
                  className={`shop-menu-item text-left w-full ${p.status === "placeholder" ? "placeholder" : ""}`}
                  role="menuitem"
                >
                  {p.name}
                  {p.status === "placeholder" && (
                    <span className="shop-menu-item-meta">· Notify me</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
        <p className="text-[0.65rem] opacity-40 italic mt-6 pt-4" style={{ borderTop: "1px solid rgba(26,22,18,0.06)" }}>
          Items marked "Notify me" aren't yet listed for online purchase — Lusik makes them but is finalizing pricing. Tap one to leave your email; we'll write the moment it launches.
        </p>
      </div>
    </div>
  );
}
